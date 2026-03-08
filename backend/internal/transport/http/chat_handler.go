package http

import (
	"Hercules/backend/internal/adapter"
	"Hercules/backend/internal/core/repository"
	"Hercules/backend/internal/core/model"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/generative-ai-go/genai"
	"golang.org/x/oauth2"
	"google.golang.org/api/option"
)

type ChatHistoryPart struct {
	Text string `json:"text"`
}

type ChatHistoryItem struct {
	Role  string            `json:"role"`
	Parts []ChatHistoryPart `json:"parts"`
}

const MonetaPrompt = `
You are Moneta, named after the Goddess of Coin and Memory. You are a collections assistant within the Hercules platform.
Hercules deals with case management, while you deal with collections.
Compassionate and Determinate Collections Guide:
1. Core Philosophy:
   - Commercially Sound Solutions: We must collect fees to provide top-tier defense.
   - Fees as Investment: Clients investing in their defense.
   - The Partnership: Two-way street; advocacy for financial commitment.
2. The Method:
   - Tool A: The Tactical Label ("It sounds like...", "It seems like...") to lower defensiveness.
   - Tool B: The Calibrated Question ("How...", "What...") to move to problem-solving.
3. Tactical Decision Matrix:
   - Ghosting: "It seems like you've decided to give up on this case." -> "Have you reached a point where you no longer see value in our partnership?" -> Resolution: "No-Oriented" Email.
   - Financial Hardship: "It sounds like you're feeling squeezed..." -> "How can we structure a plan...?" -> Resolution: Good Faith payment.
   - Case Anxiety: "It sounds like you're worried..." -> "How does resolving this balance change your confidence...?" -> Resolution: Value update call.
   - Forgot: "It sounds like this fell to the bottom..." -> "How would a weekly auto-payment change...?" -> Resolution: Auto-Pay.
   - Third-Party Payor: "It sounds like you're carrying a heavy burden..." -> "How can we structure this so [Client] takes more accountability?" -> Resolution: Accountability call.
4. Scripts:
   - Ghosting: "Have you given up on your commitment...?"
   - Voss Pivot: "I hear that things are tight. But how am I supposed to keep the firm’s full resources...?"
   - Value Bridge: "It feels like you’re frustrated... What would it take for you to feel secure...?"
5. Operational Rules:
   - Prioritize by Next Court Date.
   - Tone: Professional, calm, firm.
   - PROHIBITED: "I'm calling to collect a debt", "You are late", "If you don't pay we withdraw", "cheap/affordable defense".
6. Daily Tracking:
   - Track Client, Court Date, Balance, Reason Label, Sentiment, Next Action.

INSTRUCTIONS:
- When the user (collections specialist) asks for advice or a script, generate it using the methods above.
- If asked to analyze raw data (pasted text), identify who to call first based on Next Court Date and Balance.
`

type ChatRequest struct {
	Message       string            `json:"message"`
	AssistantType string            `json:"assistant_type"` // "hercules" or "moneta"
	History       []ChatHistoryItem `json:"history"`
}

type ChatResponse struct {
	Reply  string      `json:"reply"`
	Action string      `json:"action,omitempty"`
	Data   interface{} `json:"data,omitempty"`
}

type ChatHandler struct {
	client   *genai.Client
	repo     repository.Repository
	calendar *adapter.GoogleCalendarAdapter
}

func NewChatHandler(repo repository.Repository, oauthConfig *oauth2.Config) *ChatHandler {
	apiKey := os.Getenv("GEMINI_API_KEY")
	log.Printf("DEBUG: NewChatHandler initialized. API Key Length: %d", len(apiKey))

	calAdapter := adapter.NewGoogleCalendarAdapter(oauthConfig)

	if apiKey == "" {
		log.Println("Warning: GEMINI_API_KEY not set. AI features will fail.")
		return &ChatHandler{repo: repo, calendar: calAdapter}
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Printf("Error creating Gemini client: %v", err)
		return &ChatHandler{repo: repo, calendar: calAdapter}
	}

	return &ChatHandler{client: client, repo: repo, calendar: calAdapter}
}

func (h *ChatHandler) HandleChat(c *fiber.Ctx) error {
	now := time.Now()
	var req ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if h.client == nil {
		log.Println("DEBUG: ChatHandler h.client is NIL during request")
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service not configured"})
	}

	// Identify User (Strict Auth)
	var userEmail string
	if u, ok := c.Locals("user").(string); ok {
		userEmail = u
	} else {
		log.Println("DEBUG: ChatHandler - No user found in locals")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		log.Printf("DEBUG: ChatHandler - User '%s' not found in DB", userEmail)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	// 1. Fetch Case Data for Context (RAG)
	cases, err := h.repo.GetCasesByAccount(user.AccountID.String())
	caseContext := ""
	if err == nil {
		var sb strings.Builder
		for _, k := range cases {
			// FILTER: strict assignment
			if k.AssignedUserID == nil || *k.AssignedUserID != user.ID {
				continue
			}
			desc, _ := k.ExtData["description"].(string)
			if desc == "" {
				desc = "No description."
			}
			// Include new fields in context
			sb.WriteString(fmt.Sprintf("CASE ID: %s | Title: %s | Status: %s | Score: %d | Phase: %s | Balance: %.2f | Next Court: %s | Summary: %s\n",
				k.ID, k.Title, k.Status, k.PriorityScore, k.Phase, k.BalanceDue, k.NextCourtDate, desc))
		}
		caseContext = "Your Assigned Cases:\n" + sb.String()
	}

	// 2. Fetch Personal Tasks for Context
	tasks, err := h.repo.GetPersonalTasks(user.ID.String())
	tasksContext := "No pending personal tasks."
	if err == nil && len(tasks) > 0 {
		var sb strings.Builder
		for _, t := range tasks {
			sb.WriteString(fmt.Sprintf("- %s (Est: %s) - %s\n", t.Title, t.EstimatedDuration, t.Description))
		}
		tasksContext = "Pending Personal Tasks:\n" + sb.String()
	}

	ctx := context.Background()
	aiModel := h.client.GenerativeModel("gemini-2.5-flash")
	aiModel.SetMaxOutputTokens(8192) // Keep max tokens high
	log.Printf("DEBUG: Using model %s", "gemini-2.5-flash")

	// Construct Chat Session
	cs := aiModel.StartChat()
	if len(req.History) > 0 {
		var genaiHistory []*genai.Content
		for _, h := range req.History {
			parts := []genai.Part{}
			for _, p := range h.Parts {
				parts = append(parts, genai.Text(p.Text))
			}
			genaiHistory = append(genaiHistory, &genai.Content{
				Role:  h.Role,
				Parts: parts,
			})
		}
		cs.History = genaiHistory
	}

	// Dynamic System Instruction
	var systemPrompt string
	var availabilityContext string

	if strings.ToLower(req.AssistantType) == "moneta" {
		systemPrompt = fmt.Sprintf("%s\n\nContext Data:\n%s", MonetaPrompt, caseContext)
	} else {
		// Hercules Default
		// 2. Fetch Schedule Availability (only relevant for Hercules typically)
		availabilityContext = "Calendar: Not Connected (Assume 9-5 availability)."
		if user != nil && user.GoogleAccessToken != "" {
			avail, err := h.calendar.GetAvailability(user, now, now.AddDate(0, 0, 7))
			if err == nil {
				availabilityContext = "User's Calendar (Next 7 Days):\n" + avail
			} else {
				availabilityContext = fmt.Sprintf("Calendar: Connected but failed to fetch data (%v). Assume 9-5 availability.", err)
			}
		}

		currentDate := now.Format("2006-01-02 (Monday)")
		// Calculate specific dates for the prompt to guide the AI
		daysUntilMonday := (8 - int(now.Weekday())) % 7
		if daysUntilMonday == 0 {
			daysUntilMonday = 7
		}
		nextMonday := now.AddDate(0, 0, daysUntilMonday)
		nextMondayStr := nextMonday.Format("2006-01-02")

		systemPrompt = fmt.Sprintf(`You are Hercules, an intelligent legal assistant.
Current Date: %s

Data Access:
%s

%s

Availability:
%s

Instructions:
1. Answer questions based on the Data above.
2. PLANNING RULE: If asked to "plan the week", create a schedule for the *upcoming* week (Starting %s).
3. PERSONAL TASKS: Check "Pending Personal Tasks". ASK the user naturally if they want to schedule them (e.g. "I see you have a task to... should we add that?"). Do NOT use prefixes like [TASK] or (Yes/No).
4. CASE SUGGESTIONS: Scan "Your Assigned Cases". Identify cases with high Priority Scores, approaching Court Dates, or 'Ongoing' status. SUGGEST working on these specific cases in the schedule propsal. PROACTIVELY propose slots for them.
5. IMPORTANT: Use REAL dates for the coming week (e.g., if starting Mon %s, use %s, etc.). DO NOT use generic "2024-01-01" dates from examples.
6. Output a JSON action block on a single line at the end:
   [[PROPOSE_SCHEDULE: [{"title": "Work on Case X", "start": "%sT10:00:00", "end": "%sT12:00:00", "case_id": "...", "is_external": false}, {"title": "Review: [Task Name]", "start": "...", "end": "..."}]]]
   (The above ISO format is required. Use ACTUAL dates for next week. INCLUDE ALL existing calendar events provided in the 'Availability' section with "is_external": true).
7. IMPORTANT: Output Standard JSON only. No comments (//), no trailing commas.
8. DO NOT use markdown code blocks inside the tags.
9. Use Markdown for text. Be conversational and professional.
`, currentDate, caseContext, tasksContext, availabilityContext, nextMondayStr, nextMondayStr, nextMonday.AddDate(0, 0, 1).Format("2006-01-02"), nextMondayStr, nextMondayStr)
	}

	aiModel.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(systemPrompt)},
	}
	log.Printf("DEBUG: AI Availability Context: %s", availabilityContext)

	// Generate
	resp, err := cs.SendMessage(ctx, genai.Text(req.Message))
	if err != nil {
		log.Printf("Error generating content: %v", err)

		// Graceful error handling - Return 200 with error message in chat style
		// This prevents the whole app from crashing (500) when the AI is busy
		replyMsg := "I'm having trouble connecting to my AI services right now."
		if strings.Contains(err.Error(), "429") || strings.Contains(strings.ToLower(err.Error()), "quota") {
			replyMsg = "I've hit my usage limit for the moment. Please try again in a minute."
		}

		return c.JSON(ChatResponse{
			Reply: replyMsg,
		})
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return c.JSON(ChatResponse{Reply: "I'm sorry, I didn't understand that."})
	}

	// Extract text
	aiText := ""
	for _, part := range resp.Candidates[0].Content.Parts {
		if t, ok := part.(genai.Text); ok {
			aiText += string(t)
		}
	}

	// Actions
	action := ""
	var actionData interface{}

	// 1. Dashboard
	if strings.Contains(aiText, "[[navigate_dashboard]]") {
		action = "navigate_dashboard"
		aiText = strings.ReplaceAll(aiText, "[[navigate_dashboard]]", "")
	}

	// 2. Schedule Proposal (Find ALL matches)
	re := regexp.MustCompile(`(?s)\[\[PROPOSE_SCHEDULE:\s*(.*?)\]\]`)
	matches := re.FindAllStringSubmatch(aiText, -1)

	if len(matches) > 0 {
		// Remove the raw tags from the response
		aiText = re.ReplaceAllString(aiText, "")

		var aggregateSchedule []map[string]interface{}

		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			rawContent := match[1]

			// Find valid JSON bounds
			startArray := strings.Index(rawContent, "[")
			endArray := strings.LastIndex(rawContent, "]")
			startObj := strings.Index(rawContent, "{")
			endObj := strings.LastIndex(rawContent, "}")

			var jsonStr string
			var isArray bool

			if startArray != -1 && endArray != -1 && endArray > startArray {
				jsonStr = rawContent[startArray : endArray+1]
				isArray = true
			} else if startObj != -1 && endObj != -1 && endObj > startObj {
				jsonStr = rawContent[startObj : endObj+1]
				isArray = false
			}

			if jsonStr == "" {
				log.Printf("Failed to find JSON brackets in content: %s", rawContent)
				continue
			}

			// Clean Markdown more robustly
			jsonStr = strings.TrimSpace(jsonStr)
			if strings.HasPrefix(jsonStr, "```json") {
				jsonStr = strings.TrimPrefix(jsonStr, "```json")
			} else if strings.HasPrefix(jsonStr, "```") {
				jsonStr = strings.TrimPrefix(jsonStr, "```")
			}
			if strings.HasSuffix(jsonStr, "```") {
				jsonStr = strings.TrimSuffix(jsonStr, "```")
			}
			jsonStr = strings.TrimSpace(jsonStr)

			var batch []map[string]interface{}

			if isArray {
				if err := json.Unmarshal([]byte(jsonStr), &batch); err == nil {
					aggregateSchedule = append(aggregateSchedule, batch...)
				} else {
					log.Printf("Failed to unmarshal schedule match: %v", err)
				}
			} else {
				var singleItem map[string]interface{}
				if err := json.Unmarshal([]byte(jsonStr), &singleItem); err == nil {
					aggregateSchedule = append(aggregateSchedule, singleItem)
				} else {
					// Check if wrapped in [] helps
					wrappedJson := "[" + jsonStr + "]"
					if err := json.Unmarshal([]byte(wrappedJson), &batch); err == nil {
						aggregateSchedule = append(aggregateSchedule, batch...)
					}
				}
			}
		}

		if len(aggregateSchedule) > 0 {
			action = "propose_schedule"
			actionData = aggregateSchedule
			aiText += "\n\n📅 **I have drafted a schedule for you.** Please review it below."
		} else {
			aiText += "\n\n*(Error: Data format invalid. Could not parse schedule.)*"
		}
	}

	// 3. Rule Creation (Existing Logic)
	if idx := strings.Index(aiText, "[[CREATE_RULE:"); idx != -1 {
		endIdx := strings.Index(aiText[idx:], "]]")
		if endIdx != -1 {
			jsonStr := aiText[idx+14 : idx+endIdx]
			var rule model.ScoringRule
			if err := json.Unmarshal([]byte(jsonStr), &rule); err == nil {
				rule.IsActive = true
				if err := h.repo.CreateRule(&rule); err == nil {
					aiText = strings.Replace(aiText, aiText[idx:idx+endIdx+2], fmt.Sprintf("\n\n✅ Rule '%s' created successfully.", rule.Name), 1)
				} else {
					aiText = strings.Replace(aiText, aiText[idx:idx+endIdx+2], "\n\n❌ Failed to save rule.", 1)
				}
			}
		}
	}

	aiText = strings.TrimSpace(aiText)

	return c.JSON(ChatResponse{
		Reply:  aiText,
		Action: action,
		Data:   actionData,
	})
}

// HandleSyncSchedule creates calendar events from the client
func (h *ChatHandler) HandleSyncSchedule(c *fiber.Ctx) error {
	var req struct {
		Events []map[string]interface{} `json:"events"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Get user from token
	// TODO: Replace with actual JWT parsing
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, _ := h.repo.GetUserByEmail(userEmail)

	if user == nil || user.GoogleAccessToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Calendar not connected"})
	}

	// Prepare events for batch processing
	var calendarEvents []adapter.CalendarEvent

	for _, event := range req.Events {
		title, _ := event["title"].(string)
		start, _ := event["start"].(string)
		end, _ := event["end"].(string)

		startTime, err := time.Parse(time.RFC3339, start)
		if err != nil {
			log.Printf("ERROR: Invalid Start Time for '%s': %s", title, err)
			continue
		}
		endTime, err := time.Parse(time.RFC3339, end)
		if err != nil {
			log.Printf("ERROR: Invalid End Time for '%s': %s", title, err)
			continue
		}

		calendarEvents = append(calendarEvents, adapter.CalendarEvent{
			Title:     title,
			StartTime: startTime,
			EndTime:   endTime,
		})
	}

	log.Printf("DEBUG: Starting Batch Sync for %d events", len(calendarEvents))

	success, failed, err := h.calendar.BatchCreateEvents(user, calendarEvents)
	if err != nil {
		log.Printf("CRITICAL: Batch Sync failed to start: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to connect to calendar"})
	}

	log.Printf("DEBUG: Batch Sync Complete. Success: %d, Failed: %d", success, failed)

	if success == 0 && failed > 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to sync events. Failed: %d", failed)})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Synced %d events. Failed: %d. (Total: %d)", success, failed, len(calendarEvents)),
	})
}

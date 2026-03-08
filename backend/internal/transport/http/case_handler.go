package http

import (
	"Hercules/backend/internal/core/model"
	"Hercules/backend/internal/core/repository"
	"Hercules/backend/internal/core/service"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

type CaseHandler struct {
	repo    repository.Repository
	scoring *service.ScoringService
}

func NewCaseHandler(repo repository.Repository, scoring *service.ScoringService) *CaseHandler {
	return &CaseHandler{repo: repo, scoring: scoring}
}

func (h *CaseHandler) GetCases(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	cases, err := h.repo.GetCasesByAccount(user.AccountID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch cases"})
	}
	return c.JSON(cases)
}

func (h *CaseHandler) CreateCase(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	var k model.Case
	if err := c.BodyParser(&k); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Always enforce the authenticated user's account — never trust the client-supplied account_id.
	k.AccountID = user.AccountID
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	if k.CreatedAt.IsZero() {
		k.CreatedAt = time.Now()
	}
	if k.Status == "" {
		k.Status = "new"
	}
	if k.ExtData == nil {
		k.ExtData = make(map[string]interface{})
	}

	if err := h.repo.CreateCase(&k); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create case"})
	}

	accountID := user.AccountID.String()
	go h.scoring.RecalculateScoresForAccount(accountID)

	return c.Status(fiber.StatusCreated).JSON(k)
}

func (h *CaseHandler) UpdateCase(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	id := c.Params("id")
	var req model.Case
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	k, err := h.repo.GetCaseByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Case not found"})
	}

	// Ensure the case belongs to the authenticated user's account.
	if k.AccountID != user.AccountID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	if req.Title != "" {
		k.Title = req.Title
	}
	if req.Status != "" {
		k.Status = req.Status
	}
	if req.ExtData != nil {
		k.ExtData = req.ExtData
	}

	if err := h.repo.UpdateCase(k); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update case"})
	}

	accountID := user.AccountID.String()
	go h.scoring.RecalculateScoresForAccount(accountID)

	return c.JSON(k)
}

// getCol safely retrieves a column value by index.
func getCol(row []string, index int) string {
	if index < len(row) {
		return row[index]
	}
	return ""
}

// parseMoney strips currency formatting and parses a float.
func parseMoney(s string) float64 {
	clean := strings.ReplaceAll(s, "$", "")
	clean = strings.ReplaceAll(clean, ",", "")
	val, _ := strconv.ParseFloat(clean, 64)
	return val
}

// resolveAttorney returns the UUID of the first matching user for a given attorney name string.
// It checks full-name match first, then initials match.
func resolveAttorney(leadAttorney string, userMap map[string]uuid.UUID, initialsMap map[string]uuid.UUID) *uuid.UUID {
	normalize := func(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

	delimiters := []string{"/", ",", "&", " and "}
	clean := leadAttorney
	for _, d := range delimiters {
		clean = strings.ReplaceAll(clean, d, ",")
	}

	for _, rawName := range strings.Split(clean, ",") {
		name := normalize(rawName)
		if name == "" {
			continue
		}
		if id, ok := userMap[name]; ok {
			return &id
		}
		if id, ok := initialsMap[name]; ok {
			return &id
		}
	}
	return nil
}

func (h *CaseHandler) ImportCases(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File required"})
	}
	// Reject files larger than 5 MB.
	if file.Size > 5*1024*1024 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "File too large (max 5 MB)"})
	}

	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer f.Close()

	xlsx, err := excelize.OpenReader(f)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Excel file"})
	}

	// Build user lookup maps once, outside the row loop.
	accountUsers, _ := h.repo.GetUsersByAccount(user.AccountID.String())
	userMap := make(map[string]uuid.UUID)     // full name (lower) -> UUID
	initialsMap := make(map[string]uuid.UUID) // initials (lower) -> UUID
	for _, u := range accountUsers {
		if u.FullName == "" {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(u.FullName))
		userMap[key] = u.ID

		parts := strings.Fields(u.FullName)
		initials := ""
		for _, p := range parts {
			if len(p) > 0 {
				initials += strings.ToLower(string(p[0]))
			}
		}
		if initials != "" {
			initialsMap[initials] = u.ID
		}
	}

	importedCount := 0
	skippedCount := 0

	type SkippedDetail struct {
		Line   string `json:"line"`
		Title  string `json:"title"`
		Reason string `json:"reason"`
	}
	var skippedDetails []SkippedDetail

	type InconsistencyReport struct {
		Title     string `json:"title"`
		Field     string `json:"field"`
		DBValue   string `json:"db_value"`
		FileValue string `json:"file_value"`
	}
	var reports []InconsistencyReport

	for _, sheetName := range xlsx.GetSheetList() {
		rows, err := xlsx.GetRows(sheetName)
		if err != nil {
			continue
		}

		headerMap := make(map[string]int)
		if len(rows) > 0 {
			for i, cell := range rows[0] {
				headerMap[strings.TrimSpace(strings.ToLower(cell))] = i
			}
		}

		getVal := func(row []string, headers []string, fallbackIdx int) string {
			for _, hdr := range headers {
				if idx, ok := headerMap[strings.ToLower(hdr)]; ok {
					return getCol(row, idx)
				}
			}
			return getCol(row, fallbackIdx)
		}

		for i, row := range rows {
			if i == 0 || len(row) < 1 {
				continue
			}

			title := getVal(row, []string{"Client/Case", "Title", "Case"}, 0)
			if title == "" {
				skippedCount++
				skippedDetails = append(skippedDetails, SkippedDetail{
					Line:   fmt.Sprintf("%d", i+1),
					Reason: "missing title",
				})
				continue
			}

			phase := getVal(row, []string{"Fase", "Phase"}, 1)
			charges := getVal(row, []string{"Charges"}, 2)
			lastHearing := getVal(row, []string{"Last Hearing"}, 3)
			nextCourtDate := getVal(row, []string{"Next Court Date"}, 4)
			jurisdiction := getVal(row, []string{"Jurisdiction"}, 5)
			pendingActions := getVal(row, []string{"Pending Actions"}, 6)
			jailVisitStr := getVal(row, []string{"Jail Visit"}, 7)
			jailVisit := strings.ToLower(jailVisitStr) == "yes" || strings.ToLower(jailVisitStr) == "true"
			clientProfile := getVal(row, []string{"Client Profile"}, 8)
			lastInteraction := getVal(row, []string{"Last Interaction"}, 9)
			balanceDue := parseMoney(getVal(row, []string{"Balance Due"}, 10))
			currentOrPastDue := getVal(row, []string{"Current or Past Due"}, 11)

			lastPaymentDateStr := getVal(row, []string{"Last Payment Date"}, 12)
			var lastPaymentDate time.Time
			for _, layout := range []string{"2006-01-02", "01-02-06", "1/2/06"} {
				if t, err := time.Parse(layout, lastPaymentDateStr); err == nil {
					lastPaymentDate = t
					break
				}
			}

			lastPaymentAmount := parseMoney(getVal(row, []string{"Last Payment Amount"}, 13))
			pastDueAmount := parseMoney(getVal(row, []string{"Past Due Amount"}, 14))
			leadAttorney := getVal(row, []string{"Lead Attorney", "Attorney", "Lawyer"}, 15)

			assignedUserID := resolveAttorney(leadAttorney, userMap, initialsMap)

			status := "new"
			if leadAttorney != "" {
				status = "ongoing"
			}

			existing, _ := h.repo.GetCaseByTitle(title)
			if existing != nil && existing.ID != uuid.Nil {
				if existing.AccountID != user.AccountID {
					reports = append(reports, InconsistencyReport{
						Title:     title,
						Field:     "account_id",
						DBValue:   existing.AccountID.String(),
						FileValue: user.AccountID.String(),
					})
				}
				existing.Phase = phase
				existing.Charges = charges
				existing.LastHearing = lastHearing
				existing.NextCourtDate = nextCourtDate
				existing.Jurisdiction = jurisdiction
				existing.PendingActions = pendingActions
				existing.JailVisit = jailVisit
				existing.ClientProfile = clientProfile
				existing.LastInteraction = lastInteraction
				existing.BalanceDue = balanceDue
				existing.CurrentOrPastDue = currentOrPastDue
				existing.LastPaymentDate = lastPaymentDate
				existing.LastPaymentAmount = lastPaymentAmount
				existing.PastDueAmount = pastDueAmount
				existing.LeadAttorney = leadAttorney
				existing.Status = status
				if assignedUserID != nil {
					existing.AssignedUserID = assignedUserID
				}
				if err := h.repo.UpdateCase(existing); err == nil {
					importedCount++
				}
				continue
			}

			newCase := model.Case{
				BaseModel: model.BaseModel{
					ID:        uuid.New(),
					CreatedAt: time.Now(),
				},
				AccountID:         user.AccountID,
				Title:             title,
				Status:            status,
				AssignedUserID:    assignedUserID,
				Phase:             phase,
				Charges:           charges,
				LastHearing:       lastHearing,
				NextCourtDate:     nextCourtDate,
				Jurisdiction:      jurisdiction,
				PendingActions:    pendingActions,
				JailVisit:         jailVisit,
				ClientProfile:     clientProfile,
				LastInteraction:   lastInteraction,
				BalanceDue:        balanceDue,
				CurrentOrPastDue:  currentOrPastDue,
				LastPaymentDate:   lastPaymentDate,
				LastPaymentAmount: lastPaymentAmount,
				PastDueAmount:     pastDueAmount,
				LeadAttorney:      leadAttorney,
				ExtData:           map[string]interface{}{"is_imported": true},
			}

			if err := h.repo.CreateCase(&newCase); err == nil {
				importedCount++
			} else {
				skippedCount++
				skippedDetails = append(skippedDetails, SkippedDetail{
					Line:   fmt.Sprintf("%d", i+1),
					Title:  title,
					Reason: "database error",
				})
			}
		}
	}

	if importedCount > 0 {
		go h.scoring.RecalculateScoresForAccount(user.AccountID.String())
	}

	return c.JSON(fiber.Map{
		"message":         "Import processed",
		"imported":        importedCount,
		"skipped":         skippedCount,
		"skipped_details": skippedDetails,
		"inconsistencies": reports,
	})
}

func (h *CaseHandler) ExportCases(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, _ := h.repo.GetUserByEmail(userEmail)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	cases, err := h.repo.GetCasesByAccount(user.AccountID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch cases"})
	}

	xl := excelize.NewFile()
	sheetName := "Cases"
	index, _ := xl.NewSheet(sheetName)
	xl.SetActiveSheet(index)
	xl.DeleteSheet("Sheet1")

	headers := []string{
		"Client/Case", "Fase", "Charges", "Last Hearing", "Next Court Date",
		"Jurisdiction", "Pending Actions", "Jail Visit", "Client Profile",
		"Last Interaction", "Balance Due", "Current or Past Due",
		"Last Payment Date", "Last Payment Amount", "Past Due Amount", "Lead Attorney",
	}

	style, _ := xl.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	for i, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		xl.SetCellValue(sheetName, cell, hdr)
		xl.SetCellStyle(sheetName, cell, cell, style)
	}

	for i, k := range cases {
		rowNum := i + 2
		jailVisitStr := "No"
		if k.JailVisit {
			jailVisitStr = "Yes"
		}
		xl.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), k.Title)
		xl.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), k.Phase)
		xl.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), k.Charges)
		xl.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), k.LastHearing)
		xl.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), k.NextCourtDate)
		xl.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), k.Jurisdiction)
		xl.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), k.PendingActions)
		xl.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), jailVisitStr)
		xl.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), k.ClientProfile)
		xl.SetCellValue(sheetName, fmt.Sprintf("J%d", rowNum), k.LastInteraction)
		xl.SetCellValue(sheetName, fmt.Sprintf("K%d", rowNum), k.BalanceDue)
		xl.SetCellValue(sheetName, fmt.Sprintf("L%d", rowNum), k.CurrentOrPastDue)
		xl.SetCellValue(sheetName, fmt.Sprintf("M%d", rowNum), k.LastPaymentDate.Format("2006-01-02"))
		xl.SetCellValue(sheetName, fmt.Sprintf("N%d", rowNum), k.LastPaymentAmount)
		xl.SetCellValue(sheetName, fmt.Sprintf("O%d", rowNum), k.PastDueAmount)
		xl.SetCellValue(sheetName, fmt.Sprintf("P%d", rowNum), k.LeadAttorney)
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=cases_export.xlsx")

	if err := xl.Write(c.Response().BodyWriter()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate Excel"})
	}
	return nil
}

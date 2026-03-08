package http

import (
	"Hercules/backend/internal/auth"
	"Hercules/backend/internal/core/model"
	"Hercules/backend/internal/core/repository"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	googleidtoken "google.golang.org/api/idtoken"
)

// oauthStateStore holds short-lived CSRF state tokens for the OAuth flow.
type oauthStateStore struct {
	mu     sync.Mutex
	states map[string]time.Time
}

func (s *oauthStateStore) create() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = time.Now().Add(5 * time.Minute)
	s.mu.Unlock()
	return state, nil
}

func (s *oauthStateStore) verify(state string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.states[state]
	if !ok {
		return false
	}
	delete(s.states, state)
	return time.Now().Before(exp)
}

type AuthHandler struct {
	repo        repository.Repository
	oauthConfig *oauth2.Config
	stateStore  *oauthStateStore
}

func NewAuthHandler(repo repository.Repository) *AuthHandler {
	b, err := os.ReadFile("credentials.json")
	var config *oauth2.Config
	if err != nil {
		log.Printf("Warning: credentials.json not found. Trying Env Vars...")
		clientID := os.Getenv("GOOGLE_CLIENT_ID")
		clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
		if clientID != "" && clientSecret != "" {
			config = &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: clientSecret,
				RedirectURL:  "http://localhost:5173/auth/google/callback",
				Scopes:       []string{calendar.CalendarScope, "https://www.googleapis.com/auth/userinfo.email"},
				Endpoint:     google.Endpoint,
			}
		} else {
			log.Println("Error: No Google Credentials found. OAuth will fail.")
		}
	} else {
		config, err = google.ConfigFromJSON(b, calendar.CalendarScope, "https://www.googleapis.com/auth/userinfo.email")
		if err != nil {
			log.Printf("Error parsing credentials.json: %v", err)
		}
	}

	return &AuthHandler{
		repo:        repo,
		oauthConfig: config,
		stateStore:  &oauthStateStore{states: make(map[string]time.Time)},
	}
}

func (h *AuthHandler) OAuth() *oauth2.Config {
	return h.oauthConfig
}

func (h *AuthHandler) LoginGoogle(c *fiber.Ctx) error {
	if h.oauthConfig == nil {
		return c.Status(500).SendString("Google Auth not configured")
	}
	state, err := h.stateStore.create()
	if err != nil {
		return c.Status(500).SendString("Failed to generate state")
	}
	url := h.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return c.Redirect(url)
}

func (h *AuthHandler) CallbackGoogle(c *fiber.Ctx) error {
	state := c.Query("state")
	if !h.stateStore.verify(state) {
		return c.Status(400).SendString("Invalid or expired state parameter")
	}

	code := c.Query("code")
	if code == "" {
		return c.Status(400).SendString("Code not found")
	}

	token, err := h.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return c.Status(500).SendString("Token exchange failed")
	}

	client := h.oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return c.Status(500).SendString("Failed to fetch user info from Google")
	}
	defer resp.Body.Close()

	var userInfo struct {
		Email string `json:"email"`
		Id    string `json:"id"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return c.Status(500).SendString("Failed to parse user info")
	}

	if userInfo.Email == "" {
		return c.Status(400).SendString("No email found in Google User Info")
	}

	user, err := h.repo.GetUserByEmail(userInfo.Email)
	if err != nil || user == nil {
		log.Printf("User %s not found. Creating new account.", userInfo.Email)

		parts := strings.Split(userInfo.Email, "@")
		if len(parts) != 2 {
			return c.Status(400).SendString("Invalid email format")
		}
		domain := parts[1]

		account, _ := h.repo.GetAccountByDomain(domain)
		if account == nil {
			log.Printf("CRITICAL: No Account found for new user %s", userInfo.Email)
			return c.Status(500).SendString("Organization not found")
		}

		newUser := &model.User{
			Email:     userInfo.Email,
			Role:      "lawyer",
			AccountID: account.ID,
			FullName:  userInfo.Name,
		}
		if err := h.repo.CreateUser(newUser); err != nil {
			log.Printf("Error creating user: %v", err)
			return c.Status(500).SendString("Failed to create new user")
		}
		user, _ = h.repo.GetUserByEmail(userInfo.Email)
	}

	if user == nil {
		return c.Status(500).SendString("Failed to load user")
	}

	user.GoogleAccessToken = token.AccessToken
	user.GoogleRefreshToken = token.RefreshToken
	user.GoogleTokenExpiry = token.Expiry
	if userInfo.Name != "" {
		user.FullName = userInfo.Name
	}

	if err := h.repo.UpdateUser(user); err != nil {
		return c.Status(500).SendString("Failed to update user tokens")
	}

	sessionToken, err := auth.SignToken(user.Email, user.ID.String(), user.Role)
	if err != nil {
		return c.Status(500).SendString("Failed to generate session token")
	}

	// Pass token in URL fragment — not sent to servers in Referer headers and not logged by proxies.
	return c.Redirect("http://localhost:5173/dashboard#auth=success&token=" + sessionToken + "&email=" + user.Email)
}

type LoginRequest struct {
	IDToken string `json:"id_token"`
	Email   string `json:"email"`
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")

	var email string
	if req.IDToken != "" {
		payload, err := googleidtoken.Validate(context.Background(), req.IDToken, clientID)
		if err != nil {
			log.Printf("Google ID token validation failed: %v", err)
			return c.Status(401).JSON(fiber.Map{"error": "Invalid Google token"})
		}
		if e, ok := payload.Claims["email"].(string); ok {
			email = e
		}
	}

	// Dev fallback: allow plain email if no ID token (remove before production).
	if email == "" && req.Email != "" {
		log.Println("Warning: using unverified email from request body (no ID token)")
		email = req.Email
	}

	if email == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Email is required"})
	}

	user, err := h.repo.GetUserByEmail(email)
	if err != nil || user == nil {
		log.Printf("User %s not found in Login. Creating new account.", email)

		parts := strings.Split(email, "@")
		if len(parts) != 2 {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid email format"})
		}
		domain := parts[1]

		account, _ := h.repo.GetAccountByDomain(domain)
		if account == nil {
			log.Printf("Account '%s' not found.", domain)
			return c.Status(500).JSON(fiber.Map{"error": "Organization not found for domain " + domain})
		}

		newUser := &model.User{
			Email:     email,
			Role:      "lawyer",
			AccountID: account.ID,
		}
		if err := h.repo.CreateUser(newUser); err != nil {
			log.Printf("Failed to create user: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
		}
		user, _ = h.repo.GetUserByEmail(email)
	}

	if user == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load user"})
	}

	hasCalendar := user.GoogleAccessToken != "" && user.GoogleRefreshToken != ""

	sessionToken, err := auth.SignToken(user.Email, user.ID.String(), user.Role)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate session token"})
	}

	return c.JSON(fiber.Map{
		"token": sessionToken,
		"user": fiber.Map{
			"id":                  user.ID,
			"email":               user.Email,
			"role":                user.Role,
			"has_calendar_linked": hasCalendar,
		},
	})
}

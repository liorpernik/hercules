package http

import (
	"Hercules/backend/internal/core/repository"
	"Hercules/backend/internal/core/model"

	"github.com/gofiber/fiber/v2"
)

var allowedRoles = map[string]bool{"admin": true, "lawyer": true}

type UserHandler struct {
	repo repository.Repository
}

func NewUserHandler(repo repository.Repository) *UserHandler {
	return &UserHandler{repo: repo}
}

func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func (h *UserHandler) GetAllUsers(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil || user.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	users, err := h.repo.GetUsersByAccount(user.AccountID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch users"})
	}
	return c.JSON(sanitizeUsers(users))
}

func (h *UserHandler) UpdateUserRole(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	reqUser, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || reqUser == nil || reqUser.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	id := c.Params("id")
	var req struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid input"})
	}
	if !allowedRoles[req.Role] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid role. Allowed: admin, lawyer"})
	}

	user, err := h.repo.GetUserByID(id)
	if err != nil || user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	// Ensure target user belongs to the same account.
	if user.AccountID != reqUser.AccountID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Cannot modify users outside your organization"})
	}

	user.Role = req.Role
	if err := h.repo.UpdateUser(user); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update role"})
	}
	return c.JSON(user)
}

func (h *UserHandler) UpdateUserProfile(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	requester, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || requester == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")

	// Only the user themselves or an admin in the same account may update a profile.
	if requester.ID.String() != id && requester.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	user, err := h.repo.GetUserByID(id)
	if err != nil || user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	// Admins can only modify users within their own account.
	if user.AccountID != requester.AccountID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Cannot modify users outside your organization"})
	}

	var req struct {
		Location       string `json:"location"`
		SeniorityLevel string `json:"seniority_level"`
		FullName       string `json:"full_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid input"})
	}

	if req.Location != "" {
		user.Location = req.Location
	}
	if req.SeniorityLevel != "" {
		user.SeniorityLevel = req.SeniorityLevel
	}
	if req.FullName != "" {
		user.FullName = req.FullName
	}

	if err := h.repo.UpdateUser(user); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update profile"})
	}
	return c.JSON(user)
}

// sanitizeUsers strips OAuth tokens from user objects before returning them.
func sanitizeUsers(users []model.User) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		result = append(result, map[string]interface{}{
			"id":              u.ID,
			"email":           u.Email,
			"full_name":       u.FullName,
			"role":            u.Role,
			"location":        u.Location,
			"seniority_level": u.SeniorityLevel,
			"account_id":      u.AccountID,
			"created_at":      u.CreatedAt,
		})
	}
	return result
}

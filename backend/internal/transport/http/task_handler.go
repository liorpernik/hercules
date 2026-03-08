package http

import (
	"Hercules/backend/internal/core/repository"
	"Hercules/backend/internal/core/model"
	"time"

	"github.com/gofiber/fiber/v2"
)

type TaskHandler struct {
	repo repository.Repository
}

func NewTaskHandler(repo repository.Repository) *TaskHandler {
	return &TaskHandler{repo: repo}
}

// GetTasks returns all NON-COMPLETED tasks for the user by default, or all if ?all=true
func (h *TaskHandler) GetTasks(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	// We'll reuse the existing repository method which filters non-completed
	// TODO: Enhance repo method to allow filtering if needed, for new just fetch what's active usually
	tasks, err := h.repo.GetPersonalTasks(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch tasks"})
	}

	return c.JSON(tasks)
}

// CreateTask adds a new task
func (h *TaskHandler) CreateTask(c *fiber.Ctx) error {
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	var req struct {
		Title             string `json:"title"`
		Description       string `json:"description"`
		EstimatedDuration string `json:"estimated_duration"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title is required"})
	}

	newTask := model.PersonalTask{
		UserID:            user.ID,
		Title:             req.Title,
		Description:       req.Description,
		Status:            "pending",
		EstimatedDuration: req.EstimatedDuration,
	}

	if err := h.repo.CreatePersonalTask(&newTask); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create task"})
	}

	return c.Status(fiber.StatusCreated).JSON(newTask)
}

// UpdateTask updates status or details
func (h *TaskHandler) UpdateTask(c *fiber.Ctx) error {
	id := c.Params("id")
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	task, err := h.repo.GetPersonalTaskByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.UserID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var req struct {
		Title             string `json:"title"`
		Description       string `json:"description"`
		Status            string `json:"status"`
		EstimatedDuration string `json:"estimated_duration"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Title != "" {
		task.Title = req.Title
	}
	if req.Description != "" {
		task.Description = req.Description
	}
	if req.Status != "" {
		task.Status = req.Status
	}
	if req.EstimatedDuration != "" {
		task.EstimatedDuration = req.EstimatedDuration
	}
	task.UpdatedAt = time.Now()

	if err := h.repo.UpdatePersonalTask(task); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update task"})
	}

	return c.JSON(task)
}

// DeleteTask
func (h *TaskHandler) DeleteTask(c *fiber.Ctx) error {
	id := c.Params("id")
	userEmail, ok := c.Locals("user").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := h.repo.GetUserByEmail(userEmail)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	if err := h.repo.DeletePersonalTask(id, user.ID.String()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete task"})
	}

	return c.JSON(fiber.Map{"success": true})
}

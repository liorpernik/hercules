package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/adapter/repository"
	"Hercules/backend/internal/auth"
	"Hercules/backend/internal/core/model"
	"Hercules/backend/internal/core/service"
	httphandler "Hercules/backend/internal/transport/http"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	log.Println("Starting Hercules Backend...")
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}

	app := fiber.New(fiber.Config{
		// Limit upload body to 10 MB to prevent DoS via large file uploads.
		BodyLimit: 10 * 1024 * 1024,
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:5173",
		AllowHeaders: "Origin, Content-Type, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}

	if err = db.AutoMigrate(&model.Account{}, &model.User{}, &model.Case{}, &model.ScoringRule{}, &model.PersonalTask{}); err != nil {
		log.Printf("Migration warning: %v", err)
	}

	repo := repository.NewPostgresRepository(db)

	scoringService := service.NewScoringService(repo)

	caseHandler := httphandler.NewCaseHandler(repo, scoringService)
	authHandler := httphandler.NewAuthHandler(repo)
	chatHandler := httphandler.NewChatHandler(repo, authHandler.OAuth())
	userHandler := httphandler.NewUserHandler(repo)
	taskHandler := httphandler.NewTaskHandler(repo)

	// Open Routes
	apiOpen := app.Group("/api")
	apiOpen.Post("/auth/login", authHandler.Login)
	app.Get("/auth/google/login", authHandler.LoginGoogle)
	app.Get("/auth/google/callback", authHandler.CallbackGoogle)

	// JWT Auth Middleware
	api := app.Group("/api", func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing Authorization header"})
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid Authorization header format"})
		}
		claims, err := auth.VerifyToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
		}
		c.Locals("user", claims.Email)
		c.Locals("user_id", claims.UserID)
		c.Locals("user_role", claims.Role)
		return c.Next()
	})

	api.Post("/ai/chat", chatHandler.HandleChat)
	api.Post("/calendar/sync-schedule", chatHandler.HandleSyncSchedule)

	api.Get("/cases", caseHandler.GetCases)
	api.Post("/cases", caseHandler.CreateCase)
	api.Put("/cases/:id", caseHandler.UpdateCase)
	api.Post("/cases/import", caseHandler.ImportCases)
	api.Get("/cases/export", caseHandler.ExportCases)

	api.Get("/tasks", taskHandler.GetTasks)
	api.Post("/tasks", taskHandler.CreateTask)
	api.Put("/tasks/:id", taskHandler.UpdateTask)
	api.Delete("/tasks/:id", taskHandler.DeleteTask)

	api.Get("/users/me", userHandler.GetMe)
	api.Get("/users", userHandler.GetAllUsers)
	api.Put("/users/:id/role", userHandler.UpdateUserRole)
	api.Put("/users/:id/profile", userHandler.UpdateUserProfile)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "Hercules API"})
	})

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:5173"
	}

	log.Fatal(app.Listen(":8080"))
}

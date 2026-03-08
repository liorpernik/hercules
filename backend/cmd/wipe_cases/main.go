package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/core/model"
	"log"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, relying on system env vars")
	}

	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Wiping ALL cases from database...")

	// Delete all cases
	// Using Unscoped to ensure they are permanently removed if using soft deletes,
	// though model.Case uses BaseModel which might have DeletedAt.
	// To start fresh for Excel upload, Unscoped is usually what is wanted.
	if err := db.Unscoped().Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Case{}).Error; err != nil {
		log.Fatalf("Error deleting cases: %v", err)
	}

	log.Println("Successfully wiped all cases.")
}

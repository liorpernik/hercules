package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/core/model"
	"flag"
	"log"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}

	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}

	db.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

	err = db.AutoMigrate(&model.Account{}, &model.User{}, &model.Case{})
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// 1. Ensure account exists
	account := model.Account{
		Name:   "Pernik Law",
		Domain: "perniklaw.com",
	}
	if err := db.FirstOrCreate(&account, model.Account{Name: "Pernik Law"}).Error; err != nil {
		log.Fatalf("Error ensuring account exists: %v", err)
	}
	if account.Domain == "" {
		if err := db.Model(&account).Update("domain", "perniklaw.com").Error; err != nil {
			log.Printf("Warning: Failed to update account domain: %v", err)
		}
		account.Domain = "perniklaw.com"
	}

	log.Printf("Using Account: %s (ID: %s)", account.Name, account.ID)

	emailFlag := flag.String("email", "", "Admin email address to create (required)")
	resetFlag := flag.Bool("reset", false, "Delete ALL existing cases for this account before seeding")
	flag.Parse()

	targetEmail := *emailFlag
	if targetEmail == "" {
		log.Fatal("Usage: seed -email admin@yourfirm.com")
	}

	if *resetFlag {
		log.Println("Deleting all existing cases for this account...")
		if err := db.Where("account_id = ?", account.ID).Delete(&model.Case{}).Error; err != nil {
			log.Printf("Warning: Failed to delete cases: %v", err)
		} else {
			log.Println("All cases deleted.")
		}
	}

	// 2. Create admin user if not exists
	var user model.User
	if err := db.Where("email = ?", targetEmail).First(&user).Error; err != nil {
		user = model.User{
			AccountID:    account.ID,
			Email:        targetEmail,
			Role:         "admin",
			AuthProvider: "google",
		}
		if err := db.Create(&user).Error; err != nil {
			log.Printf("Failed to create admin user: %v", err)
		} else {
			log.Printf("Created Admin User: %s", user.Email)
		}
	} else {
		log.Printf("User %s already exists.", user.Email)
	}

	log.Println("Seeding complete!")
}

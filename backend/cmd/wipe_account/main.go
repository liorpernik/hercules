package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/core/model"
	"log"
)

func main() {
	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Cleaning up mock data...")

	// Delete known mock accounts hard
	mockNames := []string{"Pernik Law", "Hercules Demo Firm"}

	// 1. Find the accounts
	var accounts []model.Account
	if err := db.Unscoped().Where("name IN ?", mockNames).Find(&accounts).Error; err != nil {
		log.Fatalf("Failed to find accounts: %v", err)
	}

	if len(accounts) == 0 {
		log.Println("No mock accounts found.")
		return
	}

	var accountIDs []string
	for _, acc := range accounts {
		accountIDs = append(accountIDs, acc.ID.String())
	}

	log.Printf("Found %d accounts to cleanup: %v", len(accounts), accountIDs)

	// 2. Delete Cases
	if err := db.Unscoped().Where("account_id IN ?", accountIDs).Delete(&model.Case{}).Error; err != nil {
		log.Printf("Error deleting cases: %v", err)
	} else {
		log.Println("Deleted associated cases.")
	}

	// 3. Delete Users
	if err := db.Unscoped().Where("account_id IN ?", accountIDs).Delete(&model.User{}).Error; err != nil {
		log.Printf("Error deleting users: %v", err)
	} else {
		log.Println("Deleted associated users.")
	}

	// 4. Delete Accounts
	result := db.Unscoped().Where("id IN ?", accountIDs).Delete(&model.Account{})

	if result.Error != nil {
		log.Fatalf("Failed to delete account: %v", result.Error)
	}

	log.Printf("Deleted mock accounts (Rows Affected: %d)", result.RowsAffected)
}

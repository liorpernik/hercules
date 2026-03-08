package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/core/model"
	"fmt"
	"log"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}

	var count int64
	db.Model(&model.Case{}).Count(&count)
	fmt.Printf("Active Cases in DB: %d\n", count)

	var unscopedCount int64
	db.Model(&model.Case{}).Unscoped().Count(&unscopedCount)
	fmt.Printf("Total Cases (including soft deleted): %d\n", unscopedCount)

	if count > 0 {
		var cases []model.Case
		db.Limit(5).Find(&cases)
		fmt.Println("First 5 active cases:")
		for _, c := range cases {
			fmt.Printf("- %s (ID: %s)\n", c.Title, c.ID)
		}
	}
}

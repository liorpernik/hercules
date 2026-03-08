package main

import (
	"Hercules/backend/internal/adapter/database"
	"Hercules/backend/internal/adapter/repository"
	"fmt"
	"log"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatal(err)
	}
	repo := repository.NewPostgresRepository(db)
	users, _ := repo.GetAllUsers()
	fmt.Println("--- CURRENT USERS ---")
	for _, u := range users {
		fmt.Printf("User: %s | ID: %s | Role: %s\n", u.Email, u.ID, u.Role)
	}
}

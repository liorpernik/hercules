package database

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewPostgresConnection() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	// dsn = "host=localhost user=postgres password=password dbname=hercules port=5432 sslmode=disable"

	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	log.Println("Connecting to PostgreSQL...")
	db, err := gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Connected to PostgreSQL via GORM")
	return db, nil
}

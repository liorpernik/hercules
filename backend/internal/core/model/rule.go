package model

import (
	"github.com/google/uuid"
)

type ScoringRule struct {
	BaseModel
	AccountID   uuid.UUID              `json:"account_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Condition   map[string]interface{} `gorm:"serializer:json" json:"condition"`
	ScoreEffect int                    `json:"score_effect"`
	IsActive    bool                   `json:"is_active"`
}

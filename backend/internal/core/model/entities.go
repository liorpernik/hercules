package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Account struct {
	BaseModel
	Name   string `json:"name"`
	Domain string `json:"domain"` // e.g. "perniklaw.com"
	Users  []User `json:"users,omitempty"`
}

type User struct {
	BaseModel
	AccountID        uuid.UUID              `json:"account_id"`
	Account          Account                `json:"account,omitempty"`
	Email            string                 `gorm:"uniqueIndex" json:"email"`
	FullName         string                 `json:"full_name"` // From SSO or Settings
	Role             string                 `json:"role"`      // admin, lawyer
	AuthProvider     string                 `json:"auth_provider"`
	SSOAttributes    map[string]interface{} `gorm:"serializer:json" json:"sso_attributes"`
	CustomAttributes map[string]interface{} `gorm:"serializer:json" json:"custom_attributes"`
	Location         string                 `json:"location"`
	SeniorityLevel   string                 `json:"seniority_level"`
	// Google Calendar Tokens
	// TODO: Encrypt these fields in production
	GoogleAccessToken  string    `json:"-"`
	GoogleRefreshToken string    `json:"-"`
	GoogleTokenExpiry  time.Time `json:"-"`
}

type Case struct {
	BaseModel
	AccountID         uuid.UUID              `json:"account_id"`
	Title             string                 `json:"title"`
	Status            string                 `json:"status"` // new, ongoing, closed
	Source            string                 `json:"source"`
	AssignedUserID    *uuid.UUID             `json:"assigned_user_id"`
	PriorityScore     int                    `json:"priority_score"`
	Phase             string                 `json:"phase"`
	Charges           string                 `json:"charges"`
	LastHearing       string                 `json:"last_hearing"` // Keeping as string to allow flexible input or empty
	NextCourtDate     string                 `json:"next_court_date"`
	Jurisdiction      string                 `json:"jurisdiction"`
	PendingActions    string                 `json:"pending_actions"`
	JailVisit         bool                   `json:"jail_visit"` // Assuming boolean from "Jail Visit", but prompt said "Jail Visit" could be text? Prompt listed it as a column. Let's stick to string for maximum flexibility if unclear, but "Jail Visit" usually implies yes/no or date. User said "Jail Visit". Let's use string to be safe.
	ClientProfile     string                 `json:"client_profile"`
	LastInteraction   string                 `json:"last_interaction"`
	BalanceDue        float64                `json:"balance_due"`
	CurrentOrPastDue  string                 `json:"current_or_past_due"`
	LastPaymentDate   time.Time              `json:"last_payment_date"`
	LastPaymentAmount float64                `json:"last_payment_amount"`
	PastDueAmount     float64                `json:"past_due_amount"`
	LeadAttorney      string                 `json:"lead_attorney"`
	ExtData           map[string]interface{} `gorm:"serializer:json" json:"ext_data"`
}

type PersonalTask struct {
	BaseModel
	UserID            uuid.UUID `json:"user_id"`
	Title             string    `json:"title"`
	Description       string    `json:"description"`
	Status            string    `json:"status"`             // pending, scheduled, completed
	EstimatedDuration string    `json:"estimated_duration"` // 30m, 1h, etc.
}

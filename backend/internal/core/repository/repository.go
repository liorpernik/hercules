package repository

import (
	"Hercules/backend/internal/core/model"
)

type Repository interface {
	// Cases
	GetAllCases() ([]model.Case, error)
	GetCasesByAccount(accountID string) ([]model.Case, error)
	GetCaseByID(id string) (*model.Case, error)
	GetCaseByTitle(title string) (*model.Case, error)
	CreateCase(k *model.Case) error
	UpdateCase(k *model.Case) error
	DeleteMockCases(accountID string) error

	// Users
	GetUserByEmail(email string) (*model.User, error)
	GetUserByID(id string) (*model.User, error)
	GetAllUsers() ([]model.User, error)
	GetUsersByAccount(accountID string) ([]model.User, error)
	CreateUser(user *model.User) error
	UpdateUser(user *model.User) error

	// Accounts
	GetAccountByDomain(domain string) (*model.Account, error)

	// Scoring Rules
	CreateRule(rule *model.ScoringRule) error
	GetAllRules() ([]model.ScoringRule, error)
	GetRulesByAccount(accountID string) ([]model.ScoringRule, error)

	// Personal Tasks
	GetPersonalTasks(userID string) ([]model.PersonalTask, error)
	GetPersonalTaskByID(id string) (*model.PersonalTask, error)
	CreatePersonalTask(task *model.PersonalTask) error
	UpdatePersonalTask(task *model.PersonalTask) error
	DeletePersonalTask(id string, userID string) error
}

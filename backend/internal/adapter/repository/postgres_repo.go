package repository

import (
	"Hercules/backend/internal/core/model"

	"gorm.io/gorm"
)

type PostgresRepository struct {
	db *gorm.DB
}

func NewPostgresRepository(db *gorm.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetCasesByAccount(accountID string) ([]model.Case, error) {
	var cases []model.Case
	result := r.db.Where("account_id = ?", accountID).Find(&cases)
	return cases, result.Error
}

func (r *PostgresRepository) GetAllCases() ([]model.Case, error) {
	var cases []model.Case
	result := r.db.Find(&cases)
	return cases, result.Error
}

func (r *PostgresRepository) GetUserByEmail(email string) (*model.User, error) {
	var user model.User
	result := r.db.Preload("Account").Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (r *PostgresRepository) GetUserByID(id string) (*model.User, error) {
	var user model.User
	result := r.db.First(&user, "id = ?", id)
	return &user, result.Error
}

func (r *PostgresRepository) GetAccountByDomain(domain string) (*model.Account, error) {
	var account model.Account
	// Match by domain if set; fall back to a fuzzy name match for accounts without a domain yet.

	result := r.db.Where("domain = ? OR (domain = '' AND name ILIKE ?)", domain, "%"+domain+"%").First(&account)
	if result.Error != nil {
		return nil, result.Error
	}
	return &account, nil
}

func (r *PostgresRepository) CreateUser(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *PostgresRepository) DeleteMockCases(accountID string) error {
	// Use JSONB containment operator which is more robust for booleans
	return r.db.Where("account_id = ? AND ext_data @> '{\"is_mock\": true}'", accountID).Delete(&model.Case{}).Error
}

func (r *PostgresRepository) CreateRule(rule *model.ScoringRule) error {
	return r.db.Create(rule).Error
}

func (r *PostgresRepository) GetAllRules() ([]model.ScoringRule, error) {
	var rules []model.ScoringRule
	err := r.db.Find(&rules).Error
	return rules, err
}

func (r *PostgresRepository) GetRulesByAccount(accountID string) ([]model.ScoringRule, error) {
	var rules []model.ScoringRule
	err := r.db.Where("account_id = ?", accountID).Find(&rules).Error
	return rules, err
}

func (r *PostgresRepository) CreateCase(k *model.Case) error {
	return r.db.Create(k).Error
}

func (r *PostgresRepository) UpdateCase(k *model.Case) error {
	return r.db.Save(k).Error
}

func (r *PostgresRepository) GetCaseByID(id string) (*model.Case, error) {
	var k model.Case
	err := r.db.First(&k, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (r *PostgresRepository) GetCaseByTitle(title string) (*model.Case, error) {
	var k model.Case
	err := r.db.First(&k, "title = ?", title).Error
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (r *PostgresRepository) UpdateUser(u *model.User) error {
	return r.db.Save(u).Error
}

func (r *PostgresRepository) GetAllUsers() ([]model.User, error) {
	var users []model.User
	err := r.db.Find(&users).Error
	return users, err
}

func (r *PostgresRepository) GetPersonalTasks(userID string) ([]model.PersonalTask, error) {
	var tasks []model.PersonalTask
	err := r.db.Where("user_id = ? AND status != 'completed'", userID).Find(&tasks).Error
	return tasks, err
}

func (r *PostgresRepository) CreatePersonalTask(task *model.PersonalTask) error {
	return r.db.Create(task).Error
}

func (r *PostgresRepository) UpdatePersonalTask(task *model.PersonalTask) error {
	return r.db.Save(task).Error
}

func (r *PostgresRepository) DeletePersonalTask(id string, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.PersonalTask{}).Error
}

func (r *PostgresRepository) GetPersonalTaskByID(id string) (*model.PersonalTask, error) {
	var task model.PersonalTask
	err := r.db.First(&task, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// GetUsersByAccount fetches all users for an account
// This allows us to map "Lead Attorney" names to User IDs
func (r *PostgresRepository) GetUsersByAccount(accountID string) ([]model.User, error) {
	var users []model.User
	err := r.db.Where("account_id = ?", accountID).Find(&users).Error
	return users, err
}

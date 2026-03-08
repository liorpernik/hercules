package service

import (
	"Hercules/backend/internal/core/model"
	"Hercules/backend/internal/core/repository"
	"log"
	"strconv"
	"strings"
	"time"
)

type ScoringService struct {
	repo repository.Repository
}

func NewScoringService(repo repository.Repository) *ScoringService {
	return &ScoringService{repo: repo}
}

// GetBaselineRules defines hardcoded rules that ALWAYS apply.
func (s *ScoringService) GetBaselineRules() []model.ScoringRule {
	return []model.ScoringRule{
		{
			Name:        "Baseline: New Cases",
			IsActive:    true,
			ScoreEffect: 10,
			Condition:   map[string]interface{}{"field": "status", "operator": "eq", "value": "new"},
		},
		{
			Name:        "Baseline: Urgent Source",
			IsActive:    true,
			ScoreEffect: 20,
			Condition:   map[string]interface{}{"field": "title", "operator": "contains", "value": "urgent"},
		},
	}
}

// RecalculateScoresForAccount recalculates priority scores only for cases belonging to the given account.
func (s *ScoringService) RecalculateScoresForAccount(accountID string) error {
	cases, err := s.repo.GetCasesByAccount(accountID)
	if err != nil {
		return err
	}

	rules, err := s.repo.GetRulesByAccount(accountID)
	if err != nil {
		return err
	}

	// Prepend baseline rules
	rules = append(s.GetBaselineRules(), rules...)

	for _, k := range cases {
		newScore := 50 // Baseline

		for _, rule := range rules {
			if !rule.IsActive {
				continue
			}

			field, _ := rule.Condition["field"].(string)
			operator, _ := rule.Condition["operator"].(string)
			valueStr, _ := rule.Condition["value"].(string)

			match := false

			switch field {
			case "title":
				match = matchString(k.Title, operator, valueStr)
			case "status":
				match = matchString(k.Status, operator, valueStr)
			case "days_open":
				daysOpen := time.Since(k.CreatedAt).Hours() / 24
				val, _ := strconv.ParseFloat(valueStr, 64)
				match = matchNumber(daysOpen, operator, val)
			case "payment_status":
				if status, ok := k.ExtData["payment_status"].(string); ok {
					match = matchString(status, operator, valueStr)
				}
			}

			if match {
				newScore += rule.ScoreEffect
			}
		}

		if k.PriorityScore != newScore {
			k.PriorityScore = newScore
			if err := s.repo.UpdateCase(&k); err != nil {
				log.Printf("Error updating case score for %s: %v", k.ID, err)
			}
		}
	}
	return nil
}

func matchString(actual, op, target string) bool {
	actual = strings.ToLower(actual)
	target = strings.ToLower(target)
	switch op {
	case "contains":
		return strings.Contains(actual, target)
	case "eq", "equals":
		return actual == target
	case "ne", "notequals":
		return actual != target
	}
	return false
}

func matchNumber(actual float64, op string, target float64) bool {
	switch op {
	case "gt":
		return actual > target
	case "lt":
		return actual < target
	case "gte":
		return actual >= target
	case "lte":
		return actual <= target
	case "eq":
		return actual == target
	}
	return false
}

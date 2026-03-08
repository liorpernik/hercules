package service

import (
	"Hercules/backend/internal/adapter"
	"Hercules/backend/internal/core/model"
	"fmt"
	"sort"
)

type AssignmentService struct {
	calendar adapter.CalendarProvider
}

func NewAssignmentService(cal adapter.CalendarProvider) *AssignmentService {
	return &AssignmentService{calendar: cal}
}

type ScoredCandidate struct {
	User  model.User
	Score int
}

func (s *AssignmentService) FindBestCandidate(c *model.Case, users []model.User) *model.User {
	// Logic:
	// 1. Filter by Role/Seniority if required
	// 2. Score by Workload (fewer cases = better)
	// 3. Score by Location (match = better)
	// 4. Score by Seniority matches Case complexity (assuming we track that)

	candidates := []ScoredCandidate{}

	for _, u := range users {
		score := 0

		// 1. Location Match
		// Assuming case has ExtData["location"] or similar.
		// For MVP, just assuming positive match helps.
		if c.ExtData != nil && c.ExtData["location"] == u.Location {
			score += 20
		}

		// 2. Seniority (Mock logic: Senior gets high priority cases)
		if c.PriorityScore > 80 && u.SeniorityLevel == "senior" {
			score += 30
		}

		// 3. Workload (would need to fetch active case count for user, omitted for MVP struct)
		// score -= (active_cases * 5)

		candidates = append(candidates, ScoredCandidate{User: u, Score: score})
	}

	// Sort desc
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	if len(candidates) > 0 {
		fmt.Printf("Best candidate for %s is %s (Score: %d)\n", c.Title, candidates[0].User.Email, candidates[0].Score)
		return &candidates[0].User
	}
	return nil
}

package adapter

import (
	"Hercules/backend/internal/core/model"
	"time"
)

type CalendarEvent struct {
	Title       string
	Description string
	StartTime   time.Time
	EndTime     time.Time
	Attendees   []string
}

type TimeRange struct {
	Start time.Time
	End   time.Time
}

type CalendarProvider interface {
	GetAvailability(user *model.User, start, end time.Time) (string, error)
	CreateEvent(user *model.User, event CalendarEvent) (string, error)
}

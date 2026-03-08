package adapter

import (
	"Hercules/backend/internal/core/model"
	"context"
	"fmt"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type GoogleCalendarAdapter struct {
	oauthConfig *oauth2.Config
}

func NewGoogleCalendarAdapter(config *oauth2.Config) *GoogleCalendarAdapter {
	return &GoogleCalendarAdapter{
		oauthConfig: config,
	}
}

// Helper to get client from User tokens
func (g *GoogleCalendarAdapter) getClient(ctx context.Context, user *model.User) (*calendar.Service, error) {
	if user.GoogleAccessToken == "" {
		return nil, fmt.Errorf("user has no google access token")
	}

	token := &oauth2.Token{
		AccessToken:  user.GoogleAccessToken,
		RefreshToken: user.GoogleRefreshToken,
		Expiry:       user.GoogleTokenExpiry,
		TokenType:    "Bearer",
	}

	// TokenSource will refresh the token if needed
	tokenSource := g.oauthConfig.TokenSource(ctx, token)

	srv, err := calendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, err
	}
	return srv, nil
}

// GetAvailability gets free/busy info for the next 7 days (or specified range)
// Note: We changed signature to accept *model.User to get their tokens
func (g *GoogleCalendarAdapter) GetAvailability(user *model.User, start, end time.Time) (string, error) {
	ctx := context.Background()
	srv, err := g.getClient(ctx, user)
	if err != nil {
		return "", fmt.Errorf("auth error: %v", err)
	}

	// Only fetch from primary calendar as requested
	busyStr, err := g.fetchFromCalendar(srv, "primary", start, end)
	if err != nil {
		return "", fmt.Errorf("error fetching primary calendar: %v", err)
	}

	if busyStr == "" {
		return "No existing events found. User is free.", nil
	}

	return "User's Calendar (Next 7 Days):\n" + busyStr, nil
}

func (g *GoogleCalendarAdapter) fetchFromCalendar(srv *calendar.Service, calendarID string, start, end time.Time) (string, error) {
	req := &calendar.FreeBusyRequest{
		TimeMin: start.Format(time.RFC3339),
		TimeMax: end.Format(time.RFC3339),
		Items: []*calendar.FreeBusyRequestItem{
			{Id: calendarID},
		},
	}

	resp, err := srv.Freebusy.Query(req).Do()
	if err != nil {
		return "", err
	}

	if len(resp.Calendars) == 0 || len(resp.Calendars[calendarID].Busy) == 0 {
		return "", nil
	}

	busyStr := ""
	for _, busy := range resp.Calendars[calendarID].Busy {
		// Convert UTC response to Local time for clarity
		sTime, err1 := time.Parse(time.RFC3339, busy.Start)
		eTime, err2 := time.Parse(time.RFC3339, busy.End)

		sStr := busy.Start
		eStr := busy.End

		if err1 == nil {
			sStr = sTime.Local().Format(time.RFC3339)
		}
		if err2 == nil {
			eStr = eTime.Local().Format(time.RFC3339)
		}

		busyStr += fmt.Sprintf("- [Busy] from %s to %s\n", sStr, eStr)
	}
	return busyStr, nil
}

func (g *GoogleCalendarAdapter) CreateEvent(user *model.User, event CalendarEvent) (string, error) {
	ctx := context.Background()
	srv, err := g.getClient(ctx, user)
	if err != nil {
		return "", fmt.Errorf("auth error: %v", err)
	}

	calendarEvent := &calendar.Event{
		Summary:     event.Title,
		Description: event.Description,
		Start: &calendar.EventDateTime{
			DateTime: event.StartTime.Format(time.RFC3339),
		},
		End: &calendar.EventDateTime{
			DateTime: event.EndTime.Format(time.RFC3339),
		},
	}

	createdEvent, err := srv.Events.Insert("primary", calendarEvent).Do()
	if err != nil {
		return "", err
	}

	return createdEvent.HtmlLink, nil
}

// BatchCreateEvents creates multiple events using a single client session
func (g *GoogleCalendarAdapter) BatchCreateEvents(user *model.User, events []CalendarEvent) (int, int, error) {
	ctx := context.Background()
	srv, err := g.getClient(ctx, user)
	if err != nil {
		return 0, 0, fmt.Errorf("auth error: %v", err)
	}

	successCount := 0
	failCount := 0

	for i, event := range events {
		if i > 0 {
			// Throttle slightly to be nice to the API
			time.Sleep(200 * time.Millisecond)
		}

		calendarEvent := &calendar.Event{
			Summary:     event.Title,
			Description: event.Description,
			Start: &calendar.EventDateTime{
				DateTime: event.StartTime.Format(time.RFC3339),
			},
			End: &calendar.EventDateTime{
				DateTime: event.EndTime.Format(time.RFC3339),
			},
		}

		_, err := srv.Events.Insert("primary", calendarEvent).Do()
		if err != nil {
			fmt.Printf("Batch Error for '%s': %v\n", event.Title, err)
			failCount++
		} else {
			successCount++
		}
	}

	return successCount, failCount, nil
}

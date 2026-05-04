package gcal

import (
	"context"
	"fmt"
	"strings"
	"time"

	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

const bookingTokenPrivateProperty = "booking_token"

// Enabled indique si la création automatique d’événements Google Calendar est configurée.
func Enabled(cfg *config.Config) bool {
	return cfg.GoogleCalendarClientID != "" &&
		cfg.GoogleCalendarClientSecret != "" &&
		cfg.GoogleCalendarRefreshToken != ""
}

func formatEUR(cents int64) string {
	if cents < 0 {
		cents = 0
	}
	s := fmt.Sprintf("%.2f", float64(cents)/100.0)
	s = strings.Replace(s, ".", ",", 1)
	return s + " €"
}

func paymentDetailsLine(b models.Booking) string {
	switch b.PaymentStatus {
	case "deposit_paid":
		remaining := b.PriceCents - b.DepositCents
		if remaining < 0 {
			remaining = 0
		}
		return "Paiement : acompte payé, reste " + formatEUR(remaining)
	case "paid":
		return "Paiement : totalité payée"
	default:
		return "Paiement : en attente"
	}
}

func bookingICalUID(b models.Booking) string {
	token := strings.ToLower(strings.TrimSpace(b.PublicToken))
	if token == "" {
		token = strings.ToLower(strings.TrimSpace(b.ID.Hex()))
	}
	if token == "" {
		token = fmt.Sprintf("booking-%d", time.Now().UnixNano())
	}
	return token + "@pinkstarsociety.local"
}

// UpsertBookingEvent crée ou met à jour l'événement Google Calendar lié à la réservation.
// existingEventID peut être vide (création) ou contenir l'ID Google Event déjà enregistré (mise à jour).
func UpsertBookingEvent(ctx context.Context, cfg *config.Config, b models.Booking, customerEmail, customerDisplayName, existingEventID string) (string, error) {
	if !Enabled(cfg) {
		return "", nil
	}
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		return "", err
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", strings.TrimSpace(b.Date)+" "+strings.TrimSpace(b.Time), loc)
	if err != nil {
		return "", fmt.Errorf("date/heure réservation invalides: %w", err)
	}
	var end time.Time
	if strings.TrimSpace(b.EndTime) != "" {
		end, err = time.ParseInLocation("2006-01-02 15:04", strings.TrimSpace(b.Date)+" "+strings.TrimSpace(b.EndTime), loc)
		if err != nil {
			return "", fmt.Errorf("heure de fin invalides: %w", err)
		}
	} else {
		end = start.Add(time.Hour)
	}
	if !end.After(start) {
		end = start.Add(time.Hour)
	}

	oauthCfg := &oauth2.Config{
		ClientID:     cfg.GoogleCalendarClientID,
		ClientSecret: cfg.GoogleCalendarClientSecret,
		Endpoint:     google.Endpoint,
		RedirectURL:  "http://localhost",
	}
	ts := oauthCfg.TokenSource(ctx, &oauth2.Token{RefreshToken: cfg.GoogleCalendarRefreshToken})
	client := oauth2.NewClient(ctx, ts)

	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return "", err
	}

	name := strings.TrimSpace(customerDisplayName)
	presta := strings.TrimSpace(b.ServiceTypeName)
	if presta == "" {
		presta = "Prestation"
	}
	var summary string
	switch {
	case name != "":
		summary = name + " — " + presta
	case strings.TrimSpace(customerEmail) != "":
		summary = customerEmail + " — " + presta
	default:
		summary = presta
	}

	var desc strings.Builder
	if name != "" {
		fmt.Fprintf(&desc, "Client : %s\n", name)
	}
	if strings.TrimSpace(customerEmail) != "" {
		fmt.Fprintf(&desc, "E-mail : %s\n", strings.TrimSpace(customerEmail))
	} else if name == "" {
		fmt.Fprintln(&desc, "Client : (non renseigné)")
	}
	fmt.Fprintf(&desc, "Prestation : %s\n", presta)
	fmt.Fprintf(&desc, "Prix total : %s\n", formatEUR(b.PriceCents))
	fmt.Fprintf(&desc, "%s\n", paymentDetailsLine(b))
	fmt.Fprintf(&desc, "Créneau : %s %s → %s (Europe/Paris)\n", b.Date, strings.TrimSpace(b.Time), end.Format("15:04"))
	if strings.TrimSpace(b.Description) != "" {
		desc.WriteString("\nNotes :\n")
		desc.WriteString(strings.TrimSpace(b.Description))
	}

	ev := &calendar.Event{
		Summary:     summary,
		Description: desc.String(),
		ICalUID:     bookingICalUID(b),
		ExtendedProperties: &calendar.EventExtendedProperties{
			Private: map[string]string{
				bookingTokenPrivateProperty: strings.TrimSpace(b.PublicToken),
			},
		},
		Start: &calendar.EventDateTime{
			DateTime: start.Format(time.RFC3339),
			TimeZone: "Europe/Paris",
		},
		End: &calendar.EventDateTime{
			DateTime: end.Format(time.RFC3339),
			TimeZone: "Europe/Paris",
		},
	}
	calID := strings.TrimSpace(cfg.GoogleCalendarID)
	if calID == "" {
		calID = "primary"
	}
	existingEventID = strings.TrimSpace(existingEventID)
	if existingEventID == "" {
		if token := strings.TrimSpace(b.PublicToken); token != "" {
			listRes, listErr := srv.Events.List(calID).
				PrivateExtendedProperty(bookingTokenPrivateProperty + "=" + token).
				MaxResults(1).
				Context(ctx).
				Do()
			if listErr == nil && len(listRes.Items) > 0 {
				existingEventID = strings.TrimSpace(listRes.Items[0].Id)
			}
		}
	}
	if existingEventID == "" {
		listRes, listErr := srv.Events.List(calID).
			ICalUID(bookingICalUID(b)).
			MaxResults(1).
			Context(ctx).
			Do()
		if listErr == nil && len(listRes.Items) > 0 {
			existingEventID = strings.TrimSpace(listRes.Items[0].Id)
		}
	}
	if existingEventID != "" {
		updated, err := srv.Events.Update(calID, existingEventID, ev).SendUpdates("none").Context(ctx).Do()
		if err == nil {
			return updated.Id, nil
		}
	}
	// none : événement créé sur le calendrier OAuth sans envoyer d’invitations.
	created, err := srv.Events.Insert(calID, ev).SendUpdates("none").Context(ctx).Do()
	if err != nil {
		return "", err
	}
	return created.Id, nil
}

package config

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                string
	MongoURI            string
	MongoDatabase       string
	JWTSecret           string
	AdminBootstrapEmail string
	FrontendURL         string
	StripeSecretKey     string
	StripeWebhookSecret string
	SMTPHost            string
	SMTPPort            string
	SMTPUser            string
	SMTPPassword        string
	EmailFrom           string
	// PlanningEmail : reçoit un mail + .ics à chaque paiement (acompte ou totalité)
	PlanningEmail string
	// Google Calendar API (OAuth refresh token du compte qui possède le calendrier cible)
	GoogleCalendarClientID     string
	GoogleCalendarClientSecret string
	GoogleCalendarRefreshToken string
	// GoogleCalendarID : ex. "primary" ou l’ID d’un calendrier secondaire
	GoogleCalendarID string
}

func loadEnvFiles() {
	candidates := []string{".env", "../.env"}
	if wd, err := os.Getwd(); err == nil {
		candidates = append([]string{
			filepath.Join(wd, ".env"),
			filepath.Join(wd, "..", ".env"),
		}, candidates...)
	}
	seen := make(map[string]struct{})
	for _, p := range candidates {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		if _, dup := seen[abs]; dup {
			continue
		}
		seen[abs] = struct{}{}
		err = godotenv.Load(abs)
		if err == nil {
			continue
		}
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		var pathErr *os.PathError
		if errors.As(err, &pathErr) && errors.Is(pathErr.Err, fs.ErrNotExist) {
			continue
		}
		log.Printf("godotenv %s: %v", abs, err)
	}
}

func Load() (*Config, error) {
	loadEnvFiles()

	dbName := strings.TrimSpace(os.Getenv("MONGODB_DATABASE"))
	if dbName == "" {
		dbName = "pinkstarsociety"
	}

	mongoURI := strings.TrimSpace(os.Getenv("MONGODB_URI"))
	if mongoURI == "" {
		return nil, fmt.Errorf("MONGODB_URI requis")
	}
	if idx := strings.Index(mongoURI, ".mongodb.net/"); idx != -1 {
		rest := mongoURI[idx+len(".mongodb.net/"):]
		if rest == "" || rest == "/" {
			mongoURI = strings.TrimSuffix(mongoURI, "/") + "/" + dbName + "?retryWrites=true&w=majority"
		}
	}

	jwt := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwt == "" {
		jwt = "dev-change-me-in-production"
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontend == "" {
		frontend = "http://localhost:5173"
	}

	sk := strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY"))
	if sk == "" {
		return nil, fmt.Errorf("STRIPE_SECRET_KEY requis")
	}

	smtpPort := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if smtpPort == "" {
		smtpPort = "587"
	}
	smtpHost := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	smtpUser := strings.TrimSpace(os.Getenv("SMTP_USER"))
	smtpPass := strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	emailFrom := strings.TrimSpace(os.Getenv("EMAIL_FROM"))

	// Zimbra / OVH : si défini, remplace les champs SMTP génériques (IMAP ignoré pour l’envoi)
	if zh := strings.TrimSpace(os.Getenv("ZIMBRA_SMTP_HOST")); zh != "" {
		smtpHost = zh
		if zp := strings.TrimSpace(os.Getenv("ZIMBRA_SMTP_PORT")); zp != "" {
			smtpPort = zp
		}
		if ze := strings.TrimSpace(os.Getenv("ZIMBRA_EMAIL")); ze != "" {
			smtpUser = ze
			if emailFrom == "" {
				emailFrom = ze
			}
		}
		if zpw := strings.TrimSpace(os.Getenv("ZIMBRA_PASSWORD")); zpw != "" {
			smtpPass = zpw
		}
	}

	return &Config{
		Port:                port,
		MongoURI:            mongoURI,
		MongoDatabase:       dbName,
		JWTSecret:           jwt,
		AdminBootstrapEmail: strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_BOOTSTRAP_EMAIL"))),
		FrontendURL:         strings.TrimRight(frontend, "/"),
		StripeSecretKey:     sk,
		StripeWebhookSecret: strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		SMTPHost:            smtpHost,
		SMTPPort:            smtpPort,
		SMTPUser:            smtpUser,
		SMTPPassword:        smtpPass,
		EmailFrom:           emailFrom,
		PlanningEmail:       strings.TrimSpace(os.Getenv("PLANNING_EMAIL")),
		GoogleCalendarClientID:     strings.TrimSpace(os.Getenv("GOOGLE_CALENDAR_CLIENT_ID")),
		GoogleCalendarClientSecret: strings.TrimSpace(os.Getenv("GOOGLE_CALENDAR_CLIENT_SECRET")),
		GoogleCalendarRefreshToken: strings.TrimSpace(os.Getenv("GOOGLE_CALENDAR_REFRESH_TOKEN")),
		GoogleCalendarID:           strings.TrimSpace(os.Getenv("GOOGLE_CALENDAR_ID")),
	}, nil
}

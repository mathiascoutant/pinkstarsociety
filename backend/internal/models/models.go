package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	RoleClient = "client"
	RoleAdmin  = "admin"

	VisitPendingValidation = "pending_validation"
	VisitInProgress        = "in_progress"
	VisitCompleted         = "completed"

	BalancePaidCash         = "cash"
	BalancePaidBankTransfer = "bank_transfer"
)

type User struct {
	ID                   primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	FirstName            string             `json:"firstName" bson:"first_name"`
	LastName             string             `json:"lastName" bson:"last_name"`
	Email                string             `json:"email" bson:"email"`
	PasswordHash         string             `json:"-" bson:"password_hash"`
	Role                 string             `json:"role" bson:"role"`
	QRToken              string             `json:"qrToken,omitempty" bson:"qr_token,omitempty"`
	LoyaltyPoints            int `json:"loyaltyPoints" bson:"loyalty_points"`
	LoyaltyProgressCount     int `json:"loyaltyProgressCount" bson:"loyalty_progress_count"`
	TotalCompletedServices   int `json:"totalCompletedServices" bson:"total_completed_services"`
	CreatedAt            time.Time          `json:"createdAt" bson:"created_at"`
}

type ServiceType struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name      string             `json:"name" bson:"name"`
	CreatedAt time.Time          `json:"createdAt" bson:"created_at"`
}

type LoyaltyCode struct {
	ID         primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Code       string             `json:"code" bson:"code"`
	Points     int                `json:"points" bson:"points"`
	MaxUses    int                `json:"maxUses" bson:"max_uses"`
	UsageCount int                `json:"usageCount" bson:"usage_count"`
	IsActive   bool               `json:"isActive" bson:"is_active"`
	CreatedAt  time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt  time.Time          `json:"updatedAt" bson:"updated_at"`
}

// PaymentStatus: pending | deposit_paid | paid
// VisitStatus: pending_validation | in_progress | completed (vide si pas de client lié)
type Booking struct {
	ID                    primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	PublicToken           string             `json:"publicToken" bson:"public_token"`
	ServiceTypeID         primitive.ObjectID `json:"serviceTypeId" bson:"service_type_id"`
	ServiceTypeName       string             `json:"serviceTypeName" bson:"service_type_name"`
	Date                  string             `json:"date" bson:"date"`                            // YYYY-MM-DD
	Time                  string             `json:"time" bson:"time"`                            // HH:MM
	EndTime               string             `json:"endTime,omitempty" bson:"end_time,omitempty"` // HH:MM — planning admin uniquement
	PriceCents            int64              `json:"priceCents" bson:"price_cents"`
	DepositCents          int64              `json:"depositCents" bson:"deposit_cents"`
	Description           string             `json:"description" bson:"description"`
	PaymentStatus         string             `json:"paymentStatus" bson:"payment_status"`
	BalancePaidMethod     string             `json:"balancePaidMethod,omitempty" bson:"balance_paid_method,omitempty"` // cash | bank_transfer (solde réglé hors site)
	ClientUserID          primitive.ObjectID `json:"clientUserId,omitempty" bson:"client_user_id,omitempty"`
	VisitStatus           string             `json:"visitStatus,omitempty" bson:"visit_status,omitempty"`
	VisitPointsAwarded    bool               `json:"visitPointsAwarded" bson:"visit_points_awarded"`
	CustomerEmail         string             `json:"-" bson:"customer_email,omitempty"`
	GuestFirstName        string             `json:"-" bson:"guest_first_name,omitempty"`
	GuestLastName         string             `json:"-" bson:"guest_last_name,omitempty"`
	NotifiedSessionIDs    []string           `json:"-" bson:"notified_session_ids,omitempty"`
	StripeSessionID       string             `json:"-" bson:"stripe_session_id,omitempty"`
	GoogleCalendarEventID string             `json:"-" bson:"google_calendar_event_id,omitempty"`
	CreatedByUserID       primitive.ObjectID `json:"createdByUserId" bson:"created_by_user_id"`
	CreatedAt             time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt             time.Time          `json:"updatedAt" bson:"updated_at"`
	LastPaymentIntent     string             `json:"-" bson:"last_payment_intent,omitempty"`

	// QR de présence pour les paiements en mode INVITÉ (sans compte client).
	// Généré au 1er paiement (acompte ou totalité), reste identique tant que le
	// booking est en mode invité. Single-use : `GuestQRUsed` passe à true au
	// premier scan validé. Pour les clients connectés, on utilise `users.qr_token`
	// qui est multi-usage.
	GuestQRToken string `json:"-" bson:"guest_qr_token,omitempty"`
	GuestQRUsed  bool   `json:"-" bson:"guest_qr_used,omitempty"`
}

// SlotStatus: open | blocked
// Créneaux : h08 (8h), h10 (10h), h14 (14h), h17 (17h).
// Morning/Afternoon conservés en lecture pour migrer d'anciennes grilles.
type DayAvailability struct {
	Day       int    `json:"day" bson:"day"`
	H08       string `json:"h08" bson:"h08"`
	H10       string `json:"h10" bson:"h10"`
	H14       string `json:"h14" bson:"h14"`
	H17       string `json:"h17" bson:"h17"`
	Morning   string `json:"morning,omitempty" bson:"morning,omitempty"`
	Afternoon string `json:"afternoon,omitempty" bson:"afternoon,omitempty"`
}

type MonthAvailability struct {
	Year      int               `json:"year" bson:"year"`
	Month     int               `json:"month" bson:"month"`
	Published bool              `json:"published" bson:"published"`
	Days      []DayAvailability `json:"days" bson:"days"`
	UpdatedAt time.Time         `json:"updatedAt" bson:"updated_at"`
}

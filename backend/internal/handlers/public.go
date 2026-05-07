package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	"pinkstarsociety/internal/models"
	"pinkstarsociety/internal/pdf"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func (h *Handlers) GetPublicBooking(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lien invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}

	// Si cette offre est encore en attente et qu'un AUTRE booking sur la même
	// demi-journée a déjà été payé (acompte ou total), l'offre n'est plus
	// valable — premier arrivé, premier servi.
	slotTaken := false
	if b.PaymentStatus == "pending" {
		thisSlot := halfDay(b.Time)
		cur, err := h.DB.Collection("bookings").Find(ctx, bson.M{
			"date":           b.Date,
			"_id":            bson.M{"$ne": b.ID},
			"payment_status": bson.M{"$in": []string{"deposit_paid", "paid"}},
		})
		if err == nil {
			defer cur.Close(ctx)
			var others []models.Booking
			if cur.All(ctx, &others) == nil {
				for _, o := range others {
					if halfDay(o.Time) == thisSlot {
						slotTaken = true
						break
					}
				}
			}
		}
	}

	resp := publicBookingResponse(b)
	resp["slotTaken"] = slotTaken
	if slotTaken {
		// On désactive proprement les paiements côté API aussi,
		// au cas où le client tenterait de bypasser le front.
		resp["canPayDeposit"] = false
		resp["canPayFull"] = false
		resp["canPayBalance"] = false
	}
	c.JSON(http.StatusOK, resp)
}

// GetPublicBookingQR sert le PNG du QR de présence pour une résa en mode invité.
// GET /api/public/bookings/:token/qr.png
// → 404 si pas de QR (résa client connecté ou pas encore payée).
func (h *Handlers) GetPublicBookingQR(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		c.Status(http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if strings.TrimSpace(b.GuestQRToken) == "" {
		c.Status(http.StatusNotFound)
		return
	}
	payload := "PSS:" + b.GuestQRToken
	png, err := qrcode.Encode(payload, qrcode.Medium, 512)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "image/png", png)
}

// halfDay : avant 13:00 → "morning", sinon "afternoon".
func halfDay(time string) string {
	if len(time) >= 2 {
		h, err := strconv.Atoi(time[:2])
		if err == nil && h < 13 {
			return "morning"
		}
	}
	return "afternoon"
}

func publicBookingResponse(b models.Booking) gin.H {
	remaining := b.PriceCents - b.DepositCents
	if remaining < 0 {
		remaining = 0
	}
	out := gin.H{
		"serviceTypeName": b.ServiceTypeName,
		"date":            b.Date,
		"time":            b.Time,
		"priceCents":      b.PriceCents,
		"depositCents":    b.DepositCents,
		"remainingCents":  remaining,
		"description":     b.Description,
		"paymentStatus":   b.PaymentStatus,
		"visitStatus":     b.VisitStatus,
		"visitLabelFR":    visitLabelForPublicPage(b),
		"canPayDeposit":   b.PaymentStatus == "pending",
		"canPayFull":      b.PaymentStatus == "pending",
		"canPayBalance":   b.PaymentStatus == "deposit_paid",
		"paidLabel":       paymentLabel(b.PaymentStatus),
	}
	if b.BalancePaidMethod != "" {
		out["balancePaidMethod"] = b.BalancePaidMethod
		out["balancePaidLabelFR"] = balancePaidMethodLabelFR(b.BalancePaidMethod)
	}
	return out
}

// GetPublicAvailability renvoie les créneaux confirmés d'un mois (sans info
// client). Permet au calendrier public de se mettre à jour automatiquement
// dès qu'un acompte ou un paiement total est reçu, sans intervention admin.
//
// GET /api/public/availability/:year/:month
// → { "year": 2025, "month": 5, "slots": [ { "date": "2025-05-04", "time": "14:00" } ] }
func (h *Handlers) GetPublicAvailability(c *gin.Context) {
	yearStr := c.Param("year")
	monthStr := c.Param("month")
	year, err1 := strconv.Atoi(yearStr)
	month, err2 := strconv.Atoi(monthStr)
	if err1 != nil || err2 != nil || year < 2000 || year > 2100 || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	from := fmt.Sprintf("%04d-%02d-01", year, month)
	// Borne haute exclusive : 1er du mois suivant.
	nextY, nextM := year, month+1
	if nextM > 12 {
		nextM = 1
		nextY++
	}
	to := fmt.Sprintf("%04d-%02d-01", nextY, nextM)

	filter := bson.M{
		"date":           bson.M{"$gte": from, "$lt": to},
		"payment_status": bson.M{"$in": []string{"deposit_paid", "paid"}},
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("bookings").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "indisponible"})
		return
	}
	defer cur.Close(ctx)

	var bookings []models.Booking
	if err := cur.All(ctx, &bookings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "indisponible"})
		return
	}

	// On ne renvoie QUE date + time. Pas d'ID, pas de nom, pas de prix.
	slots := make([]gin.H, 0, len(bookings))
	for _, b := range bookings {
		slots = append(slots, gin.H{
			"date": b.Date,
			"time": b.Time,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"year":  year,
		"month": month,
		"slots": slots,
	})
}

func paymentLabel(s string) string {
	switch s {
	case "paid":
		return "Payé intégralement"
	case "deposit_paid":
		return "Acompte payé"
	default:
		return "En attente de paiement"
	}
}

type checkoutBody struct {
	Kind  string `json:"kind" binding:"required"` // full | deposit | balance
	Guest *struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
	} `json:"guest,omitempty"`
}

func (h *Handlers) CreateCheckout(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	var body checkoutBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	kind := strings.ToLower(strings.TrimSpace(body.Kind))
	if kind != "full" && kind != "deposit" && kind != "balance" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type de paiement invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if b.PaymentStatus == "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "déjà payé intégralement"})
		return
	}

	// Premier arrivé, premier servi : si un autre RDV confirmé occupe déjà
	// la même demi-journée et que ce booking-ci est encore en attente, on
	// refuse le paiement.
	if b.PaymentStatus == "pending" {
		thisSlot := halfDay(b.Time)
		cur, err := h.DB.Collection("bookings").Find(ctx, bson.M{
			"date":           b.Date,
			"_id":            bson.M{"$ne": b.ID},
			"payment_status": bson.M{"$in": []string{"deposit_paid", "paid"}},
		})
		if err == nil {
			defer cur.Close(ctx)
			var others []models.Booking
			if cur.All(ctx, &others) == nil {
				for _, o := range others {
					if halfDay(o.Time) == thisSlot {
						c.JSON(http.StatusConflict, gin.H{
							"error":     "Ce créneau vient d'être réservé par quelqu'un d'autre.",
							"slotTaken": true,
						})
						return
					}
				}
			}
		}
	}

	var amount int64
	var payKind string
	switch kind {
	case "full":
		if b.PaymentStatus != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "paiement total indisponible"})
			return
		}
		amount = b.PriceCents
		payKind = "full"
	case "deposit":
		if b.PaymentStatus != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "acompte indisponible"})
			return
		}
		amount = b.DepositCents
		payKind = "deposit"
	case "balance":
		if b.PaymentStatus != "deposit_paid" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "solde indisponible"})
			return
		}
		amount = b.PriceCents - b.DepositCents
		if amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rien à payer"})
			return
		}
		payKind = "balance"
	}
	success := fmt.Sprintf("%s/reservation/%s/merci?session_id={CHECKOUT_SESSION_ID}", h.Config.FrontendURL, token)
	cancelURL := fmt.Sprintf("%s/reservation/%s", h.Config.FrontendURL, token)
	title := "Réservation — " + b.ServiceTypeName
	var userIDHex string
	if cl := optionalBearerClaims(c, h.Config.JWTSecret); cl != nil {
		userIDHex = cl.UserID
	}
	guestEmail := ""
	guestFirst := ""
	guestLast := ""
	if userIDHex == "" && body.Guest != nil {
		guestFirst = strings.TrimSpace(body.Guest.FirstName)
		guestLast = strings.TrimSpace(body.Guest.LastName)
		guestEmail = strings.TrimSpace(body.Guest.Email)
	}
	sessURL, sessID, err := h.newStripeCheckoutSession(amount, title, success, cancelURL, token, payKind, userIDHex, guestEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "paiement indisponible"})
		return
	}
	update := bson.M{
		"stripe_session_id": sessID,
		"updated_at":        time.Now().UTC(),
	}
	if guestFirst != "" {
		update["guest_first_name"] = guestFirst
	}
	if guestLast != "" {
		update["guest_last_name"] = guestLast
	}
	if guestEmail != "" {
		update["customer_email"] = guestEmail
	}
	_, _ = h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{"$set": update})
	c.JSON(http.StatusOK, gin.H{"url": sessURL})
}

type confirmBody struct {
	Token     string `json:"token" binding:"required"`
	SessionID string `json:"sessionId" binding:"required"`
}

func (h *Handlers) ConfirmCheckoutSession(c *gin.Context) {
	var body confirmBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	if err := h.verifyAndApplyStripeSession(c.Request.Context(), strings.TrimSpace(body.Token), strings.TrimSpace(body.SessionID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) DownloadInvoice(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if b.PaymentStatus != "paid" && b.PaymentStatus != "deposit_paid" {
		c.JSON(http.StatusForbidden, gin.H{"error": "paiement requis pour la facture"})
		return
	}
	payForPDF := b.PaymentStatus
	if b.PaymentStatus == "paid" && strings.EqualFold(strings.TrimSpace(c.Query("variant")), "deposit") {
		payForPDF = "deposit_paid"
	}
	buf, err := pdf.Invoice(b, payForPDF)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "génération facture impossible"})
		return
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="facture-pink-star-society.pdf"`)
	c.Data(http.StatusOK, "application/pdf", buf)
}

func (h *Handlers) CalendarICS(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	ics := pdf.BuildICS(b)
	c.Header("Content-Type", "text/calendar; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="rendez-vous-pink-star.ics"`)
	c.String(http.StatusOK, ics)
}

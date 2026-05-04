package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

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
	c.JSON(http.StatusOK, publicBookingResponse(b))
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
	Kind string `json:"kind" binding:"required"` // full | deposit | balance
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
	sessURL, sessID, err := h.newStripeCheckoutSession(amount, title, success, cancelURL, token, payKind, userIDHex)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "paiement indisponible"})
		return
	}
	_, _ = h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{"$set": bson.M{
		"stripe_session_id": sessID,
		"updated_at":        time.Now().UTC(),
	}})
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

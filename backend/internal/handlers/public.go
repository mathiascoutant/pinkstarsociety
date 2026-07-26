package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	"pinkstarsociety/internal/bookingtime"
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

	// Si cette offre est encore en attente et qu'un AUTRE RDV confirmé chevauche
	// le créneau horaire, l'offre n'est plus valable — premier validé, premier servi.
	slotTaken := false
	if b.PaymentStatus == "pending" {
		h.pullUnpaidInspirationOffDisk(ctx, &b)
		slotTaken = h.hasConfirmedOverlap(ctx, b)
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

func (h *Handlers) hasConfirmedOverlap(ctx context.Context, b models.Booking) bool {
	cur, err := h.DB.Collection("bookings").Find(ctx, bson.M{
		"date":           b.Date,
		"_id":            bson.M{"$ne": b.ID},
		"payment_status": bson.M{"$in": []string{"deposit_paid", "paid"}},
	})
	if err != nil {
		return false
	}
	defer cur.Close(ctx)
	var others []models.Booking
	if cur.All(ctx, &others) != nil {
		return false
	}
	for _, o := range others {
		if bookingtime.BookingsOverlap(b, o) {
			return true
		}
	}
	return false
}

func publicBookingResponse(b models.Booking) gin.H {
	remaining := b.PriceCents - b.DepositCents
	if remaining < 0 {
		remaining = 0
	}
	inspCount := len(b.InspirationImages)
	inspReady := !b.InspirationRequired || inspCount > 0
	canPayFirst := b.PaymentStatus == "pending" && inspReady
	out := gin.H{
		"serviceTypeName":         b.ServiceTypeName,
		"date":                    b.Date,
		"time":                    b.Time,
		"priceCents":              b.PriceCents,
		"depositCents":            b.DepositCents,
		"remainingCents":          remaining,
		"description":             b.Description,
		"inspirationRequired":     b.InspirationRequired,
		"inspirationImages":       inspirationImagesPublicJSON(b.PublicToken, b.InspirationImages),
		"inspirationImagesCount":  inspCount,
		"inspirationReady":        inspReady,
		"paymentStatus":           b.PaymentStatus,
		"visitStatus":             b.VisitStatus,
		"visitLabelFR":            visitLabelForPublicPage(b),
		"canPayDeposit":           canPayFirst,
		"canPayFull":              canPayFirst,
		"canPayBalance":           b.PaymentStatus == "deposit_paid",
		"paidLabel":               paymentLabel(b.PaymentStatus),
	}
	if b.BalancePaidMethod != "" {
		out["balancePaidMethod"] = b.BalancePaidMethod
		out["balancePaidLabelFR"] = balancePaidMethodLabelFR(b.BalancePaidMethod)
	}
	return out
}

// GetPublicAvailability renvoie la grille publiée d'un mois avec les RDV
// confirmés appliqués. 404 si le mois n'est pas publié.
//
// GET /api/public/availability/:year/:month
// → { "year": 2025, "month": 5, "published": true, "days": [...] }
func (h *Handlers) GetPublicAvailability(c *gin.Context) {
	yearStr := c.Param("year")
	monthStr := c.Param("month")
	year, err1 := strconv.Atoi(yearStr)
	month, err2 := strconv.Atoi(monthStr)
	if err1 != nil || err2 != nil || year < 2000 || year > 2100 || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	doc, found, err := h.loadMonthAvailability(ctx, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "indisponible"})
		return
	}
	if !found || !doc.Published {
		c.JSON(http.StatusNotFound, gin.H{"error": "mois non publié"})
		return
	}

	bookings, err := h.confirmedBookingsForMonth(ctx, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "indisponible"})
		return
	}
	applyBookingsToMonth(&doc, bookings)

	c.JSON(http.StatusOK, monthAvailabilityJSON(doc))
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

	// Premier validé, premier servi : chevauchement horaire avec un RDV déjà confirmé.
	if b.PaymentStatus == "pending" && h.hasConfirmedOverlap(ctx, b) {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Ce créneau vient d'être réservé par quelqu'un d'autre.",
			"slotTaken": true,
		})
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
		if b.InspirationRequired && len(b.InspirationImages) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ajoute au moins une image d'inspiration avant de payer"})
			return
		}
		amount = b.PriceCents
		payKind = "full"
	case "deposit":
		if b.PaymentStatus != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "acompte indisponible"})
			return
		}
		if b.InspirationRequired && len(b.InspirationImages) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ajoute au moins une image d'inspiration avant de payer"})
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

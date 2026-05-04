package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"strings"
	"time"

	"pinkstarsociety/internal/gcal"
	"pinkstarsociety/internal/mail"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v76"
	checkoutsession "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/webhook"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (h *Handlers) newStripeCheckoutSession(amountCents int64, productTitle, successURL, cancelURL, bookingToken, payKind, userIDHex string) (url string, sessionID string, err error) {
	stripe.Key = h.Config.StripeSecretKey
	meta := map[string]string{
		"booking_token": bookingToken,
		"payment_kind":  payKind,
	}
	if userIDHex != "" {
		meta["user_id"] = userIDHex
	}
	params := &stripe.CheckoutSessionParams{
		Locale: stripe.String("fr"),
		Mode:   stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Quantity: stripe.Int64(1),
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String("eur"),
					UnitAmount: stripe.Int64(amountCents),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(productTitle),
					},
				},
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata:   meta,
	}
	sess, err := checkoutsession.New(params)
	if err != nil {
		return "", "", err
	}
	return sess.URL, sess.ID, nil
}

func (h *Handlers) verifyAndApplyStripeSession(ctx context.Context, token, sessionID string) error {
	stripe.Key = h.Config.StripeSecretKey
	sess, err := checkoutsession.Get(sessionID, nil)
	if err != nil {
		return errors.New("session introuvable")
	}
	if sess.Metadata["booking_token"] != token {
		return errors.New("session invalide pour ce lien")
	}
	return h.applyPaidCheckoutSession(ctx, sess)
}

func sessionCustomerEmail(sess *stripe.CheckoutSession) string {
	if sess.CustomerDetails != nil && sess.CustomerDetails.Email != "" {
		return sess.CustomerDetails.Email
	}
	if sess.CustomerEmail != "" {
		return sess.CustomerEmail
	}
	return ""
}

func notifiedAlready(b models.Booking, sessionID string) bool {
	for _, id := range b.NotifiedSessionIDs {
		if id == sessionID {
			return true
		}
	}
	return false
}

func (h *Handlers) applyPaidCheckoutSession(ctx context.Context, sess *stripe.CheckoutSession) error {
	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		return errors.New("paiement non confirmé")
	}
	token := sess.Metadata["booking_token"]
	payKind := sess.Metadata["payment_kind"]
	if token == "" || payKind == "" {
		return errors.New("métadonnées de session invalides")
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		return errors.New("réservation introuvable")
	}
	if notifiedAlready(b, sess.ID) {
		if uidHex := sess.Metadata["user_id"]; uidHex != "" {
			if oid, err := primitive.ObjectIDFromHex(uidHex); err == nil && b.ClientUserID.IsZero() {
				heal := bson.M{
					"client_user_id": oid,
					"updated_at":     time.Now().UTC(),
				}
				if b.VisitStatus == "" && (b.PaymentStatus == "deposit_paid" || b.PaymentStatus == "paid") {
					heal["visit_status"] = models.VisitPendingValidation
				}
				_, _ = h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{"$set": heal})
			}
		}
		return nil
	}
	applyStripePayment(&b, payKind)
	customerEmail := sessionCustomerEmail(sess)
	cid := b.ClientUserID
	if uidHex := sess.Metadata["user_id"]; uidHex != "" {
		if oid, err := primitive.ObjectIDFromHex(uidHex); err == nil && cid.IsZero() {
			cid = oid
		}
	}
	set := bson.M{
		"payment_status": b.PaymentStatus,
		"updated_at":     time.Now().UTC(),
	}
	if !cid.IsZero() {
		set["client_user_id"] = cid
	}
	if customerEmail != "" {
		set["customer_email"] = customerEmail
	}
	if !cid.IsZero() && (b.PaymentStatus == "deposit_paid" || b.PaymentStatus == "paid") && b.VisitStatus == "" {
		set["visit_status"] = models.VisitPendingValidation
	}
	// Un seul traitement par session Stripe (webhook + page merci en parallèle) : sinon double e-mail.
	filter := bson.M{
		"_id": b.ID,
		"$nor": []bson.M{
			{"notified_session_ids": bson.M{"$elemMatch": bson.M{"$eq": sess.ID}}},
		},
	}
	res, err := h.DB.Collection("bookings").UpdateOne(ctx,
		filter,
		bson.M{
			"$set": set,
			"$addToSet": bson.M{
				"notified_session_ids": sess.ID,
			},
		},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return nil
	}
	to := customerEmail
	if to == "" {
		to = b.CustomerEmail
	}
	cfg := h.Config
	amount := sess.AmountTotal
	kind := payKind
	bookingSnap := b
	existingEventID := strings.TrimSpace(b.GoogleCalendarEventID)
	lookupID := cid
	if lookupID.IsZero() {
		lookupID = bookingSnap.ClientUserID
	}
	customerName := ""
	if !lookupID.IsZero() {
		ctxU, cancelU := context.WithTimeout(context.Background(), 5*time.Second)
		var u models.User
		if err := h.DB.Collection("users").FindOne(ctxU, bson.M{"_id": lookupID}).Decode(&u); err == nil {
			customerName = strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
		}
		cancelU()
	}
	if gcal.Enabled(cfg) {
		ctxG, cancelG := context.WithTimeout(context.Background(), 20*time.Second)
		eventID, err := gcal.UpsertBookingEvent(ctxG, cfg, bookingSnap, to, customerName, existingEventID)
		cancelG()
		if err != nil {
			log.Println("google calendar sync:", err)
		} else {
			log.Printf("google calendar sync: booking=%s pay_kind=%s event_id=%s\n", bookingSnap.ID.Hex(), kind, strings.TrimSpace(eventID))
			if strings.TrimSpace(eventID) != "" && eventID != existingEventID {
				ctxW, cancelW := context.WithTimeout(context.Background(), 5*time.Second)
				_, werr := h.DB.Collection("bookings").UpdateOne(
					ctxW,
					bson.M{"_id": bookingSnap.ID},
					bson.M{"$set": bson.M{
						"google_calendar_event_id": eventID,
						"updated_at":               time.Now().UTC(),
					}},
				)
				cancelW()
				if werr != nil {
					log.Println("google calendar persist event_id:", werr)
				}
			}
		}
	}
	go func() {
		if err := mail.SendPaymentRecap(cfg, to, bookingSnap, kind, amount); err != nil {
			log.Println("email recap:", err)
		}
	}()
	return nil
}

func applyStripePayment(b *models.Booking, payKind string) {
	switch payKind {
	case "full":
		b.PaymentStatus = "paid"
	case "deposit":
		b.PaymentStatus = "deposit_paid"
	case "balance":
		b.PaymentStatus = "paid"
	}
}

func (h *Handlers) StripeWebhook(c *gin.Context) {
	if h.Config.StripeWebhookSecret == "" {
		c.Status(204)
		return
	}
	payload, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Status(400)
		return
	}
	sig := c.GetHeader("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sig, h.Config.StripeWebhookSecret)
	if err != nil {
		c.Status(400)
		return
	}
	if event.Type == "checkout.session.completed" {
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			if err := h.applyPaidCheckoutSession(ctx, &sess); err != nil {
				log.Println("webhook checkout:", err)
			}
		}
	}
	c.Status(200)
}

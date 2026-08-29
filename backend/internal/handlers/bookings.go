package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/mail"
	"pinkstarsociety/internal/middleware"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type createBookingBody struct {
	ServiceTypeID         string `json:"serviceTypeId" binding:"required"`
	Date                  string `json:"date" binding:"required"`
	Time                  string `json:"time" binding:"required"`
	EndTime               string `json:"endTime"`
	PriceCents            int64  `json:"priceCents" binding:"required"`
	DepositCents          int64  `json:"depositCents" binding:"required"`
	Description           string `json:"description"`
	InspirationRequired   *bool  `json:"inspirationRequired"`
}

func bookingSummaryPeriodRange(period string) (fromDate string, toDate string) {
	today := time.Now().UTC()
	todayStr := today.Format("2006-01-02")
	switch period {
	case "last_30_days":
		return today.AddDate(0, 0, -29).Format("2006-01-02"), todayStr
	case "month":
		monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
		monthEnd := monthStart.AddDate(0, 1, -1)
		return monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02")
	case "year":
		yearStart := time.Date(today.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		yearEnd := time.Date(today.Year(), 12, 31, 0, 0, 0, 0, time.UTC)
		return yearStart.Format("2006-01-02"), yearEnd.Format("2006-01-02")
	default:
		return "", ""
	}
}

func (h *Handlers) AdminBookingSummary(c *gin.Context) {
	period := strings.ToLower(strings.TrimSpace(c.Query("period")))
	if period == "" {
		period = "all"
	}
	if period != "all" && period != "month" && period != "last_30_days" && period != "year" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "période invalide"})
		return
	}
	filter := bson.M{}
	fromDate, toDate := bookingSummaryPeriodRange(period)
	if fromDate != "" && toDate != "" {
		filter["date"] = bson.M{"$gte": fromDate, "$lte": toDate}
	} else if fromDate != "" {
		filter["date"] = bson.M{"$gte": fromDate}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("bookings").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "statistiques indisponibles"})
		return
	}
	defer cur.Close(ctx)

	var list []models.Booking
	if err := cur.All(ctx, &list); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "statistiques indisponibles"})
		return
	}

	ids := make([]primitive.ObjectID, 0)
	seenID := map[primitive.ObjectID]struct{}{}
	for _, b := range list {
		if b.ClientUserID.IsZero() {
			continue
		}
		if _, dup := seenID[b.ClientUserID]; dup {
			continue
		}
		seenID[b.ClientUserID] = struct{}{}
		ids = append(ids, b.ClientUserID)
	}

	userByID := map[primitive.ObjectID]models.User{}
	if len(ids) > 0 {
		uc, err := h.DB.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
		if err == nil {
			defer uc.Close(ctx)
			var users []models.User
			if err := uc.All(ctx, &users); err == nil {
				for _, u := range users {
					userByID[u.ID] = u
				}
			}
		}
	}

	type serviceSummary struct {
		ServiceTypeID   string
		ServiceTypeName string
		BookingsCount   int
		PeopleCount     int
		RevenueCents    int64
		DepositCents    int64
		Details         []gin.H
		seenPeople      map[string]struct{}
	}

	byService := map[string]*serviceSummary{}
	for _, b := range list {
		key := b.ServiceTypeID.Hex()
		s, ok := byService[key]
		if !ok {
			s = &serviceSummary{
				ServiceTypeID:   key,
				ServiceTypeName: b.ServiceTypeName,
				seenPeople:      map[string]struct{}{},
			}
			byService[key] = s
		}
		s.BookingsCount++
		s.RevenueCents += b.PriceCents
		s.DepositCents += b.DepositCents

		clientName := "Sans compte"
		clientID := ""
		if !b.ClientUserID.IsZero() {
			clientID = b.ClientUserID.Hex()
			if u, ok := userByID[b.ClientUserID]; ok {
				fullName := strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
				if fullName != "" {
					clientName = fullName
				}
			}
			if _, seen := s.seenPeople[clientID]; !seen {
				s.seenPeople[clientID] = struct{}{}
				s.PeopleCount++
			}
		}

		s.Details = append(s.Details, gin.H{
			"bookingId":      b.ID.Hex(),
			"date":           b.Date,
			"time":           b.Time,
			"endTime":        b.EndTime,
			"paymentStatus":  b.PaymentStatus,
			"visitStatus":    b.VisitStatus,
			"visitLabelFR":   visitDisplayLabel(b),
			"clientUserId":   clientID,
			"clientName":     clientName,
			"priceCents":     b.PriceCents,
			"depositCents":   b.DepositCents,
			"description":    b.Description,
			"publicToken":    b.PublicToken,
		})
	}

	services := make([]gin.H, 0, len(byService))
	for _, s := range byService {
		services = append(services, gin.H{
			"serviceTypeId":   s.ServiceTypeID,
			"serviceTypeName": s.ServiceTypeName,
			"bookingsCount":   s.BookingsCount,
			"peopleCount":     s.PeopleCount,
			"revenueCents":    s.RevenueCents,
			"depositCents":    s.DepositCents,
			"details":         s.Details,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"period":   period,
		"services": services,
	})
}

func (h *Handlers) AdminCreateBooking(c *gin.Context) {
	var body createBookingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	if body.PriceCents <= 0 || body.DepositCents <= 0 || body.DepositCents > body.PriceCents {
		c.JSON(http.StatusBadRequest, gin.H{"error": "montants invalides"})
		return
	}
	stID, err := primitive.ObjectIDFromHex(body.ServiceTypeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type de prestation invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var st models.ServiceType
	if err := h.DB.Collection("service_types").FindOne(ctx, bson.M{"_id": stID}).Decode(&st); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type de prestation introuvable"})
		return
	}
	uidHex := middleware.UserID(c)
	adminID, _ := primitive.ObjectIDFromHex(uidHex)
	now := time.Now().UTC()
	inspRequired := false
	if body.InspirationRequired != nil {
		inspRequired = *body.InspirationRequired
	}
	b := models.Booking{
		PublicToken:         strings.ReplaceAll(uuid.NewString(), "-", ""),
		ServiceTypeID:       stID,
		ServiceTypeName:     st.Name,
		Date:                strings.TrimSpace(body.Date),
		Time:                strings.TrimSpace(body.Time),
		EndTime:             strings.TrimSpace(body.EndTime),
		PriceCents:          body.PriceCents,
		DepositCents:        body.DepositCents,
		Description:         strings.TrimSpace(body.Description),
		InspirationRequired: inspRequired,
		PaymentStatus:       "pending",
		CreatedByUserID:     adminID,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	res, err := h.DB.Collection("bookings").InsertOne(ctx, b)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création impossible"})
		return
	}
	id := res.InsertedID.(primitive.ObjectID)
	publicURL := h.Config.FrontendURL + "/reservation/" + b.PublicToken
	c.JSON(http.StatusCreated, gin.H{
		"id":         id.Hex(),
		"publicToken": b.PublicToken,
		"publicUrl":  publicURL,
	})
}

func (h *Handlers) AdminListBookings(c *gin.Context) {
	when := strings.ToLower(strings.TrimSpace(c.Query("when")))
	filter := bson.M{}
	switch when {
	case "past":
		filter["date"] = bson.M{"$lt": time.Now().UTC().Format("2006-01-02")}
	case "upcoming":
		filter["date"] = bson.M{"$gte": time.Now().UTC().Format("2006-01-02")}
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("bookings").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "liste impossible"})
		return
	}
	defer cur.Close(ctx)
	var list []models.Booking
	_ = cur.All(ctx, &list)

	ids := make([]primitive.ObjectID, 0)
	seenID := map[primitive.ObjectID]struct{}{}
	for _, b := range list {
		if b.ClientUserID.IsZero() {
			continue
		}
		if _, dup := seenID[b.ClientUserID]; dup {
			continue
		}
		seenID[b.ClientUserID] = struct{}{}
		ids = append(ids, b.ClientUserID)
	}
	userByID := map[primitive.ObjectID]models.User{}
	if len(ids) > 0 {
		uc, err := h.DB.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
		if err == nil {
			defer uc.Close(ctx)
			var users []models.User
			if err := uc.All(ctx, &users); err == nil {
				for _, u := range users {
					userByID[u.ID] = u
				}
			}
		}
	}

	out := make([]gin.H, 0, len(list))
	for _, b := range list {
		j := bookingToJSON(b)
		if !b.ClientUserID.IsZero() {
			if u, ok := userByID[b.ClientUserID]; ok {
				j["clientName"] = strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
			}
		}
		out = append(out, j)
	}
	c.JSON(http.StatusOK, gin.H{"bookings": out})
}

func (h *Handlers) AdminPatchBooking(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body createBookingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	stID, err := primitive.ObjectIDFromHex(body.ServiceTypeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type de prestation invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var st models.ServiceType
	if err := h.DB.Collection("service_types").FindOne(ctx, bson.M{"_id": stID}).Decode(&st); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type de prestation introuvable"})
		return
	}
	if body.PriceCents <= 0 || body.DepositCents <= 0 || body.DepositCents > body.PriceCents {
		c.JSON(http.StatusBadRequest, gin.H{"error": "montants invalides"})
		return
	}

	// État avant modification : sert au diff envoyé au client et au garde-fou
	// sur les rendez-vous passés.
	var existing models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if existing.Date < time.Now().UTC().Format("2006-01-02") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "rendez-vous passé : modification impossible",
		})
		return
	}

	updated := existing
	updated.ServiceTypeID = stID
	updated.ServiceTypeName = st.Name
	updated.Date = strings.TrimSpace(body.Date)
	updated.Time = strings.TrimSpace(body.Time)
	updated.EndTime = strings.TrimSpace(body.EndTime)
	updated.PriceCents = body.PriceCents
	updated.DepositCents = body.DepositCents
	updated.Description = strings.TrimSpace(body.Description)
	if body.InspirationRequired != nil {
		updated.InspirationRequired = *body.InspirationRequired
	}

	set := bson.M{
		"service_type_id":   updated.ServiceTypeID,
		"service_type_name": updated.ServiceTypeName,
		"date":              updated.Date,
		"time":              updated.Time,
		"end_time":          updated.EndTime,
		"price_cents":       updated.PriceCents,
		"deposit_cents":     updated.DepositCents,
		"description":       updated.Description,
		"updated_at":        time.Now().UTC(),
	}
	if body.InspirationRequired != nil {
		set["inspiration_required"] = *body.InspirationRequired
	}
	res, err := h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}

	// Prévenir le client de ce qui a changé (best-effort, hors requête).
	changes := bookingChanges(existing, updated)
	notified := false
	if len(changes) > 0 {
		if to := h.bookingClientEmail(ctx, existing); to != "" {
			notified = true
			go func() {
				if err := mail.SendBookingUpdateNotification(h.Config, to, updated, changes); err != nil {
					log.Printf("booking update mail error: %v", err)
				}
			}()
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":             true,
		"changes":        len(changes),
		"clientNotified": notified,
	})
}

// bookingClientEmail : e-mail du client (visiteur ou compte lié), vide si aucun.
func (h *Handlers) bookingClientEmail(ctx context.Context, b models.Booking) string {
	if s := strings.TrimSpace(b.CustomerEmail); s != "" {
		return s
	}
	if b.ClientUserID.IsZero() {
		return ""
	}
	var u models.User
	if err := h.DB.Collection("users").FindOne(ctx, bson.M{"_id": b.ClientUserID}).Decode(&u); err != nil {
		return ""
	}
	return strings.TrimSpace(u.Email)
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return strings.TrimSpace(s)
}

func eurLabel(cents int64) string {
	return strings.Replace(fmt.Sprintf("%.2f €", float64(cents)/100), ".", ",", 1)
}

// bookingChanges liste les champs modifiés, formatés pour l'e-mail client.
func bookingChanges(old, next models.Booking) []mail.BookingChange {
	var out []mail.BookingChange
	add := func(label, o, n string) {
		if o != n {
			out = append(out, mail.BookingChange{Label: label, Old: o, New: n})
		}
	}
	add("Prestation", orDash(old.ServiceTypeName), orDash(next.ServiceTypeName))
	add("Date", orDash(old.Date), orDash(next.Date))
	add("Heure de début", orDash(old.Time), orDash(next.Time))
	add("Heure de fin", orDash(old.EndTime), orDash(next.EndTime))
	if old.PriceCents != next.PriceCents {
		add("Montant total", eurLabel(old.PriceCents), eurLabel(next.PriceCents))
	}
	if old.DepositCents != next.DepositCents {
		add("Acompte", eurLabel(old.DepositCents), eurLabel(next.DepositCents))
	}
	add("Description", orDash(old.Description), orDash(next.Description))
	if old.InspirationRequired != next.InspirationRequired {
		label := func(v bool) string {
			if v {
				return "Obligatoires avant paiement"
			}
			return "Non demandées"
		}
		add("Images d'inspiration", label(old.InspirationRequired), label(next.InspirationRequired))
	}
	return out
}

type rescheduleBookingBody struct {
	Date    string `json:"date" binding:"required"`
	Time    string `json:"time" binding:"required"`
	EndTime string `json:"endTime"`
}

func (h *Handlers) AdminRescheduleBooking(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body rescheduleBookingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Charger le booking avant modification pour conserver l'ancienne date/heure
	var existing models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	oldDate := existing.Date
	oldTime := existing.Time

	set := bson.M{
		"date":       strings.TrimSpace(body.Date),
		"time":       strings.TrimSpace(body.Time),
		"end_time":   strings.TrimSpace(body.EndTime),
		"updated_at": time.Now().UTC(),
	}
	res, err := h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}

	// Envoyer l'e-mail de confirmation au client (best-effort)
	existing.Date = strings.TrimSpace(body.Date)
	existing.Time = strings.TrimSpace(body.Time)
	existing.EndTime = strings.TrimSpace(body.EndTime)

	go func() {
		clientEmail := strings.TrimSpace(existing.CustomerEmail)
		if clientEmail == "" && !existing.ClientUserID.IsZero() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer bgCancel()
			var u models.User
			if err := h.DB.Collection("users").FindOne(bgCtx, bson.M{"_id": existing.ClientUserID}).Decode(&u); err == nil {
				clientEmail = strings.TrimSpace(u.Email)
			}
		}
		if clientEmail == "" {
			return
		}
		if err := mail.SendRescheduleNotification(h.Config, clientEmail, existing, oldDate, oldTime); err != nil {
			log.Printf("reschedule mail error: %v", err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) AdminDeleteBooking(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	dr, err := h.DB.Collection("bookings").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "suppression impossible"})
		return
	}
	if dr.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if h.Files != nil {
		_ = h.Files.RemoveBooking(oid.Hex())
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func visitDisplayLabel(b models.Booking) string {
	switch {
	case b.VisitStatus == models.VisitCompleted:
		return "Terminée"
	case b.VisitStatus == models.VisitInProgress && b.VisitPointsAwarded:
		return "Terminée"
	case b.VisitStatus == models.VisitInProgress:
		return "Présent"
	case b.VisitStatus == models.VisitPendingValidation:
		return "À valider"
	default:
		return ""
	}
}

// visitLabelForPublicPage : page client — pas de « À valider » une fois l’acompte ou le total payé.
func visitLabelForPublicPage(b models.Booking) string {
	paidEnough := b.PaymentStatus == "paid" || b.PaymentStatus == "deposit_paid"
	waitingPresence := b.VisitStatus == models.VisitPendingValidation || b.VisitStatus == ""
	if paidEnough && waitingPresence {
		return "Confirmé"
	}
	return visitDisplayLabel(b)
}

func bookingToJSON(b models.Booking) gin.H {
	out := gin.H{
		"id":                   b.ID.Hex(),
		"publicToken":          b.PublicToken,
		"publicUrl":            "", // filled by caller if needed
		"serviceTypeId":        b.ServiceTypeID.Hex(),
		"serviceTypeName":      b.ServiceTypeName,
		"date":                 b.Date,
		"time":                 b.Time,
		"endTime":              b.EndTime,
		"priceCents":           b.PriceCents,
		"depositCents":         b.DepositCents,
		"description":          b.Description,
		"inspirationRequired":  b.InspirationRequired,
		"inspirationImages":    inspirationImagesPublicJSON(b.PublicToken, b.InspirationImages),
		"paymentStatus":        b.PaymentStatus,
		"visitStatus":          b.VisitStatus,
		"visitLabelFR":         visitDisplayLabel(b),
		"visitPointsAwarded":   b.VisitPointsAwarded,
		"createdAt":            b.CreatedAt,
		"updatedAt":            b.UpdatedAt,
	}
	if !b.ClientUserID.IsZero() {
		out["clientUserId"] = b.ClientUserID.Hex()
	}
	if b.ClientUserID.IsZero() {
		if s := strings.TrimSpace(b.GuestFirstName); s != "" {
			out["guestFirstName"] = s
		}
		if s := strings.TrimSpace(b.GuestLastName); s != "" {
			out["guestLastName"] = s
		}
		if s := strings.TrimSpace(b.CustomerEmail); s != "" {
			out["guestEmail"] = s
		}
	}
	if b.BalancePaidMethod != "" {
		out["balancePaidMethod"] = b.BalancePaidMethod
		out["balancePaidLabelFR"] = balancePaidMethodLabelFR(b.BalancePaidMethod)
	}
	return out
}

func balancePaidMethodLabelFR(m string) string {
	switch m {
	case models.BalancePaidCash:
		return "Espèces"
	case models.BalancePaidBankTransfer:
		return "Virement bancaire"
	default:
		return m
	}
}

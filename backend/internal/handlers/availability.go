package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"pinkstarsociety/internal/bookingtime"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const availabilityCollection = "availability_months"

type availabilityBody struct {
	Days      []models.DayAvailability `json:"days"`
	Published *bool                    `json:"published,omitempty"`
}

func parseYearMonthParams(c *gin.Context) (year, month int, ok bool) {
	year, err1 := strconv.Atoi(c.Param("year"))
	month, err2 := strconv.Atoi(c.Param("month"))
	if err1 != nil || err2 != nil || year < 2000 || year > 2100 || month < 1 || month > 12 {
		return 0, 0, false
	}
	return year, month, true
}

func daysInMonth(year, month int) int {
	return time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC).Day()
}

func isValidSlotStatus(s string) bool {
	return s == "open" || s == "blocked"
}

func defaultMonthAvailability(year, month int) models.MonthAvailability {
	total := daysInMonth(year, month)
	days := make([]models.DayAvailability, 0, total)
	for d := 1; d <= total; d++ {
		wd := time.Date(year, time.Month(month), d, 0, 0, 0, 0, time.UTC).Weekday()
		isWeekend := wd == time.Saturday || wd == time.Sunday
		slot := "open"
		if isWeekend {
			slot = "blocked"
		}
		days = append(days, models.DayAvailability{
			Day:       d,
			Morning:   slot,
			Afternoon: slot,
		})
	}
	return models.MonthAvailability{
		Year:      year,
		Month:     month,
		Published: false,
		Days:      days,
	}
}

func validateMonthAvailability(m models.MonthAvailability) bool {
	expected := daysInMonth(m.Year, m.Month)
	if len(m.Days) != expected {
		return false
	}
	seen := make(map[int]bool, expected)
	for _, d := range m.Days {
		if d.Day < 1 || d.Day > expected || seen[d.Day] {
			return false
		}
		if !isValidSlotStatus(d.Morning) || !isValidSlotStatus(d.Afternoon) {
			return false
		}
		seen[d.Day] = true
	}
	return len(seen) == expected
}

func monthAvailabilityJSON(m models.MonthAvailability) gin.H {
	days := make([]gin.H, 0, len(m.Days))
	for _, d := range m.Days {
		days = append(days, gin.H{
			"day":       d.Day,
			"morning":   d.Morning,
			"afternoon": d.Afternoon,
		})
	}
	out := gin.H{
		"year":      m.Year,
		"month":     m.Month,
		"published": m.Published,
		"days":      days,
	}
	if !m.UpdatedAt.IsZero() {
		out["updatedAt"] = m.UpdatedAt
	}
	return out
}

func (h *Handlers) loadMonthAvailability(ctx context.Context, year, month int) (models.MonthAvailability, bool, error) {
	var doc models.MonthAvailability
	err := h.DB.Collection(availabilityCollection).FindOne(ctx, bson.M{
		"year":  year,
		"month": month,
	}).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return models.MonthAvailability{}, false, nil
		}
		return models.MonthAvailability{}, false, err
	}
	return doc, true, nil
}

func (h *Handlers) upsertMonthAvailability(ctx context.Context, m models.MonthAvailability) error {
	m.UpdatedAt = time.Now().UTC()
	_, err := h.DB.Collection(availabilityCollection).UpdateOne(
		ctx,
		bson.M{"year": m.Year, "month": m.Month},
		bson.M{"$set": m},
		options.Update().SetUpsert(true),
	)
	return err
}

func (h *Handlers) confirmedBookingsForMonth(ctx context.Context, year, month int) ([]models.Booking, error) {
	from := fmt.Sprintf("%04d-%02d-01", year, month)
	nextY, nextM := year, month+1
	if nextM > 12 {
		nextM = 1
		nextY++
	}
	to := fmt.Sprintf("%04d-%02d-01", nextY, nextM)

	cur, err := h.DB.Collection("bookings").Find(ctx, bson.M{
		"date":           bson.M{"$gte": from, "$lt": to},
		"payment_status": bson.M{"$in": []string{"deposit_paid", "paid"}},
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var bookings []models.Booking
	if err := cur.All(ctx, &bookings); err != nil {
		return nil, err
	}
	return bookings, nil
}

func applyBookingsToMonth(m *models.MonthAvailability, bookings []models.Booking) {
	target := fmt.Sprintf("%04d-%02d", m.Year, m.Month)
	for _, b := range bookings {
		if len(b.Date) < len(target) || b.Date[:len(target)] != target {
			continue
		}
		parts := splitDateParts(b.Date)
		if len(parts) != 3 {
			continue
		}
		day, err := strconv.Atoi(parts[2])
		if err != nil || day < 1 {
			continue
		}
		for i := range m.Days {
			if m.Days[i].Day != day {
				continue
			}
			if bookingtime.OverlapsHalfDayWindow(b, "morning") {
				m.Days[i].Morning = "blocked"
			}
			if bookingtime.OverlapsHalfDayWindow(b, "afternoon") {
				m.Days[i].Afternoon = "blocked"
			}
			break
		}
	}
}

func splitDateParts(date string) []string {
	out := make([]string, 0, 3)
	start := 0
	for i := 0; i < len(date); i++ {
		if date[i] == '-' {
			out = append(out, date[start:i])
			start = i + 1
		}
	}
	out = append(out, date[start:])
	return out
}

// AdminGetAvailability GET /api/admin/availability/:year/:month
func (h *Handlers) AdminGetAvailability(c *gin.Context) {
	year, month, ok := parseYearMonthParams(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	doc, found, err := h.loadMonthAvailability(ctx, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lecture impossible"})
		return
	}
	if !found {
		c.JSON(http.StatusOK, monthAvailabilityJSON(defaultMonthAvailability(year, month)))
		return
	}
	c.JSON(http.StatusOK, monthAvailabilityJSON(doc))
}

// AdminPutAvailability PUT /api/admin/availability/:year/:month
func (h *Handlers) AdminPutAvailability(c *gin.Context) {
	year, month, ok := parseYearMonthParams(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	var body availabilityBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}

	doc := models.MonthAvailability{
		Year:  year,
		Month: month,
		Days:  body.Days,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	existing, found, _ := h.loadMonthAvailability(ctx, year, month)
	if found {
		doc.Published = existing.Published
	}
	if body.Published != nil {
		doc.Published = *body.Published
	}

	if !validateMonthAvailability(doc) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "grille de disponibilités invalide"})
		return
	}

	if err := h.upsertMonthAvailability(ctx, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sauvegarde impossible"})
		return
	}

	saved, _, _ := h.loadMonthAvailability(ctx, year, month)
	c.JSON(http.StatusOK, monthAvailabilityJSON(saved))
}

// AdminPublishAvailability POST /api/admin/availability/:year/:month/publish
func (h *Handlers) AdminPublishAvailability(c *gin.Context) {
	year, month, ok := parseYearMonthParams(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	doc, found, err := h.loadMonthAvailability(ctx, year, month)
	if err != nil || !found {
		doc = defaultMonthAvailability(year, month)
	}
	doc.Published = true

	if err := h.upsertMonthAvailability(ctx, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "publication impossible"})
		return
	}

	saved, _, _ := h.loadMonthAvailability(ctx, year, month)
	c.JSON(http.StatusOK, monthAvailabilityJSON(saved))
}

// AdminUnpublishAvailability POST /api/admin/availability/:year/:month/unpublish
func (h *Handlers) AdminUnpublishAvailability(c *gin.Context) {
	year, month, ok := parseYearMonthParams(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "année / mois invalide"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	doc, found, err := h.loadMonthAvailability(ctx, year, month)
	if err != nil || !found {
		doc = defaultMonthAvailability(year, month)
	}
	doc.Published = false

	if err := h.upsertMonthAvailability(ctx, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "dépublication impossible"})
		return
	}

	saved, _, _ := h.loadMonthAvailability(ctx, year, month)
	c.JSON(http.StatusOK, monthAvailabilityJSON(saved))
}

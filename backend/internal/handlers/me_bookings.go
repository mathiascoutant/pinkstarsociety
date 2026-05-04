package handlers

import (
	"context"
	"net/http"
	"time"

	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (h *Handlers) ClientListBookings(c *gin.Context) {
	role := c.GetString("role")
	if role != models.RoleClient && role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
		return
	}
	idHex := c.GetString("userID")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("bookings").Find(ctx, bson.M{"client_user_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "liste impossible"})
		return
	}
	defer cur.Close(ctx)
	var list []models.Booking
	_ = cur.All(ctx, &list)
	out := make([]gin.H, 0, len(list))
	base := h.Config.FrontendURL
	for _, b := range list {
		j := bookingToJSON(b)
		delete(j, "endTime")
		j["visitLabelFR"] = visitLabelForPublicPage(b)
		j["publicUrl"] = base + "/reservation/" + b.PublicToken
		out = append(out, j)
	}
	c.JSON(http.StatusOK, gin.H{"bookings": out})
}

func (h *Handlers) ClientGetBooking(c *gin.Context) {
	role := c.GetString("role")
	if role != models.RoleClient && role != models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
		return
	}
	idHex := c.GetString("userID")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
		return
	}
	bid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{
		"_id":             bid,
		"client_user_id": oid,
	}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "prestation introuvable"})
		return
	}
	j := bookingToJSON(b)
	delete(j, "endTime")
	j["visitLabelFR"] = visitLabelForPublicPage(b)
	j["publicUrl"] = h.Config.FrontendURL + "/reservation/" + b.PublicToken
	c.JSON(http.StatusOK, j)
}

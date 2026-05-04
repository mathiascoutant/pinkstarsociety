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

type verifyArrivalBody struct {
	Scanned string `json:"scanned" binding:"required"`
}

func (h *Handlers) AdminVerifyClientArrival(c *gin.Context) {
	idHex := c.Param("id")
	bid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "réservation invalide"})
		return
	}
	var body verifyArrivalBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scan invalide"})
		return
	}
	token := parseClientQRPayload(body.Scanned)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QR code illisible"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var u models.User
	if err := h.DB.Collection("users").FindOne(ctx, bson.M{"qr_token": token}).Decode(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QR code inconnu — ce n'est pas un client enregistré"})
		return
	}
	if u.Role != models.RoleClient && u.Role != models.RoleAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QR invalide pour ce compte"})
		return
	}

	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bid}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "prestation introuvable"})
		return
	}
	if b.ClientUserID.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aucun client n'est associé à cette prestation (paiement sans compte ?)"})
		return
	}
	if b.ClientUserID != u.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ce n'est pas le bon client pour cette prestation"})
		return
	}
	if b.PaymentStatus != "deposit_paid" && b.PaymentStatus != "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Le paiement n'est pas validé pour cette prestation"})
		return
	}
	if b.VisitStatus == models.VisitInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La présence est déjà enregistrée"})
		return
	}
	if b.VisitStatus != models.VisitPendingValidation {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Statut de visite inattendu — impossible de valider l'arrivée"})
		return
	}

	pts := b.PriceCents / 100
	if pts < 1 {
		pts = 1
	}

	_, err = h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{"$set": bson.M{
		"visit_status":         models.VisitInProgress,
		"visit_points_awarded": false,
		"updated_at":           time.Now().UTC(),
	}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}

	var u2 models.User
	_ = h.DB.Collection("users").FindOne(ctx, bson.M{"_id": u.ID}).Decode(&u2)

	c.JSON(http.StatusOK, gin.H{
		"ok":            true,
		"visitStatus":   models.VisitInProgress,
		"publicToken":   b.PublicToken,
		"pointsPending": pts,
		"clientName":    u.FirstName + " " + u.LastName,
		"totalPoints":   u2.LoyaltyPoints,
	})
}

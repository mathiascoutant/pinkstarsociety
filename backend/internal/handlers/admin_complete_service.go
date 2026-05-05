package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type completeServiceBody struct {
	BalancePaidMethod string `json:"balancePaidMethod"`
}

func (h *Handlers) AdminCompleteService(c *gin.Context) {
	idHex := c.Param("id")
	bid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "réservation invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bid}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "prestation introuvable"})
		return
	}
	if b.ClientUserID.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aucun client n'est associé à cette prestation"})
		return
	}
	if b.VisitStatus != models.VisitInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valide d'abord la présence du client (scan du QR)."})
		return
	}
	if b.VisitPointsAwarded {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Les points fidélité ont déjà été attribués pour cette prestation."})
		return
	}

	var body completeServiceBody
	_ = c.ShouldBindJSON(&body)
	method := strings.ToLower(strings.TrimSpace(body.BalancePaidMethod))
	if b.PaymentStatus != "paid" {
		if method != models.BalancePaidCash && method != models.BalancePaidBankTransfer {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Indique si le solde a été réglé en espèces ou par virement bancaire."})
			return
		}
	}

	pts := b.PriceCents / 100
	if pts < 1 {
		pts = 1
	}

	set := bson.M{
		"visit_status":         models.VisitCompleted,
		"visit_points_awarded": true,
		"updated_at":           time.Now().UTC(),
	}
	if b.PaymentStatus != "paid" {
		set["balance_paid_method"] = method
		set["payment_status"] = "paid"
	}

	res, err := h.DB.Collection("bookings").UpdateOne(ctx,
		bson.M{
			"_id":                  b.ID,
			"visit_status":         models.VisitInProgress,
			"visit_points_awarded": false,
		},
		bson.M{"$set": set},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.ModifiedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Impossible de clôturer — recharge la page et réessaie."})
		return
	}

	_, err = h.DB.Collection("users").UpdateOne(
		ctx,
		bson.M{"_id": b.ClientUserID},
		bson.A{
			bson.M{
				"$set": bson.M{
					"loyalty_points": bson.M{
						"$add": bson.A{
							bson.M{"$ifNull": bson.A{"$loyalty_points", 0}},
							pts,
						},
					},
					"loyalty_progress_count": bson.M{
						"$mod": bson.A{
							bson.M{
								"$add": bson.A{
									bson.M{"$ifNull": bson.A{"$loyalty_progress_count", 0}},
									1,
								},
							},
							10,
						},
					},
				},
			},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "crédit des points impossible"})
		return
	}

	var u2 models.User
	_ = h.DB.Collection("users").FindOne(ctx, bson.M{"_id": b.ClientUserID}).Decode(&u2)

	c.JSON(http.StatusOK, gin.H{
		"ok":                   true,
		"visitStatus":          models.VisitCompleted,
		"pointsAdded":          pts,
		"totalPoints":          u2.LoyaltyPoints,
		"loyaltyProgressCount": u2.LoyaltyProgressCount,
	})
}

package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/auth"
	"pinkstarsociety/internal/middleware"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type userBookingStats struct {
	TotalCompleted  int
	LastServiceName string
}

func (h *Handlers) userBookingStatsByClientID(ctx context.Context) (map[primitive.ObjectID]userBookingStats, error) {
	cur, err := h.DB.Collection("bookings").Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{
			"visit_points_awarded": true,
			"client_user_id":       bson.M{"$exists": true, "$ne": primitive.NilObjectID},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "updated_at", Value: -1}}}},
		{{Key: "$group", Value: bson.M{
			"_id":             "$client_user_id",
			"totalCompleted":  bson.M{"$sum": 1},
			"lastServiceName": bson.M{"$first": "$service_type_name"},
		}}},
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	out := make(map[primitive.ObjectID]userBookingStats)
	for cur.Next(ctx) {
		var row struct {
			ID              primitive.ObjectID `bson:"_id"`
			TotalCompleted  int                `bson:"totalCompleted"`
			LastServiceName string             `bson:"lastServiceName"`
		}
		if cur.Decode(&row) != nil {
			continue
		}
		out[row.ID] = userBookingStats{
			TotalCompleted:  row.TotalCompleted,
			LastServiceName: row.LastServiceName,
		}
	}
	return out, cur.Err()
}

func (h *Handlers) AdminListUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	statsByUser, err := h.userBookingStatsByClientID(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "statistiques fidélité impossibles"})
		return
	}

	cur, err := h.DB.Collection("users").Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "liste impossible"})
		return
	}
	defer cur.Close(ctx)
	var out []gin.H
	for cur.Next(ctx) {
		var u models.User
		if cur.Decode(&u) != nil {
			continue
		}
		stats := statsByUser[u.ID]
		totalCompleted := u.TotalCompletedServices
		if totalCompleted < stats.TotalCompleted {
			totalCompleted = stats.TotalCompleted
		}
		if totalCompleted == 0 && u.LoyaltyProgressCount > 0 {
			totalCompleted = u.LoyaltyProgressCount
		}
		out = append(out, gin.H{
			"id":                     u.ID.Hex(),
			"firstName":              u.FirstName,
			"lastName":               u.LastName,
			"email":                  u.Email,
			"role":                   u.Role,
			"createdAt":              u.CreatedAt,
			"loyaltyPoints":          u.LoyaltyPoints,
			"loyaltyProgressCount":   u.LoyaltyProgressCount,
			"totalCompletedServices": totalCompleted,
			"lastServiceName":        stats.LastServiceName,
		})
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

type patchUserBody struct {
	FirstName              *string `json:"firstName"`
	LastName               *string `json:"lastName"`
	Email                  *string `json:"email"`
	Role                   *string `json:"role"`
	Password               *string `json:"password"`
	LoyaltyPoints          *int    `json:"loyaltyPoints"`
	LoyaltyProgressCount   *int    `json:"loyaltyProgressCount"`
	TotalCompletedServices *int    `json:"totalCompletedServices"`
}

func (h *Handlers) AdminPatchUser(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body patchUserBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	set := bson.M{}
	if body.FirstName != nil {
		set["first_name"] = strings.TrimSpace(*body.FirstName)
	}
	if body.LastName != nil {
		set["last_name"] = strings.TrimSpace(*body.LastName)
	}
	if body.Email != nil {
		set["email"] = strings.ToLower(strings.TrimSpace(*body.Email))
	}
	if body.Role != nil {
		r := strings.TrimSpace(*body.Role)
		if r != models.RoleClient && r != models.RoleAdmin {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rôle invalide"})
			return
		}
		set["role"] = r
	}
	if body.Password != nil && strings.TrimSpace(*body.Password) != "" {
		if len(strings.TrimSpace(*body.Password)) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe trop court"})
			return
		}
		hash, err := auth.HashPassword(strings.TrimSpace(*body.Password))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur"})
			return
		}
		set["password_hash"] = hash
	}
	if body.LoyaltyPoints != nil {
		if *body.LoyaltyPoints < 0 || *body.LoyaltyPoints > 1000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "points fidélité invalides (0 à 1000)"})
			return
		}
		points := *body.LoyaltyPoints
		if points == 1000 {
			points = 0
		}
		set["loyalty_points"] = points
	}
	if body.LoyaltyProgressCount != nil {
		if *body.LoyaltyProgressCount < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "progression fidélité invalide"})
			return
		}
		set["loyalty_progress_count"] = *body.LoyaltyProgressCount
	}
	if body.TotalCompletedServices != nil {
		if *body.TotalCompletedServices < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nombre de prestations invalide"})
			return
		}
		set["total_completed_services"] = *body.TotalCompletedServices
	}
	if len(set) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ à modifier"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "email déjà utilisé"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) AdminDeleteUser(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	self := middleware.UserID(c)
	if self == idHex {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vous ne pouvez pas supprimer votre propre compte"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	dr, err := h.DB.Collection("users").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "suppression impossible"})
		return
	}
	if dr.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

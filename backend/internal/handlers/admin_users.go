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

func (h *Handlers) AdminListUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
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
		out = append(out, gin.H{
			"id":        u.ID.Hex(),
			"firstName": u.FirstName,
			"lastName":  u.LastName,
			"email":     u.Email,
			"role":      u.Role,
			"createdAt": u.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

type patchUserBody struct {
	FirstName *string `json:"firstName"`
	LastName  *string `json:"lastName"`
	Email     *string `json:"email"`
	Role      *string `json:"role"`
	Password  *string `json:"password"`
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

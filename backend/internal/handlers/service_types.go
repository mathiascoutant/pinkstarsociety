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

type serviceTypeBody struct {
	Name string `json:"name" binding:"required"`
}

func (h *Handlers) ListServiceTypes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("service_types").Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "liste impossible"})
		return
	}
	defer cur.Close(ctx)
	var items []models.ServiceType
	_ = cur.All(ctx, &items)
	out := make([]gin.H, 0, len(items))
	for _, s := range items {
		out = append(out, gin.H{
			"id":        s.ID.Hex(),
			"name":      s.Name,
			"createdAt": s.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"serviceTypes": out})
}

func (h *Handlers) CreateServiceType(c *gin.Context) {
	var body serviceTypeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nom requis"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nom requis"})
		return
	}
	s := models.ServiceType{Name: name, CreatedAt: time.Now().UTC()}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("service_types").InsertOne(ctx, s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création impossible"})
		return
	}
	id := res.InsertedID.(primitive.ObjectID)
	c.JSON(http.StatusCreated, gin.H{"id": id.Hex(), "name": name})
}

func (h *Handlers) PatchServiceType(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body serviceTypeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nom requis"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("service_types").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{"name": name}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "prestation introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) DeleteServiceType(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	dr, err := h.DB.Collection("service_types").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "suppression impossible"})
		return
	}
	if dr.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "prestation introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

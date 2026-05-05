package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var errLoyaltyCodeInvalid = errors.New("invalid loyalty code")

type loyaltyCodeBody struct {
	Code    string `json:"code" binding:"required"`
	Points  int    `json:"points" binding:"required"`
	MaxUses int    `json:"maxUses" binding:"required"`
}

type patchLoyaltyCodeBody struct {
	Code     *string `json:"code"`
	Points   *int    `json:"points"`
	MaxUses  *int    `json:"maxUses"`
	IsActive *bool   `json:"isActive"`
}

func normalizeLoyaltyCode(v string) string {
	return strings.ToUpper(strings.TrimSpace(v))
}

func (h *Handlers) consumeLoyaltyCode(ctx context.Context, rawCode string) (primitive.ObjectID, int, error) {
	code := normalizeLoyaltyCode(rawCode)
	if code == "" {
		return primitive.NilObjectID, 0, errLoyaltyCodeInvalid
	}
	filter := bson.M{
		"code":      code,
		"is_active": true,
		"$expr": bson.M{
			"$lt": []any{"$usage_count", "$max_uses"},
		},
	}
	update := bson.M{
		"$inc": bson.M{"usage_count": 1},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	}
	var out models.LoyaltyCode
	err := h.DB.Collection("loyalty_codes").
		FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).
		Decode(&out)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return primitive.NilObjectID, 0, errLoyaltyCodeInvalid
		}
		return primitive.NilObjectID, 0, err
	}
	return out.ID, out.Points, nil
}

func (h *Handlers) rollbackConsumeLoyaltyCode(ctx context.Context, id primitive.ObjectID) {
	if id.IsZero() {
		return
	}
	_, _ = h.DB.Collection("loyalty_codes").UpdateOne(ctx, bson.M{
		"_id":         id,
		"usage_count": bson.M{"$gt": 0},
	}, bson.M{
		"$inc": bson.M{"usage_count": -1},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	})
}

func (h *Handlers) ListLoyaltyCodes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	cur, err := h.DB.Collection("loyalty_codes").Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "liste impossible"})
		return
	}
	defer cur.Close(ctx)
	var items []models.LoyaltyCode
	_ = cur.All(ctx, &items)
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id":         it.ID.Hex(),
			"code":       it.Code,
			"points":     it.Points,
			"maxUses":    it.MaxUses,
			"usageCount": it.UsageCount,
			"isActive":   it.IsActive,
			"createdAt":  it.CreatedAt,
			"updatedAt":  it.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"loyaltyCodes": out})
}

func (h *Handlers) CreateLoyaltyCode(c *gin.Context) {
	var body loyaltyCodeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	code := normalizeLoyaltyCode(body.Code)
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code requis"})
		return
	}
	if body.Points <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "points invalides"})
		return
	}
	if body.MaxUses <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nombre d'utilisations max invalide"})
		return
	}
	now := time.Now().UTC()
	item := models.LoyaltyCode{
		Code:       code,
		Points:     body.Points,
		MaxUses:    body.MaxUses,
		UsageCount: 0,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("loyalty_codes").InsertOne(ctx, item)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "ce code existe déjà"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création impossible"})
		return
	}
	id := res.InsertedID.(primitive.ObjectID)
	c.JSON(http.StatusCreated, gin.H{"id": id.Hex()})
}

func (h *Handlers) PatchLoyaltyCode(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body patchLoyaltyCodeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	set := bson.M{}
	if body.Code != nil {
		code := normalizeLoyaltyCode(*body.Code)
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "code invalide"})
			return
		}
		set["code"] = code
	}
	if body.Points != nil {
		if *body.Points <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "points invalides"})
			return
		}
		set["points"] = *body.Points
	}
	if body.MaxUses != nil {
		if *body.MaxUses <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nombre d'utilisations max invalide"})
			return
		}
		set["max_uses"] = *body.MaxUses
	}
	if body.IsActive != nil {
		set["is_active"] = *body.IsActive
	}
	if len(set) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ à modifier"})
		return
	}
	set["updated_at"] = time.Now().UTC()
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("loyalty_codes").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "ce code existe déjà"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "code introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) DeleteLoyaltyCode(c *gin.Context) {
	idHex := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	dr, err := h.DB.Collection("loyalty_codes").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "suppression impossible"})
		return
	}
	if dr.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "code introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

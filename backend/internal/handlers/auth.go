package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/auth"
	"pinkstarsociety/internal/mail"
	"pinkstarsociety/internal/middleware"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type registerBody struct {
	FirstName       string `json:"firstName" binding:"required"`
	LastName        string `json:"lastName" binding:"required"`
	Email           string `json:"email" binding:"required,email"`
	Password        string `json:"password" binding:"required,min=8"`
	PasswordConfirm string `json:"passwordConfirm" binding:"required"`
	LoyaltyCode     string `json:"loyaltyCode"`
}

type loginBody struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type forgotPasswordBody struct {
	Email string `json:"email" binding:"required,email"`
}

type resetPasswordBody struct {
	Token           string `json:"token" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	PasswordConfirm string `json:"passwordConfirm" binding:"required"`
}

func (h *Handlers) Register(c *gin.Context) {
	var body registerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	if body.Password != body.PasswordConfirm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "les mots de passe ne correspondent pas"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur"})
		return
	}
	role := models.RoleClient
	if h.Config.AdminBootstrapEmail != "" && email == h.Config.AdminBootstrapEmail {
		role = models.RoleAdmin
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	loyaltyPoints := 0
	consumedLoyaltyCodeID := primitive.NilObjectID
	if strings.TrimSpace(body.LoyaltyCode) != "" {
		codeID, bonus, err := h.consumeLoyaltyCode(ctx, body.LoyaltyCode)
		if err != nil {
			if err == errLoyaltyCodeInvalid {
				c.JSON(http.StatusBadRequest, gin.H{"error": "code fidélité invalide ou épuisé"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible d'appliquer le code fidélité"})
			return
		}
		consumedLoyaltyCodeID = codeID
		loyaltyPoints = bonus
	}
	u := models.User{
		FirstName:            strings.TrimSpace(body.FirstName),
		LastName:             strings.TrimSpace(body.LastName),
		Email:                email,
		PasswordHash:         hash,
		Role:                 role,
		LoyaltyPoints:        loyaltyPoints,
		LoyaltyProgressCount: 0,
		CreatedAt:            time.Now().UTC(),
	}
	u.QRToken = strings.ReplaceAll(uuid.New().String(), "-", "")
	_, err = h.DB.Collection("users").InsertOne(ctx, u)
	if err != nil {
		h.rollbackConsumeLoyaltyCode(ctx, consumedLoyaltyCodeID)
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "cet email est déjà utilisé"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "inscription impossible"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true})
}

func (h *Handlers) Login(c *gin.Context) {
	var body loginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var u models.User
	err := h.DB.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&u)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email ou mot de passe incorrect"})
		return
	}
	if !auth.CheckPassword(u.PasswordHash, body.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email ou mot de passe incorrect"})
		return
	}
	ctxLogin, cancelLogin := context.WithTimeout(c.Request.Context(), 10*time.Second)
	if u.QRToken == "" {
		tok := strings.ReplaceAll(uuid.New().String(), "-", "")
		_, _ = h.DB.Collection("users").UpdateOne(ctxLogin, bson.M{"_id": u.ID}, bson.M{"$set": bson.M{"qr_token": tok}})
		u.QRToken = tok
	}
	cancelLogin()
	token, err := auth.SignToken(h.Config.JWTSecret, u.ID.Hex(), u.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur"})
		return
	}
	userOut := gin.H{
		"id":                   u.ID.Hex(),
		"firstName":            u.FirstName,
		"lastName":             u.LastName,
		"email":                u.Email,
		"role":                 u.Role,
		"loyaltyPoints":        u.LoyaltyPoints,
		"loyaltyProgressCount": u.LoyaltyProgressCount,
	}
	userOut["qrToken"] = u.QRToken
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  userOut,
	})
}

func (h *Handlers) ForgotPassword(c *gin.Context) {
	var body forgotPasswordBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var u models.User
	err := h.DB.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&u)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "aucun compte associé à cette adresse email"})
		return
	}
	token, err := auth.SignResetToken(h.Config.JWTSecret, u.ID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur"})
		return
	}
	if err := mail.SendPasswordReset(h.Config, u.Email, token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible d'envoyer l'email"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) ResetPassword(c *gin.Context) {
	var body resetPasswordBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	if body.Password != body.PasswordConfirm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "les mots de passe ne correspondent pas"})
		return
	}
	claims, err := auth.ParseResetToken(h.Config.JWTSecret, strings.TrimSpace(body.Token))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lien invalide ou expiré"})
		return
	}
	oid, err := primitive.ObjectIDFromHex(claims.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lien invalide ou expiré"})
		return
	}
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	res, err := h.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{"password_hash": hash}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "mise à jour impossible"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) Me(c *gin.Context) {
	idHex := c.GetString("userID")
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var u models.User
	if err := h.DB.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	if u.QRToken == "" {
		tok := strings.ReplaceAll(uuid.New().String(), "-", "")
		_, _ = h.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": u.ID}, bson.M{"$set": bson.M{"qr_token": tok}})
		u.QRToken = tok
	}
	c.JSON(http.StatusOK, gin.H{
		"id":                   u.ID.Hex(),
		"firstName":            u.FirstName,
		"lastName":             u.LastName,
		"email":                u.Email,
		"role":                 u.Role,
		"loyaltyPoints":        u.LoyaltyPoints,
		"loyaltyProgressCount": u.LoyaltyProgressCount,
		"qrToken":              u.QRToken,
	})
}

type patchMeBody struct {
	FirstName       *string `json:"firstName"`
	LastName        *string `json:"lastName"`
	Email           *string `json:"email"`
	Password        *string `json:"password"`
	CurrentPassword *string `json:"currentPassword"`
	PasswordConfirm *string `json:"passwordConfirm"`
}

func (h *Handlers) PatchMe(c *gin.Context) {
	idHex := middleware.UserID(c)
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
		return
	}
	var body patchMeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "données invalides"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var u models.User
	if err := h.DB.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
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
	newPass := body.Password != nil && strings.TrimSpace(*body.Password) != ""
	if newPass {
		if body.CurrentPassword == nil || strings.TrimSpace(*body.CurrentPassword) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe actuel requis"})
			return
		}
		if !auth.CheckPassword(u.PasswordHash, strings.TrimSpace(*body.CurrentPassword)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe actuel incorrect"})
			return
		}
		p := strings.TrimSpace(*body.Password)
		if len(p) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe trop court"})
			return
		}
		confirm := ""
		if body.PasswordConfirm != nil {
			confirm = strings.TrimSpace(*body.PasswordConfirm)
		}
		if confirm != p {
			c.JSON(http.StatusBadRequest, gin.H{"error": "les mots de passe ne correspondent pas"})
			return
		}
		hash, err := auth.HashPassword(p)
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
	if fn, ok := set["first_name"].(string); ok && fn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prénom invalide"})
		return
	}
	if ln, ok := set["last_name"].(string); ok && ln == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nom invalide"})
		return
	}
	if em, ok := set["email"].(string); ok && em == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email invalide"})
		return
	}
	res, err := h.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "cet email est déjà utilisé"})
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

type deleteMeBody struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
}

func (h *Handlers) DeleteMe(c *gin.Context) {
	idHex := middleware.UserID(c)
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
		return
	}
	var body deleteMeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe requis"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	var u models.User
	if err := h.DB.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	if !auth.CheckPassword(u.PasswordHash, strings.TrimSpace(body.CurrentPassword)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mot de passe incorrect"})
		return
	}
	_, _ = h.DB.Collection("bookings").UpdateMany(ctx, bson.M{"client_user_id": oid}, bson.M{"$unset": bson.M{"client_user_id": ""}})
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

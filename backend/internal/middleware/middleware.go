package middleware

import (
	"net/http"
	"strings"

	"pinkstarsociety/internal/auth"
	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
)

const ctxUserID = "userID"
const ctxRole = "role"

func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" || !strings.HasPrefix(strings.ToLower(h), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "non authentifié"})
			return
		}
		raw := strings.TrimSpace(h[7:])
		claims, err := auth.ParseToken(cfg.JWTSecret, raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session invalide"})
			return
		}
		c.Set(ctxUserID, claims.UserID)
		c.Set(ctxRole, claims.Role)
		c.Next()
	}
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString(ctxRole) != models.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accès admin requis"})
			return
		}
		c.Next()
	}
}

func UserID(c *gin.Context) string {
	return c.GetString(ctxUserID)
}

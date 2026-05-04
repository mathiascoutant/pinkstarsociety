package handlers

import (
	"strings"

	"pinkstarsociety/internal/auth"

	"github.com/gin-gonic/gin"
)

func optionalBearerClaims(c *gin.Context, jwtSecret string) *auth.Claims {
	h := c.GetHeader("Authorization")
	if h == "" || !strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return nil
	}
	raw := strings.TrimSpace(h[7:])
	claims, err := auth.ParseToken(jwtSecret, raw)
	if err != nil {
		return nil
	}
	return claims
}

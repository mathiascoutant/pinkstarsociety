package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"sub"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func SignToken(secret, userID, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(secret))
}

func ParseToken(secret, tokenStr string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, errors.New("token invalide")
	}
	return claims, nil
}

const resetTokenPurpose = "password_reset"

type ResetClaims struct {
	UserID  string `json:"sub"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

func SignResetToken(secret, userID string) (string, error) {
	claims := ResetClaims{
		UserID:  userID,
		Purpose: resetTokenPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(secret))
}

func ParseResetToken(secret, tokenStr string) (*ResetClaims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &ResetClaims{}, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*ResetClaims)
	if !ok || !t.Valid {
		return nil, errors.New("token invalide")
	}
	if claims.Purpose != resetTokenPurpose {
		return nil, errors.New("token invalide")
	}
	return claims, nil
}

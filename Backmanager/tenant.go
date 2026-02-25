package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const tenantCtxKey = "tenant_id"
const userCtxKey = "user_id"

func AuthMiddleware(secret []byte, issuer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "missing authorization header",
				"hint":  "send: Authorization: Bearer <token>",
			})
			return
		}

		const bearer = "Bearer "
		if !strings.HasPrefix(authHeader, bearer) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization scheme"})
			return
		}

		rawToken := strings.TrimPrefix(authHeader, bearer)
		token, err := jwt.Parse(rawToken, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			return secret, nil
		}, jwt.WithIssuer(issuer))
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}

		tenantID, _ := claims["tenant_id"].(string)
		if tenantID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "tenant claim missing"})
			return
		}

		userID, _ := claims["sub"].(string)
		c.Set(tenantCtxKey, tenantID)
		c.Set(userCtxKey, userID)
		c.Next()
	}
}

func tenantFromContext(c *gin.Context) string {
	v, ok := c.Get(tenantCtxKey)
	if !ok {
		return ""
	}
	id, _ := v.(string)
	return id
}

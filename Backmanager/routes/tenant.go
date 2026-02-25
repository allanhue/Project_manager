package routes

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const tenantCtxKey = "tenant_id"
const userCtxKey = "user_id"
const roleCtxKey = "role"
const emailCtxKey = "email"

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
		email, _ := claims["email"].(string)
		role, _ := claims["role"].(string)
		if role == "" {
			role = "org_admin"
		}
		c.Set(tenantCtxKey, tenantID)
		c.Set(userCtxKey, userID)
		c.Set(emailCtxKey, email)
		c.Set(roleCtxKey, role)
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

func roleFromContext(c *gin.Context) string {
	v, ok := c.Get(roleCtxKey)
	if !ok {
		return ""
	}
	role, _ := v.(string)
	return role
}

func RequireSystemAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if roleFromContext(c) != "system_admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "system admin access required"})
			return
		}
		c.Next()
	}
}

func emailFromContext(c *gin.Context) string {
	v, ok := c.Get(emailCtxKey)
	if !ok {
		return ""
	}
	email, _ := v.(string)
	return email
}

package routes

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
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

func RequireActiveUser(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenant := strings.TrimSpace(tenantFromContext(c))
		email := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
		if tenant == "" || email == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
			return
		}
		var blocked bool
		err := s.DB.QueryRow(c.Request.Context(), `
			SELECT COALESCE(u.blocked, false)
			FROM users u
			JOIN tenants t ON t.id = u.tenant_id
			WHERE t.slug = $1 AND lower(u.email) = lower($2)
			LIMIT 1
		`, tenant, email).Scan(&blocked)
		if errors.Is(err, pgx.ErrNoRows) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to validate access"})
			return
		}
		if blocked {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account access is blocked"})
			return
		}
		c.Next()
	}
}

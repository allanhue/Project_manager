package routes

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	TenantSlug string `json:"tenant_slug" binding:"required"`
	TenantName string `json:"tenant_name" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	TenantSlug string `json:"tenant_slug" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
}

func (s *Service) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	req.TenantSlug = normalizeSlug(req.TenantSlug)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	req.TenantName = strings.TrimSpace(req.TenantName)

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
		return
	}

	tx, err := s.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var tenantID int64
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO tenants (slug, name)
		VALUES ($1, $2)
		ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, req.TenantSlug, req.TenantName).Scan(&tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant creation failed"})
		return
	}

	var userID int64
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO users (tenant_id, name, email, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, tenantID, req.Name, req.Email, string(hash)).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user already exists for this tenant"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	token, err := s.issueToken(userID, req.TenantSlug, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":          userID,
			"name":        req.Name,
			"email":       req.Email,
			"tenant_slug": req.TenantSlug,
		},
	})
}

func (s *Service) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	req.TenantSlug = normalizeSlug(req.TenantSlug)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var userID int64
	var hash string
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT u.id, u.password_hash
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1 AND u.email = $2
	`, req.TenantSlug, req.Email).Scan(&userID, &hash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := s.issueToken(userID, req.TenantSlug, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

func (s *Service) issueToken(userID int64, tenantSlug string, email string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":       fmt.Sprintf("%d", userID),
		"tenant_id": tenantSlug,
		"email":     email,
		"iss":       s.JWTIssuer,
		"iat":       now.Unix(),
		"exp":       now.Add(s.JWTTTL).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.JWTSecret)
}

func normalizeSlug(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

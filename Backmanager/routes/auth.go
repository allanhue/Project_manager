package routes

import (
	"context"
	"crypto/rand"
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

type forgotPasswordRequest struct {
	TenantSlug string `json:"tenant_slug" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
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
	role := s.roleForEmail(req.Email)

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
		INSERT INTO users (tenant_id, name, email, password_hash, role)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, tenantID, req.Name, req.Email, string(hash), role).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user already exists for this tenant"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	token, err := s.issueToken(userID, req.TenantSlug, req.Email, req.Name, req.TenantName, role)
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
			"tenant_name": req.TenantName,
			"role":        role,
		},
	})

	s.sendAsyncNotification(
		req.Email,
		"Welcome to PulseForge",
		fmt.Sprintf("Hi %s, your %s workspace is ready. Role: %s.", req.Name, req.TenantName, role),
	)
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
	var role string
	var name string
	var tenantName string
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT u.id, u.password_hash, u.role, u.name, t.name
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1 AND u.email = $2
	`, req.TenantSlug, req.Email).Scan(&userID, &hash, &role, &name, &tenantName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	desiredRole := s.roleForEmail(req.Email)
	if role != desiredRole {
		_, _ = s.DB.Exec(c.Request.Context(), `UPDATE users SET role = $1 WHERE id = $2`, desiredRole, userID)
		role = desiredRole
	}
	_, _ = s.DB.Exec(c.Request.Context(), `UPDATE users SET last_login_at = NOW() WHERE id = $1`, userID)

	token, err := s.issueToken(userID, req.TenantSlug, req.Email, name, tenantName, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":          userID,
			"name":        name,
			"email":       req.Email,
			"tenant_slug": req.TenantSlug,
			"tenant_name": tenantName,
			"role":        role,
		},
	})
}

func (s *Service) ForgotPassword(c *gin.Context) {
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	req.TenantSlug = normalizeSlug(req.TenantSlug)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	tx, err := s.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var userID int64
	var name string
	var tenantName string
	err = tx.QueryRow(c.Request.Context(), `
		SELECT u.id, u.name, t.name
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1 AND lower(u.email) = lower($2)
	`, req.TenantSlug, req.Email).Scan(&userID, &name, &tenantName)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "if the account exists, a reset email has been sent"})
		return
	}

	tempPassword, err := generateTemporaryPassword(12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password generation failed"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
		return
	}
	if _, err := tx.Exec(c.Request.Context(), `UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password update failed"})
		return
	}

	subject := "PulseForge password reset"
	message := fmt.Sprintf(
		"Hi %s,\n\nYour temporary password for %s is:\n%s\n\nPlease login and change it immediately.",
		name,
		tenantName,
		tempPassword,
	)
	if err := s.sendMail(context.Background(), req.Email, subject, message); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "if the account exists, a reset email has been sent"})
}

func generateTemporaryPassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%*"
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	out := make([]byte, length)
	for i, b := range bytes {
		out[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(out), nil
}

func (s *Service) issueToken(userID int64, tenantSlug, email, name, tenantName, role string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":         fmt.Sprintf("%d", userID),
		"tenant_id":   tenantSlug,
		"tenant_name": tenantName,
		"email":       email,
		"name":        name,
		"role":        role,
		"iss":         s.JWTIssuer,
		"iat":         now.Unix(),
		"exp":         now.Add(s.JWTTTL).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.JWTSecret)
}

func normalizeSlug(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func (s *Service) EnsureSystemAdminRoles(ctx context.Context) error {
	if len(s.SystemAdminEmails) == 0 {
		return nil
	}
	for email := range s.SystemAdminEmails {
		if _, err := s.DB.Exec(ctx, `UPDATE users SET role = 'system_admin' WHERE lower(email) = lower($1)`, email); err != nil {
			return err
		}
	}
	return nil
}

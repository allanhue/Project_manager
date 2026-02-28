package routes

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	TenantSlug     string `json:"tenant_slug" binding:"required"`
	TenantName     string `json:"tenant_name" binding:"required"`
	TenantLogoData string `json:"tenant_logo_data"`
	TenantLogoURL  string `json:"tenant_logo_url"`
	Name           string `json:"name" binding:"required"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	TenantSlug string `json:"tenant_slug"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
}

type forgotPasswordRequest struct {
	TenantSlug string `json:"tenant_slug"`
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
	req.TenantLogoData = strings.TrimSpace(req.TenantLogoData)
	req.TenantLogoURL = strings.TrimSpace(req.TenantLogoURL)
	tenantLogo := req.TenantLogoData
	if tenantLogo == "" {
		tenantLogo = req.TenantLogoURL
	}
	if tenantLogo != "" {
		isUpload := strings.HasPrefix(tenantLogo, "data:image/")
		isLegacyURL := strings.HasPrefix(tenantLogo, "http://") || strings.HasPrefix(tenantLogo, "https://")
		if !isUpload && !isLegacyURL {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid logo upload format"})
			return
		}
		if len(tenantLogo) > 2_800_000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "logo image too large"})
			return
		}
	}
	role := "org_admin"

	var existingTenantSlug string
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT slug
		FROM tenants
		WHERE lower(name) = lower($1)
		LIMIT 1
	`, req.TenantName).Scan(&existingTenantSlug); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "organization name already exists"})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "organization lookup failed"})
		return
	}

	var existingUserID int64
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT id
		FROM users
		WHERE lower(email) = lower($1)
		LIMIT 1
	`, req.Email).Scan(&existingUserID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "email lookup failed"})
		return
	}

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
		INSERT INTO tenants (slug, name, logo_url)
		VALUES ($1, $2, $3)
		RETURNING id
	`, req.TenantSlug, req.TenantName, tenantLogo).Scan(&tenantID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "organization slug already exists"})
		return
	}

	userPublicID, err := s.generateUserPublicID(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user id generation failed"})
		return
	}
	var userID int64
	var createdPublicID string
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO users (tenant_id, name, email, password_hash, role, public_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, public_id
	`, tenantID, req.Name, req.Email, string(hash), role, userPublicID).Scan(&userID, &createdPublicID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user already exists for this tenant"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	token, err := s.issueToken(createdPublicID, req.TenantSlug, req.Email, req.Name, req.TenantName, tenantLogo, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":          createdPublicID,
			"name":        req.Name,
			"email":       req.Email,
			"tenant_slug": req.TenantSlug,
			"tenant_name": req.TenantName,
			"tenant_logo": tenantLogo,
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload", "detail": err.Error()})
		return
	}

	req.TenantSlug = normalizeSlug(req.TenantSlug)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var userID int64
	var hash string
	var role string
	var name string
	var userPublicID string
	var tenantSlug string
	var tenantName string
	var tenantLogo string
	var err error
	if req.TenantSlug != "" {
		err = s.DB.QueryRow(c.Request.Context(), `
			SELECT u.id, u.public_id, u.password_hash, u.role, u.name, t.slug, t.name, t.logo_url
			FROM users u
			JOIN tenants t ON t.id = u.tenant_id
			WHERE t.slug = $1 AND lower(u.email) = lower($2)
		`, req.TenantSlug, req.Email).Scan(&userID, &userPublicID, &hash, &role, &name, &tenantSlug, &tenantName, &tenantLogo)
	} else {
		err = s.DB.QueryRow(c.Request.Context(), `
			SELECT u.id, u.public_id, u.password_hash, u.role, u.name, t.slug, t.name, t.logo_url
			FROM users u
			JOIN tenants t ON t.id = u.tenant_id
			WHERE lower(u.email) = lower($1)
			ORDER BY u.id DESC
			LIMIT 1
		`, req.Email).Scan(&userID, &userPublicID, &hash, &role, &name, &tenantSlug, &tenantName, &tenantLogo)
	}
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if !isValidPublicID(userPublicID) {
		userPublicID, err = s.generateUserPublicID(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user id generation failed"})
			return
		}
		if _, err := s.DB.Exec(c.Request.Context(), `UPDATE users SET public_id = $1 WHERE id = $2`, userPublicID, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user id update failed"})
			return
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	_, _ = s.DB.Exec(c.Request.Context(), `UPDATE users SET last_login_at = NOW() WHERE id = $1`, userID)

	token, err := s.issueToken(userPublicID, tenantSlug, req.Email, name, tenantName, tenantLogo, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":          userPublicID,
			"name":        name,
			"email":       req.Email,
			"tenant_slug": tenantSlug,
			"tenant_name": tenantName,
			"tenant_logo": tenantLogo,
			"role":        role,
		},
	})
}

func (s *Service) ForgotPassword(c *gin.Context) {
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload", "detail": err.Error()})
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
	if req.TenantSlug != "" {
		err = tx.QueryRow(c.Request.Context(), `
			SELECT u.id, u.name, t.name
			FROM users u
			JOIN tenants t ON t.id = u.tenant_id
			WHERE t.slug = $1 AND lower(u.email) = lower($2)
		`, req.TenantSlug, req.Email).Scan(&userID, &name, &tenantName)
	} else {
		err = tx.QueryRow(c.Request.Context(), `
			SELECT u.id, u.name, t.name
			FROM users u
			JOIN tenants t ON t.id = u.tenant_id
			WHERE lower(u.email) = lower($1)
			ORDER BY u.id DESC
			LIMIT 1
		`, req.Email).Scan(&userID, &name, &tenantName)
	}
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

func (s *Service) issueToken(userID, tenantSlug, email, name, tenantName, tenantLogo, role string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":         userID,
		"tenant_id":   tenantSlug,
		"tenant_name": tenantName,
		"tenant_logo": tenantLogo,
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

func isValidPublicID(v string) bool {
	if len(v) != 7 {
		return false
	}
	for _, ch := range v {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func (s *Service) generateUserPublicID(ctx context.Context) (string, error) {
	const maxAttempts = 20
	for i := 0; i < maxAttempts; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(9000000))
		if err != nil {
			return "", err
		}
		candidate := fmt.Sprintf("%07d", 1000000+n.Int64())
		var existing int64
		err = s.DB.QueryRow(ctx, `SELECT id FROM users WHERE public_id = $1 LIMIT 1`, candidate).Scan(&existing)
		if errors.Is(err, pgx.ErrNoRows) {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
	}
	return "", errors.New("failed to allocate unique 7-digit user id")
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

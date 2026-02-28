package routes

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type organizationSummary struct {
	TenantSlug        string     `json:"tenant_slug"`
	TenantName        string     `json:"tenant_name"`
	LogoURL           string     `json:"logo_url"`
	UserCount         int64      `json:"user_count"`
	ProjectCount      int64      `json:"project_count"`
	TaskCount         int64      `json:"task_count"`
	ActiveUsers7d     int64      `json:"active_users_7d"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	ActiveWorkspace7d bool       `json:"active_workspace_7d"`
}

type systemTenant struct {
	ID        int64     `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	LogoURL   string    `json:"logo_url"`
	CreatedAt time.Time `json:"created_at"`
}

type tenantUpsertRequest struct {
	Slug             string `json:"slug" binding:"required"`
	Name             string `json:"name" binding:"required"`
	LogoData         string `json:"logo_data"`
	LogoURL          string `json:"logo_url"`
	OrgAdminEmail    string `json:"org_admin_email"`
	OrgAdminPassword string `json:"org_admin_password"`
}

func (s *Service) SystemOrganizations(c *gin.Context) {
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT
			t.slug,
			t.name,
			COALESCE(t.logo_url, '') AS logo_url,
			COUNT(DISTINCT u.id) AS user_count,
			COUNT(DISTINCT p.id) AS project_count,
			COUNT(DISTINCT tk.id) AS task_count,
			COUNT(DISTINCT u.id) FILTER (WHERE u.last_login_at >= NOW() - INTERVAL '7 days') AS active_users_7d,
			MAX(u.last_login_at) AS last_login_at,
			COALESCE((
				MAX(u.last_login_at) >= NOW() - INTERVAL '7 days'
				OR MAX(p.created_at) >= NOW() - INTERVAL '7 days'
				OR MAX(tk.created_at) >= NOW() - INTERVAL '7 days'
			), false) AS active_workspace_7d
		FROM tenants t
		LEFT JOIN users u ON u.tenant_id = t.id
		LEFT JOIN projects p ON p.tenant_id = t.slug
		LEFT JOIN tasks tk ON tk.tenant_id = t.slug
		GROUP BY t.slug, t.name
		ORDER BY active_workspace_7d DESC, active_users_7d DESC, t.slug
	`)
	if err != nil {
		c.JSON(500, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]organizationSummary, 0)
	for rows.Next() {
		var row organizationSummary
		if err := rows.Scan(
			&row.TenantSlug,
			&row.TenantName,
			&row.LogoURL,
			&row.UserCount,
			&row.ProjectCount,
			&row.TaskCount,
			&row.ActiveUsers7d,
			&row.LastLoginAt,
			&row.ActiveWorkspace7d,
		); err != nil {
			c.JSON(500, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, row)
	}

	c.JSON(200, gin.H{"items": items})
}

func (s *Service) SystemTenants(c *gin.Context) {
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, slug, name, COALESCE(logo_url, ''), created_at
		FROM tenants
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]systemTenant, 0)
	for rows.Next() {
		var item systemTenant
		if err := rows.Scan(&item.ID, &item.Slug, &item.Name, &item.LogoURL, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateTenant(c *gin.Context) {
	var req tenantUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.Name = strings.TrimSpace(req.Name)
	req.LogoData = strings.TrimSpace(req.LogoData)
	req.LogoURL = strings.TrimSpace(req.LogoURL)
	req.OrgAdminEmail = strings.ToLower(strings.TrimSpace(req.OrgAdminEmail))
	req.OrgAdminPassword = strings.TrimSpace(req.OrgAdminPassword)
	logoValue := req.LogoData
	if logoValue == "" {
		logoValue = req.LogoURL
	}
	if logoValue != "" {
		isUpload := strings.HasPrefix(logoValue, "data:image/")
		isLegacyURL := strings.HasPrefix(logoValue, "http://") || strings.HasPrefix(logoValue, "https://")
		if !isUpload && !isLegacyURL {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid logo upload format"})
			return
		}
		if len(logoValue) > 2_800_000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "logo image too large"})
			return
		}
	}
	var existingID int64
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT id
		FROM tenants
		WHERE lower(name) = lower($1)
		LIMIT 1
	`, req.Name).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "tenant create failed (name already exists)"})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant lookup failed"})
		return
	}

	tx, err := s.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var item systemTenant
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO tenants (slug, name, logo_url)
		VALUES ($1, $2, $3)
		RETURNING id, slug, name, COALESCE(logo_url, ''), created_at
	`, req.Slug, req.Name, logoValue).Scan(&item.ID, &item.Slug, &item.Name, &item.LogoURL, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "tenant create failed (slug may already exist)"})
		return
	}

	createdOrgAdmin := false
	if req.OrgAdminEmail != "" || req.OrgAdminPassword != "" {
		if req.OrgAdminEmail == "" || req.OrgAdminPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "org admin email and password are both required"})
			return
		}
		if len(req.OrgAdminPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "org admin password must be at least 6 characters"})
			return
		}
		var existingUserID int64
		if err := tx.QueryRow(c.Request.Context(), `
			SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1
		`, req.OrgAdminEmail).Scan(&existingUserID); err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "org admin email already exists"})
			return
		} else if !errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "org admin lookup failed"})
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(req.OrgAdminPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "org admin password hash failed"})
			return
		}
		publicID, err := s.generateUserPublicID(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "org admin user id generation failed"})
			return
		}
		if _, err := tx.Exec(c.Request.Context(), `
			INSERT INTO users (tenant_id, name, email, password_hash, role, public_id)
			VALUES ($1, $2, $3, $4, 'org_admin', $5)
		`, item.ID, req.Name+" Admin", req.OrgAdminEmail, string(hash), publicID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "org admin creation failed"})
			return
		}
		createdOrgAdmin = true
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":                item.ID,
		"slug":              item.Slug,
		"name":              item.Name,
		"logo_url":          item.LogoURL,
		"created_at":        item.CreatedAt,
		"org_admin_created": createdOrgAdmin,
	})
}

func (s *Service) UpdateTenant(c *gin.Context) {
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant id"})
		return
	}

	var req tenantUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.Name = strings.TrimSpace(req.Name)
	req.LogoData = strings.TrimSpace(req.LogoData)
	req.LogoURL = strings.TrimSpace(req.LogoURL)
	logoValue := req.LogoData
	if logoValue == "" {
		logoValue = req.LogoURL
	}
	if logoValue != "" {
		isUpload := strings.HasPrefix(logoValue, "data:image/")
		isLegacyURL := strings.HasPrefix(logoValue, "http://") || strings.HasPrefix(logoValue, "https://")
		if !isUpload && !isLegacyURL {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid logo upload format"})
			return
		}
		if len(logoValue) > 2_800_000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "logo image too large"})
			return
		}
	}
	var existingID int64
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT id
		FROM tenants
		WHERE lower(name) = lower($1) AND id <> $2
		LIMIT 1
	`, req.Name, id).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "tenant update failed (name already exists)"})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant lookup failed"})
		return
	}

	var oldSlug string
	if err := s.DB.QueryRow(c.Request.Context(), `SELECT slug FROM tenants WHERE id = $1`, id).Scan(&oldSlug); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	tx, err := s.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var item systemTenant
	err = tx.QueryRow(c.Request.Context(), `
		UPDATE tenants
		SET slug = $1, name = $2, logo_url = $3
		WHERE id = $4
		RETURNING id, slug, name, COALESCE(logo_url, ''), created_at
	`, req.Slug, req.Name, logoValue, id).Scan(&item.ID, &item.Slug, &item.Name, &item.LogoURL, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "tenant update failed (slug may already exist)"})
		return
	}

	if oldSlug != item.Slug {
		if _, err := tx.Exec(c.Request.Context(), `UPDATE projects SET tenant_id = $1 WHERE tenant_id = $2`, item.Slug, oldSlug); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update project tenant references"})
			return
		}
		if _, err := tx.Exec(c.Request.Context(), `UPDATE tasks SET tenant_id = $1 WHERE tenant_id = $2`, item.Slug, oldSlug); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task tenant references"})
			return
		}
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func (s *Service) SystemAnalytics(c *gin.Context) {
	var tenantCount, userCount, projectCount, taskCount, activeUsers24h, activeUsers7d, activeTenants7d int64
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT
			(SELECT COUNT(*) FROM tenants) AS tenant_count,
			(SELECT COUNT(*) FROM users) AS user_count,
			(SELECT COUNT(*) FROM projects) AS project_count,
			(SELECT COUNT(*) FROM tasks) AS task_count,
			(SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours') AS active_users_24h,
			(SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days') AS active_users_7d,
			(
				SELECT COUNT(*)
				FROM tenants t
				WHERE
					EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.last_login_at >= NOW() - INTERVAL '7 days')
					OR EXISTS (SELECT 1 FROM projects p WHERE p.tenant_id = t.slug AND p.created_at >= NOW() - INTERVAL '7 days')
					OR EXISTS (SELECT 1 FROM tasks tk WHERE tk.tenant_id = t.slug AND tk.created_at >= NOW() - INTERVAL '7 days')
			) AS active_tenants_7d
	`).Scan(&tenantCount, &userCount, &projectCount, &taskCount, &activeUsers24h, &activeUsers7d, &activeTenants7d)
	if err != nil {
		c.JSON(500, gin.H{"error": "query failed"})
		return
	}

	c.JSON(200, gin.H{
		"tenant_count":      tenantCount,
		"user_count":        userCount,
		"project_count":     projectCount,
		"task_count":        taskCount,
		"active_users_24h":  activeUsers24h,
		"active_users_7d":   activeUsers7d,
		"active_tenants_7d": activeTenants7d,
	})
}

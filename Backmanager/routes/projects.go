package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Project struct {
	ID        int64     `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type createProjectRequest struct {
	Name   string `json:"name" binding:"required"`
	Status string `json:"status"`
}

func (s *Service) EnsureBaseTables(ctx context.Context) error {
	_, err := s.DB.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS tenants (
			id BIGSERIAL PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS users (
			id BIGSERIAL PRIMARY KEY,
			tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'org_admin',
			last_login_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, email)
		);
		ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'org_admin';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

		CREATE TABLE IF NOT EXISTS projects (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id);
		CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, email);

		CREATE TABLE IF NOT EXISTS system_logs (
			id BIGSERIAL PRIMARY KEY,
			tenant_slug TEXT,
			user_email TEXT,
			role TEXT,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			status_code INT NOT NULL,
			latency_ms BIGINT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_slug ON system_logs (tenant_slug);
	`)
	return err
}

func (s *Service) ListProjects(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, name, status, created_at
		FROM projects
		WHERE tenant_id = $1
		ORDER BY id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	projects := make([]Project, 0)
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.Status, &p.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		projects = append(projects, p)
	}

	c.JSON(http.StatusOK, gin.H{"items": projects})
}

func (s *Service) CreateProject(c *gin.Context) {
	tenantID := tenantFromContext(c)
	var req createProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}

	var p Project
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO projects (tenant_id, name, status)
		VALUES ($1, $2, $3)
		RETURNING id, tenant_id, name, status, created_at
	`, tenantID, req.Name, req.Status).Scan(&p.ID, &p.TenantID, &p.Name, &p.Status, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}

	c.JSON(http.StatusCreated, p)

	s.sendAsyncNotification(
		emailFromContext(c),
		"Project created",
		"Your project '"+p.Name+"' was created successfully.",
	)
}

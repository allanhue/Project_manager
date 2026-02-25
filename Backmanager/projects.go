package main

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

func (a *App) ensureBaseTables(ctx context.Context) error {
	_, err := a.DB.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS projects (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id);
	`)
	return err
}

func (a *App) ListProjects(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := a.DB.Query(c.Request.Context(), `
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

func (a *App) CreateProject(c *gin.Context) {
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
	err := a.DB.QueryRow(c.Request.Context(), `
		INSERT INTO projects (tenant_id, name, status)
		VALUES ($1, $2, $3)
		RETURNING id, tenant_id, name, status, created_at
	`, tenantID, req.Name, req.Status).Scan(&p.ID, &p.TenantID, &p.Name, &p.Status, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}

	c.JSON(http.StatusCreated, p)
}

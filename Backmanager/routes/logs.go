package routes

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type systemLogItem struct {
	ID         int64     `json:"id"`
	TenantSlug string    `json:"tenant_slug"`
	UserEmail  string    `json:"user_email"`
	Role       string    `json:"role"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	StatusCode int       `json:"status_code"`
	LatencyMS  int64     `json:"latency_ms"`
	CreatedAt  time.Time `json:"created_at"`
}

func (s *Service) AuditLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		path := c.Request.URL.Path
		if strings.TrimSpace(path) == "" || strings.HasPrefix(path, "/health") {
			return
		}

		tenant := tenantFromContext(c)
		email := emailFromContext(c)
		role := roleFromContext(c)
		if tenant == "" && email == "" {
			return
		}

		_, _ = s.DB.Exec(context.Background(), `
			INSERT INTO system_logs (tenant_slug, user_email, role, method, path, status_code, latency_ms)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, tenant, email, role, c.Request.Method, path, c.Writer.Status(), time.Since(start).Milliseconds())
	}
}

func (s *Service) SystemLogs(c *gin.Context) {
	limit := 100
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, COALESCE(tenant_slug, ''), COALESCE(user_email, ''), COALESCE(role, ''), method, path, status_code, latency_ms, created_at
		FROM system_logs
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]systemLogItem, 0, limit)
	for rows.Next() {
		var item systemLogItem
		if err := rows.Scan(&item.ID, &item.TenantSlug, &item.UserEmail, &item.Role, &item.Method, &item.Path, &item.StatusCode, &item.LatencyMS, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

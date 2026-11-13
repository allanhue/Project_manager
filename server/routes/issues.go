package routes

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type issueItem struct {
	ID             int64     `json:"id"`
	TenantID       string    `json:"tenant_id"`
	ProjectID      *int64    `json:"project_id,omitempty"`
	ProjectName    string    `json:"project_name,omitempty"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Severity       string    `json:"severity"`
	Status         string    `json:"status"`
	CreatedByEmail string    `json:"created_by_email"`
	CreatedAt      time.Time `json:"created_at"`
	Tags           []string  `json:"tags"`
}

type createIssueRequest struct {
	ProjectID   *int64   `json:"project_id"`
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Severity    string   `json:"severity"`
	Tags        []string `json:"tags"`
}

func (s *Service) ListIssues(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT i.id, i.tenant_id, i.project_id, COALESCE(p.name, ''), i.title, i.description, i.severity, i.status, i.created_by_email, i.created_at, i.tags
		FROM issues i
		LEFT JOIN projects p ON p.id = i.project_id
		WHERE i.tenant_id = $1
		ORDER BY i.id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]issueItem, 0)
	for rows.Next() {
		var item issueItem
		var tags []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.ProjectID, &item.ProjectName, &item.Title, &item.Description, &item.Severity, &item.Status, &item.CreatedByEmail, &item.CreatedAt, &tags); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		_ = json.Unmarshal(tags, &item.Tags)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateIssue(c *gin.Context) {
	tenantID := tenantFromContext(c)
	creator := strings.TrimSpace(emailFromContext(c))
	if creator == "" {
		creator = "unknown@tenant"
	}
	var req createIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.Severity == "" {
		req.Severity = "medium"
	}

	var item issueItem
	tagsJSON, _ := json.Marshal(normalizeTags(req.Tags))
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO issues (tenant_id, project_id, title, description, severity, status, created_by_email, tags)
		VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
		RETURNING id, tenant_id, project_id, title, description, severity, status, created_by_email, created_at, tags
	`, tenantID, req.ProjectID, strings.TrimSpace(req.Title), strings.TrimSpace(req.Description), req.Severity, creator, tagsJSON).
		Scan(&item.ID, &item.TenantID, &item.ProjectID, &item.Title, &item.Description, &item.Severity, &item.Status, &item.CreatedByEmail, &item.CreatedAt, &tagsJSON)
	if err == nil {
		_ = json.Unmarshal(tagsJSON, &item.Tags)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

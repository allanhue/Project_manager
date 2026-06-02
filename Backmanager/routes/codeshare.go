package routes

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type codeShare struct {
	ID          int64      `json:"id"`
	TenantID    string     `json:"tenant_id"`
	AuthorEmail string     `json:"author_email"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Language    string     `json:"language"`
	Code        string     `json:"code"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}

type codeShareRequest struct {
	Title    string `json:"title" binding:"required"`
	Body     string `json:"body"`
	Language string `json:"language" binding:"required"`
	Code     string `json:"code" binding:"required"`
}

func (s *Service) ListCodeShares(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, author_email, title, body, language, code, created_at, updated_at
		FROM code_shares
		WHERE tenant_id = $1
		ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]codeShare, 0)
	for rows.Next() {
		var item codeShare
		if err := rows.Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.Language, &item.Code, &item.CreatedAt, &item.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateCodeShare(c *gin.Context) {
	tenantID := tenantFromContext(c)
	author := strings.TrimSpace(emailFromContext(c))
	if author == "" {
		author = "unknown@tenant"
	}
	var req codeShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var item codeShare
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO code_shares (tenant_id, author_email, title, body, language, code)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, tenant_id, author_email, title, body, language, code, created_at, updated_at
	`, tenantID, author, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body), strings.TrimSpace(req.Language), strings.TrimRight(req.Code, "\r\n\t ")).
		Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.Language, &item.Code, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (s *Service) UpdateCodeShare(c *gin.Context) {
	tenantID := tenantFromContext(c)
	shareID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || shareID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid code share id"})
		return
	}

	var req codeShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var item codeShare
	err = s.DB.QueryRow(c.Request.Context(), `
		UPDATE code_shares
		SET title = $3, body = $4, language = $5, code = $6, updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2
		RETURNING id, tenant_id, author_email, title, body, language, code, created_at, updated_at
	`, shareID, tenantID, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body), strings.TrimSpace(req.Language), strings.TrimRight(req.Code, "\r\n\t ")).
		Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.Language, &item.Code, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "code share not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (s *Service) DeleteCodeShare(c *gin.Context) {
	tenantID := tenantFromContext(c)
	shareID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || shareID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid code share id"})
		return
	}

	commandTag, err := s.DB.Exec(c.Request.Context(), `
		DELETE FROM code_shares
		WHERE id = $1 AND tenant_id = $2
	`, shareID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "code share not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

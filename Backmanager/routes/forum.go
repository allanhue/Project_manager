package routes

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type forumPost struct {
	ID          int64     `json:"id"`
	TenantID    string    `json:"tenant_id"`
	AuthorEmail string    `json:"author_email"`
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}

type createForumPostRequest struct {
	Title string `json:"title" binding:"required"`
	Body  string `json:"body" binding:"required"`
}

func (s *Service) ListForumPosts(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, author_email, title, body, created_at
		FROM forum_posts
		WHERE tenant_id = $1
		ORDER BY id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]forumPost, 0)
	for rows.Next() {
		var item forumPost
		if err := rows.Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateForumPost(c *gin.Context) {
	tenantID := tenantFromContext(c)
	author := strings.TrimSpace(emailFromContext(c))
	if author == "" {
		author = "unknown@tenant"
	}
	var req createForumPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var item forumPost
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO forum_posts (tenant_id, author_email, title, body)
		VALUES ($1, $2, $3, $4)
		RETURNING id, tenant_id, author_email, title, body, created_at
	`, tenantID, author, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body)).
		Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

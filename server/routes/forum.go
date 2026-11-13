package routes

import (
	"encoding/json"
	"net/http"
	"strconv"
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
	Tags        []string  `json:"tags"`
}

type createForumPostRequest struct {
	Title string   `json:"title" binding:"required"`
	Body  string   `json:"body" binding:"required"`
	Tags  []string `json:"tags"`
}

func (s *Service) ListForumPosts(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, author_email, title, body, created_at, tags
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
		var tags []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.CreatedAt, &tags); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		_ = json.Unmarshal(tags, &item.Tags)
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
	tagsJSON, _ := json.Marshal(normalizeTags(req.Tags))
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO forum_posts (tenant_id, author_email, title, body, tags)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, tenant_id, author_email, title, body, created_at, tags
	`, tenantID, author, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body), tagsJSON).
		Scan(&item.ID, &item.TenantID, &item.AuthorEmail, &item.Title, &item.Body, &item.CreatedAt, &tagsJSON)
	if err == nil {
		_ = json.Unmarshal(tagsJSON, &item.Tags)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (s *Service) DeleteForumPost(c *gin.Context) {
	tenantID := tenantFromContext(c)
	postID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || postID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid forum post id"})
		return
	}

	commandTag, err := s.DB.Exec(c.Request.Context(), `
		DELETE FROM forum_posts
		WHERE id = $1 AND tenant_id = $2
	`, postID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "forum post not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

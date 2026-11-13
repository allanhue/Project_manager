package routes

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type discussionComment struct {
	ID          int64     `json:"id"`
	EntityID    int64     `json:"entity_id"`
	AuthorEmail string    `json:"author_email"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}

func normalizeTags(tags []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(strings.TrimPrefix(tag, "#"))
		if tag == "" {
			continue
		}
		if len(tag) > 32 {
			tag = tag[:32]
		}
		key := strings.ToLower(tag)
		if !seen[key] && len(result) < 10 {
			seen[key] = true
			result = append(result, tag)
		}
	}
	return result
}

func discussionType(c *gin.Context) string {
	if strings.HasPrefix(c.FullPath(), "/api/v1/issues/") {
		return "issue"
	}
	return "forum"
}

func (s *Service) ListDiscussionComments(c *gin.Context) {
	tenantID := tenantFromContext(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}
	rows, err := s.DB.Query(c.Request.Context(), `SELECT id, entity_id, author_email, body, created_at FROM discussion_comments WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY id`, tenantID, discussionType(c), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()
	items := make([]discussionComment, 0)
	for rows.Next() {
		var item discussionComment
		if err := rows.Scan(&item.ID, &item.EntityID, &item.AuthorEmail, &item.Body, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateDiscussionComment(c *gin.Context) {
	tenantID := tenantFromContext(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}
	var req struct {
		Body string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Body) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment is required"})
		return
	}
	entity := discussionType(c)
	table := "forum_posts"
	if entity == "issue" {
		table = "issues"
	}
	var exists bool
	err = s.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id=$1 AND tenant_id=$2)`, id, tenantID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}
	author := strings.TrimSpace(emailFromContext(c))
	if author == "" {
		author = "unknown@tenant"
	}
	var item discussionComment
	err = s.DB.QueryRow(c.Request.Context(), `INSERT INTO discussion_comments (tenant_id,entity_type,entity_id,author_email,body) VALUES ($1,$2,$3,$4,$5) RETURNING id,entity_id,author_email,body,created_at`, tenantID, entity, id, author, strings.TrimSpace(req.Body)).Scan(&item.ID, &item.EntityID, &item.AuthorEmail, &item.Body, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

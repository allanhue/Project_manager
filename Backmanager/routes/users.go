package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type tenantUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (s *Service) ListUsers(c *gin.Context) {
	tenantSlug := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT COALESCE(u.public_id, ''), u.name, u.email, u.role
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1
		ORDER BY u.created_at DESC
	`, tenantSlug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]tenantUser, 0)
	for rows.Next() {
		var user tenantUser
		if err := rows.Scan(&user.ID, &user.Name, &user.Email, &user.Role); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, user)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

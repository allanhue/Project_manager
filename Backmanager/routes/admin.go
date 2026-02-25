package routes

import "github.com/gin-gonic/gin"

type organizationSummary struct {
	TenantSlug   string `json:"tenant_slug"`
	TenantName   string `json:"tenant_name"`
	UserCount    int64  `json:"user_count"`
	ProjectCount int64  `json:"project_count"`
	TaskCount    int64  `json:"task_count"`
}

func (s *Service) SystemOrganizations(c *gin.Context) {
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT
			t.slug,
			t.name,
			COUNT(DISTINCT u.id) AS user_count,
			COUNT(DISTINCT p.id) AS project_count,
			COUNT(DISTINCT tk.id) AS task_count
		FROM tenants t
		LEFT JOIN users u ON u.tenant_id = t.id
		LEFT JOIN projects p ON p.tenant_id = t.slug
		LEFT JOIN tasks tk ON tk.tenant_id = t.slug
		GROUP BY t.slug, t.name
		ORDER BY t.slug
	`)
	if err != nil {
		c.JSON(500, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]organizationSummary, 0)
	for rows.Next() {
		var row organizationSummary
		if err := rows.Scan(&row.TenantSlug, &row.TenantName, &row.UserCount, &row.ProjectCount, &row.TaskCount); err != nil {
			c.JSON(500, gin.H{"error": "scan failed"})
			return
		}
		items = append(items, row)
	}

	c.JSON(200, gin.H{"items": items})
}

func (s *Service) SystemAnalytics(c *gin.Context) {
	var tenantCount, userCount, projectCount, taskCount int64
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT
			(SELECT COUNT(*) FROM tenants) AS tenant_count,
			(SELECT COUNT(*) FROM users) AS user_count,
			(SELECT COUNT(*) FROM projects) AS project_count,
			(SELECT COUNT(*) FROM tasks) AS task_count
	`).Scan(&tenantCount, &userCount, &projectCount, &taskCount)
	if err != nil {
		c.JSON(500, gin.H{"error": "query failed"})
		return
	}

	c.JSON(200, gin.H{
		"tenant_count":  tenantCount,
		"user_count":    userCount,
		"project_count": projectCount,
		"task_count":    taskCount,
	})
}

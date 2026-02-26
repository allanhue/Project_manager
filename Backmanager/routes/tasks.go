package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin" 
)

type Task struct {
	ID        int64     `json:"id"`
	TenantID  string    `json:"tenant_id"`
	ProjectID *int64    `json:"project_id,omitempty"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	Priority  string    `json:"priority"`
	CreatedAt time.Time `json:"created_at"`
}

type createTaskRequest struct {
	ProjectID *int64 `json:"project_id"`
	Title     string `json:"title" binding:"required"`
	Status    string `json:"status"`
	Priority  string `json:"priority"`
}

func (s *Service) EnsureTasksTable() error {
	_, err := s.DB.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS tasks (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'todo',
			priority TEXT NOT NULL DEFAULT 'medium',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks (tenant_id);
	`)
	return err
}

func (s *Service) ListTasks(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, project_id, title, status, priority, created_at
		FROM tasks
		WHERE tenant_id = $1
		ORDER BY id DESC  
	`, tenantID)
	// In a real app, you'd want pagination here instead of returning all tasks at once.
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		var item Task
		if err := rows.Scan(&item.ID, &item.TenantID, &item.ProjectID, &item.Title, &item.Status, &item.Priority, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		tasks = append(tasks, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": tasks})
}

func (s *Service) CreateTask(c *gin.Context) {
	tenantID := tenantFromContext(c)
	var req createTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.Status == "" {
		req.Status = "todo"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}

	var item Task
	err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tasks (tenant_id, project_id, title, status, priority)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, tenant_id, project_id, title, status, priority, created_at
	`, tenantID, req.ProjectID, req.Title, req.Status, req.Priority).
		Scan(&item.ID, &item.TenantID, &item.ProjectID, &item.Title, &item.Status, &item.Priority, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	c.JSON(http.StatusCreated, item)

	s.sendAsyncNotification(
		emailFromContext(c),
		"Task created",
		"Your task '"+item.Title+"' was created successfully.",
	)
}

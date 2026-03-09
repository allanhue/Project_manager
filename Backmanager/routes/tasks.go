package routes

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Task struct {
	ID          int64     `json:"id"`
	TaskCode    string    `json:"task_code,omitempty"`
	TenantID    string    `json:"tenant_id"`
	ProjectID   int64     `json:"project_id"`
	ProjectName string    `json:"project_name,omitempty"`
	Phase       string    `json:"phase,omitempty"`
	Title       string    `json:"title"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	Subtasks    []string  `json:"subtasks"`
	CreatedAt   time.Time `json:"created_at"`
}

type createTaskRequest struct {
	TaskCode  string   `json:"task_code"`
	ProjectID int64    `json:"project_id" binding:"required,gt=0"`
	Phase     string   `json:"phase"`
	Title     string   `json:"title" binding:"required"`
	Status    string   `json:"status"`
	Priority  string   `json:"priority"`
	Subtasks  []string `json:"subtasks"`
}

type updateTaskRequest struct {
	TaskCode  string   `json:"task_code"`
	ProjectID int64    `json:"project_id" binding:"required,gt=0"`
	Phase     string   `json:"phase"`
	Title     string   `json:"title" binding:"required"`
	Status    string   `json:"status"`
	Priority  string   `json:"priority"`
	Subtasks  []string `json:"subtasks"`
}

func (s *Service) EnsureTasksTable() error {
	_, err := s.DB.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS tasks (
			id BIGSERIAL PRIMARY KEY,
			task_code TEXT NOT NULL DEFAULT '',
			tenant_id TEXT NOT NULL,
			project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
			phase TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'todo',
			priority TEXT NOT NULL DEFAULT 'medium',
			subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;
		ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_code TEXT NOT NULL DEFAULT '';
		ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT '';
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'project_id' AND data_type = 'text'
			) THEN
				ALTER TABLE tasks
				ALTER COLUMN project_id TYPE BIGINT
				USING CASE
					WHEN project_id IS NULL OR trim(project_id) = '' THEN NULL
					WHEN project_id ~ '^[0-9]+$' THEN project_id::BIGINT
					ELSE NULL
				END;
			END IF;
		END $$;
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'subtasks' AND data_type <> 'jsonb'
			) THEN
				ALTER TABLE tasks
				ALTER COLUMN subtasks TYPE JSONB
				USING
					CASE
						WHEN subtasks IS NULL THEN '[]'::jsonb
						ELSE to_jsonb(ARRAY[subtasks::text])
					END;
			END IF;
		END $$;
		CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks (tenant_id);
	`)
	return err
}

func (s *Service) ListTasks(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT tk.id, COALESCE(tk.task_code, ''), tk.tenant_id, tk.project_id, COALESCE(tk.phase, ''), tk.title, tk.status, tk.priority, COALESCE(tk.subtasks, '[]'::jsonb), tk.created_at, COALESCE(p.name, '')
		FROM tasks tk
		LEFT JOIN projects p ON p.id = tk.project_id
		WHERE tk.tenant_id = $1
		ORDER BY tk.id ASC
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
		var projectID sql.NullInt64
		var subtasksRaw []byte
		if err := rows.Scan(&item.ID, &item.TaskCode, &item.TenantID, &projectID, &item.Phase, &item.Title, &item.Status, &item.Priority, &subtasksRaw, &item.CreatedAt, &item.ProjectName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		if projectID.Valid {
			item.ProjectID = projectID.Int64
		}
		item.Subtasks = parseStringArrayJSON(subtasksRaw)
		tasks = append(tasks, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
		return
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
	req.Phase = strings.TrimSpace(req.Phase)
	cleanSubtasks := make([]string, 0, len(req.Subtasks))
	for _, subtask := range req.Subtasks {
		t := strings.TrimSpace(subtask)
		if t != "" {
			cleanSubtasks = append(cleanSubtasks, t)
		}
	}

	var projectName string
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT name
		FROM projects
		WHERE id = $1 AND tenant_id = $2
	`, req.ProjectID, tenantID).Scan(&projectName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project not found for this tenant"})
		return
	}
	subtasksJSON, err := json.Marshal(cleanSubtasks)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid subtasks payload"})
		return
	}

	var item Task
	var subtasksRaw []byte
	err = s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tasks (task_code, tenant_id, project_id, phase, title, status, priority, subtasks)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
		RETURNING id, task_code, tenant_id, project_id, phase, title, status, priority, subtasks, created_at
	`, strings.TrimSpace(req.TaskCode), tenantID, req.ProjectID, req.Phase, strings.TrimSpace(req.Title), req.Status, req.Priority, string(subtasksJSON)).
		Scan(&item.ID, &item.TaskCode, &item.TenantID, &item.ProjectID, &item.Phase, &item.Title, &item.Status, &item.Priority, &subtasksRaw, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	item.ProjectName = projectName
	item.Subtasks = cleanSubtasks
	c.JSON(http.StatusCreated, item)

	s.sendAsyncNotification(
		emailFromContext(c),
		"Task created",
		"Your task '"+item.Title+"' was created successfully.",
	)
}

func (s *Service) UpdateTask(c *gin.Context) {
	tenantID := tenantFromContext(c)
	taskID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || taskID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	var req updateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if strings.TrimSpace(req.Status) == "" {
		req.Status = "todo"
	}
	if strings.TrimSpace(req.Priority) == "" {
		req.Priority = "medium"
	}
	req.Phase = strings.TrimSpace(req.Phase)

	cleanSubtasks := make([]string, 0, len(req.Subtasks))
	for _, subtask := range req.Subtasks {
		t := strings.TrimSpace(subtask)
		if t != "" {
			cleanSubtasks = append(cleanSubtasks, t)
		}
	}

	var projectName string
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT name
		FROM projects
		WHERE id = $1 AND tenant_id = $2
	`, req.ProjectID, tenantID).Scan(&projectName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project not found for this tenant"})
		return
	}
	subtasksJSON, err := json.Marshal(cleanSubtasks)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid subtasks payload"})
		return
	}

	var item Task
	var subtasksRaw []byte
	err = s.DB.QueryRow(c.Request.Context(), `
		UPDATE tasks
		SET task_code = $1, project_id = $2, phase = $3, title = $4, status = $5, priority = $6, subtasks = $7::jsonb
		WHERE id = $8 AND tenant_id = $9
		RETURNING id, task_code, tenant_id, project_id, phase, title, status, priority, subtasks, created_at
	`, strings.TrimSpace(req.TaskCode), req.ProjectID, req.Phase, strings.TrimSpace(req.Title), strings.TrimSpace(req.Status), strings.TrimSpace(req.Priority), string(subtasksJSON), taskID, tenantID).
		Scan(&item.ID, &item.TaskCode, &item.TenantID, &item.ProjectID, &item.Phase, &item.Title, &item.Status, &item.Priority, &subtasksRaw, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	item.ProjectName = projectName
	item.Subtasks = cleanSubtasks
	c.JSON(http.StatusOK, item)
}

func (s *Service) DeleteTask(c *gin.Context) {
	tenantID := tenantFromContext(c)
	taskID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || taskID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	// Debug logging
	fmt.Printf("DeleteTask called: tenantID=%s, taskID=%d\n", tenantID, taskID)

	commandTag, err := s.DB.Exec(c.Request.Context(), `
		DELETE FROM tasks
		WHERE id = $1 AND tenant_id = $2
	`, taskID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func parseStringArrayJSON(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}

	direct := make([]string, 0)
	if err := json.Unmarshal(raw, &direct); err == nil {
		return direct
	}

	var generic []interface{}
	if err := json.Unmarshal(raw, &generic); err == nil {
		out := make([]string, 0, len(generic))
		for _, v := range generic {
			s, ok := v.(string)
			if !ok {
				continue
			}
			s = strings.TrimSpace(s)
			if s != "" {
				out = append(out, s)
			}
		}
		return out
	}

	return []string{}
}

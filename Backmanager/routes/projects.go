package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Project struct {
	ID           int64      `json:"id"`
	ProjectCode  string     `json:"project_code,omitempty"`
	TenantID     string     `json:"tenant_id"`
	Name         string     `json:"name"`
	Status       string     `json:"status"`
	Assignees    []string   `json:"assignees"`
	StartDate    *time.Time `json:"start_date,omitempty"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	DurationDays int        `json:"duration_days"`
	TeamSize     int        `json:"team_size"`
	CreatedAt    time.Time  `json:"created_at"`
}

type createProjectRequest struct {
	ProjectCode  string   `json:"project_code"`
	Name         string   `json:"name" binding:"required"`
	Status       string   `json:"status"`
	Assignees    []string `json:"assignees"`
	StartDate    string   `json:"start_date" binding:"required"`
	DurationDays int      `json:"duration_days" binding:"required,min=1,max=3650"`
	TeamSize     int      `json:"team_size" binding:"required,min=1,max=10000"`
}

type updateProjectRequest struct {
	ProjectCode  string   `json:"project_code"`
	Name         string   `json:"name" binding:"required"`
	Status       string   `json:"status"`
	Assignees    []string `json:"assignees"`
	StartDate    string   `json:"start_date" binding:"required"`
	DurationDays int      `json:"duration_days" binding:"required,min=1,max=3650"`
	TeamSize     int      `json:"team_size" binding:"required,min=1,max=10000"`
}

func (s *Service) EnsureBaseTables(ctx context.Context) error {
	_, err := s.DB.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS tenants (
			id BIGSERIAL PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			logo_url TEXT NOT NULL DEFAULT '',
			max_sessions INT NOT NULL DEFAULT 5,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
		ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_sessions INT NOT NULL DEFAULT 5;

		CREATE TABLE IF NOT EXISTS users (
			id BIGSERIAL PRIMARY KEY,
			public_id TEXT,
			tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'org_admin',
			blocked BOOLEAN NOT NULL DEFAULT false,
			last_login_at TIMESTAMPTZ,
			last_login_user_agent TEXT NOT NULL DEFAULT '',
			last_login_ip TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, email)
		);
		ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'org_admin';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT NOT NULL DEFAULT '';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT NOT NULL DEFAULT '';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id) WHERE public_id IS NOT NULL;

		DO $$
		DECLARE
			row_record RECORD;
			candidate TEXT;
		BEGIN
			FOR row_record IN
				SELECT id
				FROM users
				WHERE public_id IS NULL OR public_id !~ '^[0-9]{7}$'
			LOOP
				LOOP
					candidate := LPAD((FLOOR(RANDOM() * 9000000) + 1000000)::TEXT, 7, '0');
					EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE public_id = candidate);
				END LOOP;
				UPDATE users SET public_id = candidate WHERE id = row_record.id;
			END LOOP;
		END $$;

		CREATE TABLE IF NOT EXISTS projects (
			id BIGSERIAL PRIMARY KEY,
			project_code TEXT NOT NULL DEFAULT '',
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
			start_date DATE,
			due_date DATE,
			duration_days INT NOT NULL DEFAULT 1,
			team_size INT NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS assignees JSONB NOT NULL DEFAULT '[]'::jsonb;
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code TEXT NOT NULL DEFAULT '';
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date DATE;
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS duration_days INT NOT NULL DEFAULT 1;
		ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_size INT NOT NULL DEFAULT 1;

		CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id);
		CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, email);

		CREATE TABLE IF NOT EXISTS system_logs (
			id BIGSERIAL PRIMARY KEY,
			tenant_slug TEXT,
			user_email TEXT,
			role TEXT,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			status_code INT NOT NULL,
			latency_ms BIGINT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_slug ON system_logs (tenant_slug);

		CREATE TABLE IF NOT EXISTS system_updates (
			id BIGSERIAL PRIMARY KEY,
			scheduled_date DATE NOT NULL,
			title TEXT NOT NULL,
			feature_brief TEXT NOT NULL,
			expectations TEXT NOT NULL,
			created_by_email TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_system_updates_scheduled_date ON system_updates (scheduled_date);

		CREATE TABLE IF NOT EXISTS forum_posts (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			author_email TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_forum_posts_tenant_id ON forum_posts (tenant_id);

		CREATE TABLE IF NOT EXISTS issues (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			severity TEXT NOT NULL DEFAULT 'medium',
			status TEXT NOT NULL DEFAULT 'open',
			created_by_email TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_issues_tenant_id ON issues (tenant_id);

		CREATE TABLE IF NOT EXISTS notifications (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			recipient_email TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'info',
			title TEXT NOT NULL,
			detail TEXT NOT NULL,
			meta JSONB NOT NULL DEFAULT '{}'::jsonb,
			read_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient_created
			ON notifications (tenant_id, recipient_email, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_notifications_unread
			ON notifications (tenant_id, recipient_email, read_at);

		CREATE TABLE IF NOT EXISTS user_settings (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_email TEXT NOT NULL,
			timezone TEXT NOT NULL DEFAULT 'UTC',
			week_starts_on TEXT NOT NULL DEFAULT 'monday',
			reminder_frequency TEXT NOT NULL DEFAULT 'daily',
			reminder_days JSONB NOT NULL DEFAULT '[]'::jsonb,
			reminder_time TEXT NOT NULL DEFAULT '09:00',
			reminders_enabled BOOLEAN NOT NULL DEFAULT true,
			daily_digest BOOLEAN NOT NULL DEFAULT true,
			overdue_alerts BOOLEAN NOT NULL DEFAULT true,
			email_summaries BOOLEAN NOT NULL DEFAULT true,
			private_projects BOOLEAN NOT NULL DEFAULT true,
			log_retention_days INT NOT NULL DEFAULT 180,
			admins_can_export BOOLEAN NOT NULL DEFAULT true,
			approval_pipeline TEXT NOT NULL DEFAULT 'simple',
			approval_email_notifications BOOLEAN NOT NULL DEFAULT true,
			approval_approvers JSONB NOT NULL DEFAULT '[]'::jsonb,
			last_reminder_sent_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, user_email)
		);
		ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS approval_pipeline TEXT NOT NULL DEFAULT 'simple';
		ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS approval_email_notifications BOOLEAN NOT NULL DEFAULT true;
		ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS approval_approvers JSONB NOT NULL DEFAULT '[]'::jsonb;
		CREATE INDEX IF NOT EXISTS idx_user_settings_tenant_user ON user_settings (tenant_id, user_email);

		CREATE TABLE IF NOT EXISTS user_profiles (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_email TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			organization_name TEXT NOT NULL DEFAULT '',
			town TEXT NOT NULL DEFAULT '',
			logo_url TEXT NOT NULL DEFAULT '',
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, user_email)
		);
		CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_user ON user_profiles (tenant_id, user_email);

		CREATE TABLE IF NOT EXISTS approval_requests (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
			project_name TEXT NOT NULL DEFAULT '',
			billable_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
			requested_by_email TEXT NOT NULL,
			note TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			approval_mode TEXT NOT NULL DEFAULT 'simple',
			approver_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
			current_step INT NOT NULL DEFAULT 0,
			response_token TEXT NOT NULL DEFAULT '',
			required_approvals INT NOT NULL DEFAULT 1,
			approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_created ON approval_requests (tenant_id, created_at DESC);
		ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS approver_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
		ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS current_step INT NOT NULL DEFAULT 0;
		ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS response_token TEXT NOT NULL DEFAULT '';
	`)
	return err
}

func (s *Service) ListProjects(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, COALESCE(project_code, ''), tenant_id, name, status, COALESCE(assignees, '[]'::jsonb), start_date, due_date, duration_days, team_size, created_at
		FROM projects
		WHERE tenant_id = $1
		ORDER BY id ASC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	projects := make([]Project, 0)
	for rows.Next() {
		var p Project
		var assigneesRaw []byte
		if err := rows.Scan(&p.ID, &p.ProjectCode, &p.TenantID, &p.Name, &p.Status, &assigneesRaw, &p.StartDate, &p.DueDate, &p.DurationDays, &p.TeamSize, &p.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		p.Assignees = make([]string, 0)
		if len(assigneesRaw) > 0 {
			if err := json.Unmarshal(assigneesRaw, &p.Assignees); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid assignees data"})
				return
			}
		}
		projects = append(projects, p)
	}

	c.JSON(http.StatusOK, gin.H{"items": projects})
}

func (s *Service) CreateProject(c *gin.Context) {
	tenantID := tenantFromContext(c)
	var req createProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date must be YYYY-MM-DD"})
		return
	}
	dueDate := startDate.AddDate(0, 0, req.DurationDays-1)
	cleanAssignees := make([]string, 0, len(req.Assignees))
	for _, assignee := range req.Assignees {
		v := strings.TrimSpace(assignee)
		if v != "" {
			cleanAssignees = append(cleanAssignees, v)
		}
	}
	assigneesJSON, err := json.Marshal(cleanAssignees)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignees payload"})
		return
	}

	var p Project
	var assigneesRaw []byte
	err = s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO projects (project_code, tenant_id, name, status, assignees, start_date, due_date, duration_days, team_size)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
		RETURNING id, project_code, tenant_id, name, status, assignees, start_date, due_date, duration_days, team_size, created_at
	`, strings.TrimSpace(req.ProjectCode), tenantID, req.Name, req.Status, string(assigneesJSON), startDate, dueDate, req.DurationDays, req.TeamSize).
		Scan(&p.ID, &p.ProjectCode, &p.TenantID, &p.Name, &p.Status, &assigneesRaw, &p.StartDate, &p.DueDate, &p.DurationDays, &p.TeamSize, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	p.Assignees = cleanAssignees

	c.JSON(http.StatusCreated, p)

	s.sendAsyncNotification(
		emailFromContext(c),
		"Project created",
		"Your project '"+p.Name+"' was created successfully.",
	)
}

func (s *Service) UpdateProject(c *gin.Context) {
	tenantID := tenantFromContext(c)
	projectID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || projectID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	var req updateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if strings.TrimSpace(req.Status) == "" {
		req.Status = "active"
	}
	startDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.StartDate))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date must be YYYY-MM-DD"})
		return
	}
	dueDate := startDate.AddDate(0, 0, req.DurationDays-1)

	cleanAssignees := make([]string, 0, len(req.Assignees))
	for _, assignee := range req.Assignees {
		v := strings.TrimSpace(assignee)
		if v != "" {
			cleanAssignees = append(cleanAssignees, v)
		}
	}
	assigneesJSON, err := json.Marshal(cleanAssignees)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignees payload"})
		return
	}

	var p Project
	var assigneesRaw []byte
	err = s.DB.QueryRow(c.Request.Context(), `
		UPDATE projects
		SET project_code = $1, name = $2, status = $3, assignees = $4::jsonb, start_date = $5, due_date = $6, duration_days = $7, team_size = $8
		WHERE id = $9 AND tenant_id = $10
		RETURNING id, project_code, tenant_id, name, status, assignees, start_date, due_date, duration_days, team_size, created_at
	`, strings.TrimSpace(req.ProjectCode), strings.TrimSpace(req.Name), strings.TrimSpace(req.Status), string(assigneesJSON), startDate, dueDate, req.DurationDays, req.TeamSize, projectID, tenantID).
		Scan(&p.ID, &p.ProjectCode, &p.TenantID, &p.Name, &p.Status, &assigneesRaw, &p.StartDate, &p.DueDate, &p.DurationDays, &p.TeamSize, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	p.Assignees = cleanAssignees
	c.JSON(http.StatusOK, p)

	if strings.EqualFold(strings.TrimSpace(p.Status), "pending") {
		openTasks, _ := s.countOpenProjectTasks(c.Request.Context(), tenantID, p.ID)
		detail := "Project is pending review and still has active work."
		if p.DueDate != nil {
			detail = "Project is pending review. Due " + p.DueDate.Format("2006-01-02") + ". Open tasks: " + strconv.FormatInt(openTasks, 10) + "."
		}
		s.notifyProjectAssignees(
			c.Request.Context(),
			p.TenantID,
			p.ID,
			p.Name,
			cleanAssignees,
			"Pending project reminder: "+p.Name,
			detail,
		)
	}
}

func (s *Service) DeleteProject(c *gin.Context) {
	tenantID := tenantFromContext(c)
	projectID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || projectID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	commandTag, err := s.DB.Exec(c.Request.Context(), `
		DELETE FROM projects
		WHERE id = $1 AND tenant_id = $2
	`, projectID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

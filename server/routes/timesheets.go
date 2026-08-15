package routes

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type TimesheetEntry struct {
	ID             int64     `json:"id"`
	TenantID       string    `json:"tenant_id"`
	ProjectID      *int64    `json:"project_id,omitempty"`
	TaskID         *int64    `json:"task_id,omitempty"`
	ProjectName    string    `json:"project_name,omitempty"`
	TaskTitle      string    `json:"task_title,omitempty"`
	WorkDate       string    `json:"work_date"`
	Hours          float64   `json:"hours"`
	Billable       bool      `json:"billable"`
	Notes          string    `json:"notes"`
	CreatedByEmail string    `json:"created_by_email"`
	CreatedAt      time.Time `json:"created_at"`
}

type createTimesheetRequest struct {
	ProjectID *int64  `json:"project_id"`
	TaskID    *int64  `json:"task_id"`
	WorkDate  string  `json:"work_date" binding:"required"`
	Hours     float64 `json:"hours" binding:"required,gt=0,lte=24"`
	Billable  bool    `json:"billable"`
	Notes     string  `json:"notes"`
}

func (s *Service) EnsureTimesheetsTable() error {
	_, err := s.DB.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS timesheets (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
			task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
			work_date DATE NOT NULL,
			hours NUMERIC(5,2) NOT NULL,
			billable BOOLEAN NOT NULL DEFAULT true,
			notes TEXT NOT NULL DEFAULT '',
			created_by_email TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_date ON timesheets (tenant_id, work_date DESC);
	`)
	return err
}

func (s *Service) ListTimesheets(c *gin.Context) {
	tenantID := tenantFromContext(c)
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT
			ts.id,
			ts.tenant_id,
			ts.project_id,
			ts.task_id,
			COALESCE(p.name, ''),
			COALESCE(tk.title, ''),
			ts.work_date,
			ts.hours::float8,
			ts.billable,
			ts.notes,
			ts.created_by_email,
			ts.created_at
		FROM timesheets ts
		LEFT JOIN projects p ON p.id = ts.project_id
		LEFT JOIN tasks tk ON tk.id = ts.task_id
		WHERE ts.tenant_id = $1
		ORDER BY ts.work_date DESC, ts.id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]TimesheetEntry, 0)
	var billableHours float64
	var nonBillableHours float64
	for rows.Next() {
		var item TimesheetEntry
		var projectID, taskID *int64
		var workDate time.Time
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&projectID,
			&taskID,
			&item.ProjectName,
			&item.TaskTitle,
			&workDate,
			&item.Hours,
			&item.Billable,
			&item.Notes,
			&item.CreatedByEmail,
			&item.CreatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		item.ProjectID = projectID
		item.TaskID = taskID
		item.WorkDate = workDate.Format("2006-01-02")
		item.Notes = strings.TrimSpace(item.Notes)
		if item.Billable {
			billableHours += item.Hours
		} else {
			nonBillableHours += item.Hours
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"summary": gin.H{
			"billable_hours":     billableHours,
			"non_billable_hours": nonBillableHours,
			"total_hours":        billableHours + nonBillableHours,
		},
	})
}

func (s *Service) CreateTimesheet(c *gin.Context) {
	tenantID := tenantFromContext(c)
	var req createTimesheetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	workDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.WorkDate))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "work_date must be YYYY-MM-DD"})
		return
	}
	if req.Hours <= 0 || req.Hours > 24 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hours must be between 0 and 24"})
		return
	}
	hoursRounded, err := strconv.ParseFloat(strconv.FormatFloat(req.Hours, 'f', 2, 64), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hours"})
		return
	}

	if req.ProjectID != nil {
		var exists bool
		if err := s.DB.QueryRow(c.Request.Context(), `
			SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2)
		`, *req.ProjectID, tenantID).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "project not found for this tenant"})
			return
		}
	}
	if req.TaskID != nil {
		var exists bool
		if err := s.DB.QueryRow(c.Request.Context(), `
			SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2)
		`, *req.TaskID, tenantID).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "task not found for this tenant"})
			return
		}
	}

	createdBy := strings.TrimSpace(emailFromContext(c))
	if createdBy == "" {
		createdBy = "unknown"
	}

	var item TimesheetEntry
	var projectName, taskTitle string
	var storedDate time.Time
	err = s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO timesheets (tenant_id, project_id, task_id, work_date, hours, billable, notes, created_by_email)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, tenant_id, project_id, task_id, work_date, hours::float8, billable, notes, created_by_email, created_at
	`, tenantID, req.ProjectID, req.TaskID, workDate, hoursRounded, req.Billable, strings.TrimSpace(req.Notes), createdBy).
		Scan(&item.ID, &item.TenantID, &item.ProjectID, &item.TaskID, &storedDate, &item.Hours, &item.Billable, &item.Notes, &item.CreatedByEmail, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	item.WorkDate = storedDate.Format("2006-01-02")

	if item.ProjectID != nil {
		_ = s.DB.QueryRow(c.Request.Context(), `SELECT COALESCE(name, '') FROM projects WHERE id = $1`, *item.ProjectID).Scan(&projectName)
	}
	if item.TaskID != nil {
		_ = s.DB.QueryRow(c.Request.Context(), `SELECT COALESCE(title, '') FROM tasks WHERE id = $1`, *item.TaskID).Scan(&taskTitle)
	}
	item.ProjectName = projectName
	item.TaskTitle = taskTitle

	c.JSON(http.StatusCreated, item)
}

func (s *Service) DeleteTimesheet(c *gin.Context) {
	tenantID := tenantFromContext(c)
	timesheetID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || timesheetID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timesheet id"})
		return
	}

	commandTag, err := s.DB.Exec(c.Request.Context(), `
		DELETE FROM timesheets
		WHERE id = $1 AND tenant_id = $2
	`, timesheetID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "timesheet not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

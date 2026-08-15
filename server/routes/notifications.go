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

type notificationItem struct {
	ID             string          `json:"id"`
	TenantID       string          `json:"tenant_id"`
	RecipientEmail string          `json:"recipient_email"`
	Type           string          `json:"type"`
	Title          string          `json:"title"`
	Detail         string          `json:"detail"`
	Meta           json.RawMessage `json:"meta,omitempty"`
	ReadAt         *time.Time      `json:"read_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type reminderSummary struct {
	PendingProjects         int64 `json:"pending_projects"`
	AssignedPendingProjects int64 `json:"assigned_pending_projects"`
	OverdueProjects         int64 `json:"overdue_projects"`
	OpenTasks               int64 `json:"open_tasks"`
}

func (s *Service) ListNotifications(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	recipient := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || recipient == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing notification context"})
		return
	}

	limit := 30
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		n, err := strconv.Atoi(rawLimit)
		if err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, recipient_email, type, title, detail, COALESCE(meta, '{}'::jsonb), read_at, created_at
		FROM notifications
		WHERE tenant_id = $1 AND lower(recipient_email) = lower($2)
		ORDER BY created_at DESC, id DESC
		LIMIT $3
	`, tenantID, recipient, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]notificationItem, 0, limit+2)
	for rows.Next() {
		var (
			id int64
			it notificationItem
		)
		if err := rows.Scan(&id, &it.TenantID, &it.RecipientEmail, &it.Type, &it.Title, &it.Detail, &it.Meta, &it.ReadAt, &it.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		it.ID = strconv.FormatInt(id, 10)
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
		return
	}

	summary, err := s.loadReminderSummary(c.Request.Context(), tenantID, recipient)
	if err == nil {
		s.maybeDispatchScheduledReminder(c.Request.Context(), tenantID, recipient, summary)
	}
	if err == nil {
		items = append([]notificationItem{{
			ID:             "summary-" + strconv.FormatInt(time.Now().UTC().Unix(), 10),
			TenantID:       tenantID,
			RecipientEmail: recipient,
			Type:           "summary",
			Title:          "Work summary reminder",
			Detail: "Pending projects: " + strconv.FormatInt(summary.PendingProjects, 10) +
				" | Assigned to you: " + strconv.FormatInt(summary.AssignedPendingProjects, 10) +
				" | Overdue projects: " + strconv.FormatInt(summary.OverdueProjects, 10) +
				" | Open tasks: " + strconv.FormatInt(summary.OpenTasks, 10),
			CreatedAt: time.Now().UTC(),
		}}, items...)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":   items,
		"summary": summary,
	})
}

func (s *Service) MarkNotificationRead(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	recipient := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || recipient == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing notification context"})
		return
	}

	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	cmd, err := s.DB.Exec(c.Request.Context(), `
		UPDATE notifications
		SET read_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND lower(recipient_email) = lower($3) AND read_at IS NULL
	`, id, tenantID, recipient)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	if cmd.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "read"})
}

func (s *Service) loadReminderSummary(ctx context.Context, tenantID, recipient string) (reminderSummary, error) {
	var summary reminderSummary
	err := s.DB.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM projects p WHERE p.tenant_id = $1 AND lower(trim(p.status)) = 'pending') AS pending_projects,
			(
				SELECT COUNT(*)
				FROM projects p
				WHERE p.tenant_id = $1
					AND lower(trim(p.status)) = 'pending'
					AND EXISTS (
						SELECT 1
						FROM jsonb_array_elements_text(COALESCE(p.assignees, '[]'::jsonb)) AS a(value)
						WHERE lower(trim(a.value)) = lower($2)
					)
			) AS assigned_pending_projects,
			(
				SELECT COUNT(*)
				FROM projects p
				WHERE p.tenant_id = $1
					AND lower(trim(p.status)) NOT IN ('done', 'completed', 'closed')
					AND p.due_date IS NOT NULL
					AND p.due_date < CURRENT_DATE
			) AS overdue_projects,
			(
				SELECT COUNT(*)
				FROM tasks t
				WHERE t.tenant_id = $1
					AND lower(trim(t.status)) NOT IN ('done', 'completed', 'closed')
			) AS open_tasks
	`, tenantID, recipient).Scan(
		&summary.PendingProjects,
		&summary.AssignedPendingProjects,
		&summary.OverdueProjects,
		&summary.OpenTasks,
	)
	return summary, err
}

func (s *Service) countOpenProjectTasks(ctx context.Context, tenantID string, projectID int64) (int64, error) {
	var count int64
	err := s.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM tasks
		WHERE tenant_id = $1
			AND project_id = $2
			AND lower(trim(status)) NOT IN ('done', 'completed', 'closed')
	`, tenantID, projectID).Scan(&count)
	return count, err
}

func (s *Service) notifyProjectAssignees(
	ctx context.Context,
	tenantID string,
	projectID int64,
	projectName string,
	assignees []string,
	subject string,
	detail string,
) {
	recipients := uniqueEmails(assignees)
	if len(recipients) == 0 {
		return
	}

	_ = s.createInAppNotification(ctx, tenantID, recipients, "project", subject, detail, map[string]any{
		"project_id":   projectID,
		"project_name": projectName,
		"status":       "pending",
	})

	message := "Project reminder\n\nProject: " + projectName + "\nStatus: pending\nSummary: " + detail + "\n\nPlease review and close pending work items."
	for _, to := range recipients {
		s.sendAsyncNotification(to, subject, message)
	}
}

func (s *Service) createInAppNotification(
	ctx context.Context,
	tenantID string,
	recipients []string,
	notifType string,
	title string,
	detail string,
	meta map[string]any,
) error {
	if strings.TrimSpace(tenantID) == "" || len(recipients) == 0 {
		return nil
	}
	metaJSON, _ := json.Marshal(meta)
	for _, recipient := range recipients {
		if _, err := s.DB.Exec(ctx, `
			INSERT INTO notifications (tenant_id, recipient_email, type, title, detail, meta)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		`, tenantID, recipient, strings.TrimSpace(notifType), strings.TrimSpace(title), strings.TrimSpace(detail), string(metaJSON)); err != nil {
			return err
		}
	}
	return nil
}

func uniqueEmails(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		v := strings.ToLower(strings.TrimSpace(item))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func (s *Service) maybeDispatchScheduledReminder(ctx context.Context, tenantID, recipient string, summary reminderSummary) {
	var (
		timezone         string
		frequency        string
		reminderDaysRaw  []byte
		reminderTime     string
		remindersEnabled bool
		lastSentAt       *time.Time
	)
	err := s.DB.QueryRow(ctx, `
		SELECT timezone, reminder_frequency, reminder_days, reminder_time, reminders_enabled, last_reminder_sent_at
		FROM user_settings
		WHERE tenant_id = $1 AND lower(user_email) = lower($2)
	`, tenantID, recipient).Scan(&timezone, &frequency, &reminderDaysRaw, &reminderTime, &remindersEnabled, &lastSentAt)
	if err != nil || !remindersEnabled {
		return
	}

	days := parseStringArrayJSON(reminderDaysRaw)
	loc := time.UTC
	if tz := strings.TrimSpace(timezone); tz != "" {
		if loaded, err := time.LoadLocation(tz); err == nil {
			loc = loaded
		}
	}
	now := time.Now().In(loc)
	targetTime, err := time.Parse("15:04", strings.TrimSpace(reminderTime))
	if err != nil {
		targetTime, _ = time.Parse("15:04", "09:00")
	}
	dueClock := time.Date(now.Year(), now.Month(), now.Day(), targetTime.Hour(), targetTime.Minute(), 0, 0, loc)
	if now.Before(dueClock) {
		return
	}
	if lastSentAt != nil {
		lastLocal := lastSentAt.In(loc)
		if lastLocal.Year() == now.Year() && lastLocal.Month() == now.Month() && lastLocal.Day() == now.Day() {
			return
		}
	}

	todayWeekday := strings.ToLower(now.Weekday().String())
	shouldSend := false
	switch strings.ToLower(strings.TrimSpace(frequency)) {
	case "daily":
		shouldSend = true
	case "weekly":
		for _, d := range days {
			if strings.ToLower(strings.TrimSpace(d)) == todayWeekday {
				shouldSend = true
				break
			}
		}
	case "custom":
		for _, d := range days {
			if strings.ToLower(strings.TrimSpace(d)) == todayWeekday {
				shouldSend = true
				break
			}
		}
	default:
		shouldSend = true
	}
	if !shouldSend {
		return
	}

	subject := "PulseForge reminder: pending work summary"
	message := "Hello,\n\nThis is your scheduled reminder.\n\n" +
		"Pending projects: " + strconv.FormatInt(summary.PendingProjects, 10) + "\n" +
		"Assigned pending projects: " + strconv.FormatInt(summary.AssignedPendingProjects, 10) + "\n" +
		"Overdue projects: " + strconv.FormatInt(summary.OverdueProjects, 10) + "\n" +
		"Open tasks: " + strconv.FormatInt(summary.OpenTasks, 10) + "\n\n" +
		"Please review and close outstanding work items."

	if err := s.sendMail(context.Background(), recipient, subject, message); err != nil {
		return
	}
	_ = s.createInAppNotification(ctx, tenantID, []string{recipient}, "summary", "Scheduled reminder", "A scheduled summary reminder has been sent to your email.", map[string]any{
		"pending_projects":          summary.PendingProjects,
		"assigned_pending_projects": summary.AssignedPendingProjects,
		"overdue_projects":          summary.OverdueProjects,
		"open_tasks":                summary.OpenTasks,
	})
	_, _ = s.DB.Exec(ctx, `
		UPDATE user_settings
		SET last_reminder_sent_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND lower(user_email) = lower($2)
	`, tenantID, recipient)
}

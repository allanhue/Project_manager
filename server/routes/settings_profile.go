package routes

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type userSettingsResponse struct {
	Timezone          string   `json:"timezone"`
	WeekStartsOn      string   `json:"week_starts_on"`
	ReminderFrequency string   `json:"reminder_frequency"`
	ReminderDays      []string `json:"reminder_days"`
	ReminderTime      string   `json:"reminder_time"`
	RemindersEnabled  bool     `json:"reminders_enabled"`
	DailyDigest       bool     `json:"daily_digest"`
	OverdueAlerts     bool     `json:"overdue_alerts"`
	EmailSummaries    bool     `json:"email_summaries"`
	PrivateProjects   bool     `json:"private_projects"`
	LogRetentionDays  int      `json:"log_retention_days"`
	AdminsCanExport   bool     `json:"admins_can_export"`
	ApprovalPipeline  string   `json:"approval_pipeline"`
	ApprovalEmails    bool     `json:"approval_email_notifications"`
	ApprovalApprovers []string `json:"approval_approvers"`
}

type updateUserSettingsRequest struct {
	Timezone          string   `json:"timezone"`
	WeekStartsOn      string   `json:"week_starts_on"`
	ReminderFrequency string   `json:"reminder_frequency"`
	ReminderDays      []string `json:"reminder_days"`
	ReminderTime      string   `json:"reminder_time"`
	RemindersEnabled  bool     `json:"reminders_enabled"`
	DailyDigest       bool     `json:"daily_digest"`
	OverdueAlerts     bool     `json:"overdue_alerts"`
	EmailSummaries    bool     `json:"email_summaries"`
	PrivateProjects   bool     `json:"private_projects"`
	LogRetentionDays  int      `json:"log_retention_days"`
	AdminsCanExport   bool     `json:"admins_can_export"`
	ApprovalPipeline  string   `json:"approval_pipeline"`
	ApprovalEmails    bool     `json:"approval_email_notifications"`
	ApprovalApprovers []string `json:"approval_approvers"`
}

type userProfileResponse struct {
	DisplayName       string `json:"display_name"`
	Phone             string `json:"phone"`
	OrganizationName  string `json:"organization_name"`
	Town              string `json:"town"`
	LogoURL           string `json:"logo_url"`
	MaxSessions       int64  `json:"max_sessions"`
	ActiveSessions24h int64  `json:"active_sessions_24h"`
}

type updateUserProfileRequest struct {
	DisplayName      string `json:"display_name"`
	Phone            string `json:"phone"`
	OrganizationName string `json:"organization_name"`
	Town             string `json:"town"`
	LogoURL          string `json:"logo_url"`
}

func (s *Service) GetUserSettings(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	email := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	if _, err := s.DB.Exec(c.Request.Context(), `
		INSERT INTO user_settings (tenant_id, user_email)
		VALUES ($1, $2)
		ON CONFLICT (tenant_id, user_email) DO NOTHING
	`, tenantID, email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize user settings"})
		return
	}

	var out userSettingsResponse
	var reminderDaysRaw []byte
	var approversRaw []byte
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT timezone, week_starts_on, reminder_frequency, reminder_days, reminder_time, reminders_enabled,
		       daily_digest, overdue_alerts, email_summaries, private_projects, log_retention_days, admins_can_export,
		       COALESCE(approval_pipeline, 'simple'), COALESCE(approval_email_notifications, true), COALESCE(approval_approvers, '[]'::jsonb)
		FROM user_settings
		WHERE tenant_id = $1 AND lower(user_email) = lower($2)
	`, tenantID, email).Scan(
		&out.Timezone,
		&out.WeekStartsOn,
		&out.ReminderFrequency,
		&reminderDaysRaw,
		&out.ReminderTime,
		&out.RemindersEnabled,
		&out.DailyDigest,
		&out.OverdueAlerts,
		&out.EmailSummaries,
		&out.PrivateProjects,
		&out.LogRetentionDays,
		&out.AdminsCanExport,
		&out.ApprovalPipeline,
		&out.ApprovalEmails,
		&approversRaw,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user settings"})
		return
	}
	out.ReminderDays = parseStringArrayJSON(reminderDaysRaw)
	out.ApprovalApprovers = uniqueEmails(parseStringArrayJSON(approversRaw))
	if len(out.ReminderDays) == 0 {
		out.ReminderDays = []string{"monday", "wednesday", "friday"}
	}
	c.JSON(http.StatusOK, out)
}

func (s *Service) UpdateUserSettings(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	email := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	var req updateUserSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if strings.TrimSpace(req.Timezone) == "" {
		req.Timezone = "UTC"
	}
	if strings.TrimSpace(req.WeekStartsOn) == "" {
		req.WeekStartsOn = "monday"
	}
	if strings.TrimSpace(req.ReminderFrequency) == "" {
		req.ReminderFrequency = "daily"
	}
	if strings.TrimSpace(req.ReminderTime) == "" {
		req.ReminderTime = "09:00"
	}
	if _, err := time.Parse("15:04", req.ReminderTime); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reminder_time must be HH:MM"})
		return
	}
	req.ApprovalPipeline = strings.ToLower(strings.TrimSpace(req.ApprovalPipeline))
	if req.ApprovalPipeline == "" {
		req.ApprovalPipeline = "simple"
	}
	if req.ApprovalPipeline != "simple" && req.ApprovalPipeline != "multi_approval" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "approval_pipeline must be simple or multi_approval"})
		return
	}
	req.ApprovalApprovers = uniqueEmails(req.ApprovalApprovers)
	if req.ApprovalPipeline == "simple" && len(req.ApprovalApprovers) > 1 {
		req.ApprovalApprovers = req.ApprovalApprovers[:1]
	}
	if req.LogRetentionDays < 1 {
		req.LogRetentionDays = 1
	}
	days := normalizeReminderDays(req.ReminderDays)
	daysJSON, _ := json.Marshal(days)
	approversJSON, _ := json.Marshal(uniqueEmails(req.ApprovalApprovers))

	if _, err := s.DB.Exec(c.Request.Context(), `
		INSERT INTO user_settings (
			tenant_id, user_email, timezone, week_starts_on, reminder_frequency, reminder_days, reminder_time,
			reminders_enabled, daily_digest, overdue_alerts, email_summaries, private_projects, log_retention_days, admins_can_export,
			approval_pipeline, approval_email_notifications, approval_approvers, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW())
		ON CONFLICT (tenant_id, user_email) DO UPDATE SET
			timezone = EXCLUDED.timezone,
			week_starts_on = EXCLUDED.week_starts_on,
			reminder_frequency = EXCLUDED.reminder_frequency,
			reminder_days = EXCLUDED.reminder_days,
			reminder_time = EXCLUDED.reminder_time,
			reminders_enabled = EXCLUDED.reminders_enabled,
			daily_digest = EXCLUDED.daily_digest,
			overdue_alerts = EXCLUDED.overdue_alerts,
			email_summaries = EXCLUDED.email_summaries,
			private_projects = EXCLUDED.private_projects,
			log_retention_days = EXCLUDED.log_retention_days,
			admins_can_export = EXCLUDED.admins_can_export,
			approval_pipeline = EXCLUDED.approval_pipeline,
			approval_email_notifications = EXCLUDED.approval_email_notifications,
			approval_approvers = EXCLUDED.approval_approvers,
			updated_at = NOW()
	`, tenantID, email, strings.TrimSpace(req.Timezone), strings.TrimSpace(req.WeekStartsOn), strings.TrimSpace(req.ReminderFrequency), string(daysJSON),
		strings.TrimSpace(req.ReminderTime), req.RemindersEnabled, req.DailyDigest, req.OverdueAlerts, req.EmailSummaries, req.PrivateProjects,
		req.LogRetentionDays, req.AdminsCanExport, req.ApprovalPipeline, req.ApprovalEmails, string(approversJSON)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "saved"})
}

func (s *Service) GetUserProfile(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	email := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	if _, err := s.DB.Exec(c.Request.Context(), `
		INSERT INTO user_profiles (tenant_id, user_email, display_name)
		VALUES ($1, $2, split_part($2, '@', 1))
		ON CONFLICT (tenant_id, user_email) DO NOTHING
	`, tenantID, email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize profile"})
		return
	}

	var out userProfileResponse
	err := s.DB.QueryRow(c.Request.Context(), `
		SELECT display_name, phone, organization_name, town, logo_url
		FROM user_profiles
		WHERE tenant_id = $1 AND lower(user_email) = lower($2)
	`, tenantID, email).Scan(&out.DisplayName, &out.Phone, &out.OrganizationName, &out.Town, &out.LogoURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load profile"})
		return
	}

	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(t.max_sessions, 5),
			(SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.last_login_at >= NOW() - INTERVAL '24 hours')
		FROM tenants t
		WHERE t.slug = $1
		LIMIT 1
	`, tenantID).Scan(&out.MaxSessions, &out.ActiveSessions24h); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load session usage"})
		return
	}
	c.JSON(http.StatusOK, out)
}

func (s *Service) UpdateUserProfile(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	email := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	var req updateUserProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	logo := strings.TrimSpace(req.LogoURL)
	if logo != "" {
		isUpload := strings.HasPrefix(logo, "data:image/")
		isLegacyURL := strings.HasPrefix(logo, "http://") || strings.HasPrefix(logo, "https://")
		if !isUpload && !isLegacyURL {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid logo format"})
			return
		}
	}

	if _, err := s.DB.Exec(c.Request.Context(), `
		INSERT INTO user_profiles (tenant_id, user_email, display_name, phone, organization_name, town, logo_url, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (tenant_id, user_email) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			phone = EXCLUDED.phone,
			organization_name = EXCLUDED.organization_name,
			town = EXCLUDED.town,
			logo_url = EXCLUDED.logo_url,
			updated_at = NOW()
	`, tenantID, email, strings.TrimSpace(req.DisplayName), strings.TrimSpace(req.Phone), strings.TrimSpace(req.OrganizationName), strings.TrimSpace(req.Town), logo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "saved"})
}

func normalizeReminderDays(items []string) []string {
	allowed := map[string]struct{}{
		"monday": {}, "tuesday": {}, "wednesday": {}, "thursday": {}, "friday": {}, "saturday": {}, "sunday": {},
	}
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		v := strings.ToLower(strings.TrimSpace(item))
		if _, ok := allowed[v]; !ok {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return []string{"monday", "wednesday", "friday"}
	}
	return out
}

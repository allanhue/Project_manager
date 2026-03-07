package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type approvalRequestItem struct {
	ID                int64     `json:"id"`
	TenantID          string    `json:"tenant_id"`
	ProjectID         *int64    `json:"project_id,omitempty"`
	ProjectName       string    `json:"project_name"`
	BillableHours     float64   `json:"billable_hours"`
	RequestedByEmail  string    `json:"requested_by_email"`
	Note              string    `json:"note"`
	Status            string    `json:"status"`
	ApprovalMode      string    `json:"approval_mode"`
	ApproverEmails    []string  `json:"approver_emails"`
	CurrentStep       int       `json:"current_step"`
	RequiredApprovals int       `json:"required_approvals"`
	Approvals         []string  `json:"approvals"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type createApprovalRequest struct {
	ProjectID *int64  `json:"project_id"`
	Note      string  `json:"note"`
	Hours     float64 `json:"hours"`
}

type approvalActionRequest struct {
	Action string `json:"action"`
}

func (s *Service) ListApprovalRequests(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, tenant_id, project_id, COALESCE(project_name, ''), billable_hours::float8, requested_by_email,
		       COALESCE(note, ''), status, approval_mode, COALESCE(approver_emails, '[]'::jsonb), current_step, required_approvals, COALESCE(approvals, '[]'::jsonb), created_at, updated_at
		FROM approval_requests
		WHERE tenant_id = $1
		ORDER BY created_at DESC, id DESC
	`, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]approvalRequestItem, 0)
	for rows.Next() {
		var item approvalRequestItem
		var approverEmailsRaw []byte
		var approvalsRaw []byte
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.ProjectID,
			&item.ProjectName,
			&item.BillableHours,
			&item.RequestedByEmail,
			&item.Note,
			&item.Status,
			&item.ApprovalMode,
			&approverEmailsRaw,
			&item.CurrentStep,
			&item.RequiredApprovals,
			&approvalsRaw,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		item.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
		item.Approvals = parseStringArrayJSON(approvalsRaw)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateApprovalRequest(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	requester := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	if tenantID == "" || requester == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	var req createApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var projectName string
	if req.ProjectID != nil {
		if err := s.DB.QueryRow(c.Request.Context(), `
			SELECT COALESCE(name, '')
			FROM projects
			WHERE id = $1 AND tenant_id = $2
			LIMIT 1
		`, *req.ProjectID, tenantID).Scan(&projectName); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "project not found for this tenant"})
			return
		}
	}
	if projectName == "" {
		projectName = "Unspecified Project"
	}

	var pipeline string
	var approvalEmails bool
	var approversRaw []byte
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT COALESCE(approval_pipeline, 'simple'), COALESCE(approval_email_notifications, true), COALESCE(approval_approvers, '[]'::jsonb)
		FROM user_settings
		WHERE tenant_id = $1 AND lower(user_email) = lower($2)
		LIMIT 1
	`, tenantID, requester).Scan(&pipeline, &approvalEmails, &approversRaw); err != nil {
		pipeline = "simple"
		approvalEmails = true
	}
	configuredApprovers := uniqueEmails(parseStringArrayJSON(approversRaw))
	if len(configuredApprovers) == 0 {
		configuredApprovers, _ = s.listTenantOrgAdminEmails(c.Request.Context(), tenantID)
	}
	if len(configuredApprovers) == 0 {
		configuredApprovers = []string{requester}
	}
	if strings.TrimSpace(pipeline) != "multi_approval" && len(configuredApprovers) > 1 {
		configuredApprovers = configuredApprovers[:1]
	}
	requiredApprovals := len(configuredApprovers)
	if requiredApprovals < 1 {
		requiredApprovals = 1
	}

	hours := req.Hours
	if hours <= 0 && req.ProjectID != nil {
		_ = s.DB.QueryRow(c.Request.Context(), `
			SELECT COALESCE(SUM(hours)::float8, 0)
			FROM timesheets
			WHERE tenant_id = $1 AND project_id = $2 AND billable = true
		`, tenantID, *req.ProjectID).Scan(&hours)
	}
	if hours < 0 {
		hours = 0
	}

	var out approvalRequestItem
	var approverEmailsRaw []byte
	var approvalsRaw []byte
	approverEmailsJSON, _ := json.Marshal(configuredApprovers)
	if err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO approval_requests (
			tenant_id, project_id, project_name, billable_hours, requested_by_email, note, status, approval_mode,
			approver_emails, current_step, response_token, required_approvals, approvals, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8::jsonb, 0, '', $9, '[]'::jsonb, NOW(), NOW())
		RETURNING id, tenant_id, project_id, project_name, billable_hours::float8, requested_by_email, note, status, approval_mode,
		          approver_emails, current_step, required_approvals, approvals, created_at, updated_at
	`, tenantID, req.ProjectID, strings.TrimSpace(projectName), hours, requester, strings.TrimSpace(req.Note), pipeline, string(approverEmailsJSON), requiredApprovals).
		Scan(&out.ID, &out.TenantID, &out.ProjectID, &out.ProjectName, &out.BillableHours, &out.RequestedByEmail, &out.Note, &out.Status, &out.ApprovalMode, &approverEmailsRaw, &out.CurrentStep, &out.RequiredApprovals, &approvalsRaw, &out.CreatedAt, &out.UpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	out.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
	out.Approvals = parseStringArrayJSON(approvalsRaw)

	if approvalEmails {
		if err := s.sendApprovalStepEmail(c.Request.Context(), out); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error": "approval request created but failed to send approval email: " + err.Error(),
				"id":    out.ID,
			})
			return
		}
	}
	_ = s.createInAppNotification(c.Request.Context(), tenantID, []string{requester}, "approval", "Approval request submitted", "Approval is pending via email pipeline.", map[string]any{
		"approval_id": out.ID,
		"project":     out.ProjectName,
	})

	c.JSON(http.StatusCreated, out)
}

func (s *Service) ActionApprovalRequest(c *gin.Context) {
	tenantID := strings.TrimSpace(tenantFromContext(c))
	actor := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid approval id"})
		return
	}
	var req approvalActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "approve" && action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "action must be approve or reject"})
		return
	}

	var item approvalRequestItem
	var approverEmailsRaw []byte
	var approvalsRaw []byte
	err = s.DB.QueryRow(c.Request.Context(), `
		SELECT id, tenant_id, project_id, project_name, billable_hours::float8, requested_by_email, COALESCE(note, ''), status, approval_mode,
		       COALESCE(approver_emails, '[]'::jsonb), current_step, required_approvals, COALESCE(approvals, '[]'::jsonb), created_at, updated_at
		FROM approval_requests
		WHERE id = $1 AND tenant_id = $2
		LIMIT 1
	`, id, tenantID).Scan(
		&item.ID, &item.TenantID, &item.ProjectID, &item.ProjectName, &item.BillableHours, &item.RequestedByEmail,
		&item.Note, &item.Status, &item.ApprovalMode, &approverEmailsRaw, &item.CurrentStep, &item.RequiredApprovals, &approvalsRaw, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "approval request not found"})
		return
	}
	if item.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "approval request already closed"})
		return
	}
	item.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
	item.Approvals = parseStringArrayJSON(approvalsRaw)
	if len(item.ApproverEmails) == 0 || item.CurrentStep < 0 || item.CurrentStep >= len(item.ApproverEmails) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "approval routing is not configured"})
		return
	}
	expected := strings.ToLower(strings.TrimSpace(item.ApproverEmails[item.CurrentStep]))
	if actor == "" || actor != expected {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the current approver for this step"})
		return
	}

	if action == "reject" {
		if _, err := s.DB.Exec(c.Request.Context(), `
			UPDATE approval_requests
			SET status = 'rejected', updated_at = NOW()
			WHERE id = $1 AND tenant_id = $2
		`, id, tenantID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject request"})
			return
		}
		_ = s.createInAppNotification(c.Request.Context(), tenantID, []string{item.RequestedByEmail}, "approval", "Approval rejected", "Your approval request was rejected.", map[string]any{"approval_id": id, "project": item.ProjectName})
		_ = s.sendMail(c.Request.Context(), item.RequestedByEmail, fmt.Sprintf("Approval Rejected | %s", item.ProjectName), fmt.Sprintf("Your approval request for %s was rejected by %s.", item.ProjectName, actor))
		item.Status = "rejected"
		c.JSON(http.StatusOK, item)
		return
	}

	already := false
	for _, entry := range item.Approvals {
		if strings.EqualFold(strings.TrimSpace(entry), actor) {
			already = true
			break
		}
	}
	if !already {
		item.Approvals = append(item.Approvals, actor)
	}
	approvalsJSON, _ := json.Marshal(item.Approvals)
	nextStep := item.CurrentStep + 1
	if nextStep >= item.RequiredApprovals || nextStep >= len(item.ApproverEmails) {
		if _, err := s.DB.Exec(c.Request.Context(), `
			UPDATE approval_requests
			SET status = 'approved', approvals = $1::jsonb, current_step = $2, updated_at = NOW()
			WHERE id = $3 AND tenant_id = $4
		`, string(approvalsJSON), nextStep, id, tenantID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete approval"})
			return
		}
		_ = s.createInAppNotification(c.Request.Context(), tenantID, []string{item.RequestedByEmail}, "approval", "Approval completed", "Your request has been approved.", map[string]any{"approval_id": id, "project": item.ProjectName})
		_ = s.sendMail(c.Request.Context(), item.RequestedByEmail, fmt.Sprintf("Approval Completed | %s", item.ProjectName), fmt.Sprintf("Your approval request for %s has been approved.", item.ProjectName))
		item.Status = "approved"
		item.CurrentStep = nextStep
		item.Approvals = parseStringArrayJSON(approvalsJSON)
		c.JSON(http.StatusOK, item)
		return
	}

	if _, err := s.DB.Exec(c.Request.Context(), `
		UPDATE approval_requests
		SET approvals = $1::jsonb, current_step = $2, updated_at = NOW()
		WHERE id = $3 AND tenant_id = $4
	`, string(approvalsJSON), nextStep, id, tenantID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to progress approval"})
		return
	}
	item.CurrentStep = nextStep
	item.Approvals = parseStringArrayJSON(approvalsJSON)
	if err := s.sendApprovalStepEmail(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "approved but failed to email next approver: " + err.Error()})
		return
	}
	_ = s.createInAppNotification(c.Request.Context(), tenantID, []string{item.RequestedByEmail}, "approval", "Approval progressed", "One approver approved. Workflow moved to next approver.", map[string]any{"approval_id": id, "project": item.ProjectName, "step": nextStep + 1})
	c.JSON(http.StatusOK, item)
}

func (s *Service) listTenantOrgAdminEmails(ctx context.Context, tenantSlug string) ([]string, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT lower(u.email)
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1 AND u.role = 'org_admin' AND COALESCE(u.blocked, false) = false
		ORDER BY u.created_at DESC
	`, strings.TrimSpace(tenantSlug))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return nil, err
		}
		if email != "" {
			out = append(out, email)
		}
	}
	return out, nil
}

func (s *Service) sendApprovalStepEmail(ctx context.Context, item approvalRequestItem) error {
	if len(item.ApproverEmails) == 0 || item.CurrentStep < 0 || item.CurrentStep >= len(item.ApproverEmails) {
		return fmt.Errorf("no approver configured for current step")
	}
	approver := item.ApproverEmails[item.CurrentStep]
	subject := fmt.Sprintf("Approval Needed | %s", item.ProjectName)
	message := fmt.Sprintf(
		"Approval request pending.\n\nTenant: %s\nProject: %s\nBillable Hours: %.2f\nRequested By: %s\nPipeline: %s\nStep: %d of %d\nNote: %s\n\nAction required in system:\nLogin to PulseForge and open the Approvals module to approve/reject.",
		item.TenantID,
		item.ProjectName,
		item.BillableHours,
		item.RequestedByEmail,
		strings.ReplaceAll(item.ApprovalMode, "_", " "),
		item.CurrentStep+1,
		item.RequiredApprovals,
		item.Note,
	)
	if err := s.sendMail(ctx, approver, subject, message); err != nil {
		return err
	}
	return nil
}

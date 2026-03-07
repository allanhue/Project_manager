package routes

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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
	var responseToken string
	var approverEmailsRaw []byte
	var approvalsRaw []byte
	tokenValue, tokenErr := generateApprovalToken()
	if tokenErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize approval token"})
		return
	}
	responseToken = tokenValue
	approverEmailsJSON, _ := json.Marshal(configuredApprovers)
	if err := s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO approval_requests (
			tenant_id, project_id, project_name, billable_hours, requested_by_email, note, status, approval_mode,
			approver_emails, current_step, response_token, required_approvals, approvals, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8::jsonb, 0, $9, $10, '[]'::jsonb, NOW(), NOW())
		RETURNING id, tenant_id, project_id, project_name, billable_hours::float8, requested_by_email, note, status, approval_mode,
		          approver_emails, current_step, required_approvals, approvals, created_at, updated_at
	`, tenantID, req.ProjectID, strings.TrimSpace(projectName), hours, requester, strings.TrimSpace(req.Note), pipeline, string(approverEmailsJSON), responseToken, requiredApprovals).
		Scan(&out.ID, &out.TenantID, &out.ProjectID, &out.ProjectName, &out.BillableHours, &out.RequestedByEmail, &out.Note, &out.Status, &out.ApprovalMode, &approverEmailsRaw, &out.CurrentStep, &out.RequiredApprovals, &approvalsRaw, &out.CreatedAt, &out.UpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}
	out.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
	out.Approvals = parseStringArrayJSON(approvalsRaw)

	if approvalEmails {
		s.sendApprovalStepEmail(c.Request.Context(), out, responseToken)
	}
	_ = s.createInAppNotification(c.Request.Context(), tenantID, []string{requester}, "approval", "Approval request submitted", "Approval is pending via email pipeline.", map[string]any{
		"approval_id": out.ID,
		"project":     out.ProjectName,
	})

	c.JSON(http.StatusCreated, out)
}

func (s *Service) ActionApprovalRequest(c *gin.Context) {
	c.JSON(http.StatusForbidden, gin.H{"error": "Approval actions are mail-only. Use the approval email link."})
}

func (s *Service) ApprovalRespondViaMail(c *gin.Context) {
	id, err := strconv.ParseInt(strings.TrimSpace(c.Query("id")), 10, 64)
	if err != nil || id <= 0 {
		c.String(http.StatusBadRequest, "Invalid approval id")
		return
	}
	token := strings.TrimSpace(c.Query("token"))
	action := strings.ToLower(strings.TrimSpace(c.Query("action")))
	if token == "" || (action != "approve" && action != "reject") {
		c.String(http.StatusBadRequest, "Invalid approval response link")
		return
	}

	msg, statusCode := s.handleEmailApprovalDecision(c.Request.Context(), id, token, action)
	c.String(statusCode, msg)
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

func generateApprovalToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) sendApprovalStepEmail(ctx context.Context, item approvalRequestItem, responseToken string) {
	if len(item.ApproverEmails) == 0 || item.CurrentStep < 0 || item.CurrentStep >= len(item.ApproverEmails) {
		return
	}
	approver := item.ApproverEmails[item.CurrentStep]
	base := strings.TrimSpace(os.Getenv("BACKEND_PUBLIC_URL"))
	if base == "" {
		base = "http://localhost:8080"
	}
	base = strings.TrimSuffix(base, "/")
	approveURL := fmt.Sprintf("%s/api/v1/approvals/respond?id=%d&action=approve&token=%s", base, item.ID, responseToken)
	rejectURL := fmt.Sprintf("%s/api/v1/approvals/respond?id=%d&action=reject&token=%s", base, item.ID, responseToken)
	subject := fmt.Sprintf("Approval Needed | %s", item.ProjectName)
	message := fmt.Sprintf(
		"Approval request pending.\n\nTenant: %s\nProject: %s\nBillable Hours: %.2f\nRequested By: %s\nPipeline: %s\nStep: %d of %d\nNote: %s\n\nApprove:\n%s\n\nReject:\n%s\n\nThis link is the only valid approval channel.",
		item.TenantID,
		item.ProjectName,
		item.BillableHours,
		item.RequestedByEmail,
		strings.ReplaceAll(item.ApprovalMode, "_", " "),
		item.CurrentStep+1,
		item.RequiredApprovals,
		item.Note,
		approveURL,
		rejectURL,
	)
	s.sendAsyncNotification(approver, subject, message)
}

func (s *Service) handleEmailApprovalDecision(ctx context.Context, id int64, token, action string) (string, int) {
	var item approvalRequestItem
	var approverEmailsRaw []byte
	var approvalsRaw []byte
	var responseToken string
	err := s.DB.QueryRow(ctx, `
		SELECT id, tenant_id, project_id, project_name, billable_hours::float8, requested_by_email, COALESCE(note, ''), status, approval_mode,
		       COALESCE(approver_emails, '[]'::jsonb), current_step, required_approvals, COALESCE(approvals, '[]'::jsonb), response_token, created_at, updated_at
		FROM approval_requests
		WHERE id = $1
		LIMIT 1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.ProjectID, &item.ProjectName, &item.BillableHours, &item.RequestedByEmail,
		&item.Note, &item.Status, &item.ApprovalMode, &approverEmailsRaw, &item.CurrentStep, &item.RequiredApprovals, &approvalsRaw, &responseToken, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return "Approval request not found", http.StatusNotFound
	}
	if item.Status != "pending" {
		return "This approval request is already closed.", http.StatusOK
	}
	if strings.TrimSpace(responseToken) == "" || token != responseToken {
		return "Invalid or expired approval link.", http.StatusUnauthorized
	}
	item.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
	item.Approvals = parseStringArrayJSON(approvalsRaw)
	if len(item.ApproverEmails) == 0 || item.CurrentStep < 0 || item.CurrentStep >= len(item.ApproverEmails) {
		return "Approval routing is not configured correctly.", http.StatusBadRequest
	}
	currentApprover := item.ApproverEmails[item.CurrentStep]

	if action == "reject" {
		if _, err := s.DB.Exec(ctx, `
			UPDATE approval_requests
			SET status = 'rejected', response_token = '', updated_at = NOW()
			WHERE id = $1
		`, item.ID); err != nil {
			return "Failed to update approval state.", http.StatusInternalServerError
		}
		_ = s.createInAppNotification(ctx, item.TenantID, []string{item.RequestedByEmail}, "approval", "Approval rejected", "A mail approver rejected your request.", map[string]any{"approval_id": item.ID, "project": item.ProjectName})
		return "Rejected successfully. You can close this page.", http.StatusOK
	}

	already := false
	for _, v := range item.Approvals {
		if strings.EqualFold(strings.TrimSpace(v), currentApprover) {
			already = true
			break
		}
	}
	if !already {
		item.Approvals = append(item.Approvals, currentApprover)
	}
	approvalsJSON, _ := json.Marshal(item.Approvals)
	nextStep := item.CurrentStep + 1
	if nextStep >= len(item.ApproverEmails) {
		if _, err := s.DB.Exec(ctx, `
			UPDATE approval_requests
			SET status = 'approved', approvals = $1::jsonb, response_token = '', updated_at = NOW()
			WHERE id = $2
		`, string(approvalsJSON), item.ID); err != nil {
			return "Failed to finalize approval.", http.StatusInternalServerError
		}
		_ = s.createInAppNotification(ctx, item.TenantID, []string{item.RequestedByEmail}, "approval", "Approval completed", "Your request has been approved via email pipeline.", map[string]any{"approval_id": item.ID, "project": item.ProjectName})
		return "Approved successfully. Workflow completed.", http.StatusOK
	}

	nextToken, err := generateApprovalToken()
	if err != nil {
		return "Failed to continue approval workflow.", http.StatusInternalServerError
	}
	if _, err := s.DB.Exec(ctx, `
		UPDATE approval_requests
		SET approvals = $1::jsonb, current_step = $2, response_token = $3, updated_at = NOW()
		WHERE id = $4
	`, string(approvalsJSON), nextStep, nextToken, item.ID); err != nil {
		return "Failed to continue approval workflow.", http.StatusInternalServerError
	}
	item.CurrentStep = nextStep
	item.Approvals = parseStringArrayJSON(approvalsJSON)
	item.UpdatedAt = time.Now().UTC()
	s.sendApprovalStepEmail(ctx, item, nextToken)
	_ = s.createInAppNotification(ctx, item.TenantID, []string{item.RequestedByEmail}, "approval", "Approval progressed", "One approver approved. Workflow moved to next approver by email.", map[string]any{"approval_id": item.ID, "project": item.ProjectName, "step": nextStep + 1})
	return "Approved and forwarded to next approver.", http.StatusOK
}

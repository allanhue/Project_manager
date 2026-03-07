package routes

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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

func (s *Service) ApprovalRespondViaMail(c *gin.Context) {
	idRaw := strings.TrimSpace(c.Query("id"))
	if c.Request.Method == http.MethodPost {
		idRaw = strings.TrimSpace(c.PostForm("id"))
	}
	id, err := strconv.ParseInt(idRaw, 10, 64)
	if err != nil || id <= 0 {
		c.String(http.StatusBadRequest, "Invalid approval id")
		return
	}

	token := strings.TrimSpace(c.Query("token"))
	action := strings.ToLower(strings.TrimSpace(c.Query("action")))
	if c.Request.Method == http.MethodPost {
		token = strings.TrimSpace(c.PostForm("token"))
		action = strings.ToLower(strings.TrimSpace(c.PostForm("action")))
	}
	if token == "" {
		c.String(http.StatusBadRequest, "Invalid approval response link")
		return
	}

	if action == "" {
		item, statusCode, err := s.loadApprovalForToken(c.Request.Context(), id, token)
		if err != nil {
			c.Data(statusCode, "text/html; charset=utf-8", []byte(renderApprovalLandingHTML("Approval link is invalid or expired.", nil, id, token)))
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(renderApprovalLandingHTML("", &item, id, token)))
		return
	}
	if action != "approve" && action != "reject" {
		c.String(http.StatusBadRequest, "Invalid approval action")
		return
	}
	msg, statusCode := s.handleEmailApprovalDecision(c.Request.Context(), id, token, action)
	c.Data(statusCode, "text/html; charset=utf-8", []byte(renderApprovalResultHTML(msg, statusCode)))
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
	if err := s.sendApprovalStepEmail(ctx, item); err != nil {
		return "Approved but failed to notify next approver by email: " + err.Error(), http.StatusBadGateway
	}
	_ = s.createInAppNotification(ctx, item.TenantID, []string{item.RequestedByEmail}, "approval", "Approval progressed", "One approver approved. Workflow moved to next approver by email.", map[string]any{"approval_id": item.ID, "project": item.ProjectName, "step": nextStep + 1})
	return "Approved and forwarded to next approver.", http.StatusOK
}

func (s *Service) loadApprovalForToken(ctx context.Context, id int64, token string) (approvalRequestItem, int, error) {
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
		return approvalRequestItem{}, http.StatusNotFound, err
	}
	if strings.TrimSpace(responseToken) == "" || token != responseToken {
		return approvalRequestItem{}, http.StatusUnauthorized, fmt.Errorf("invalid token")
	}
	item.ApproverEmails = parseStringArrayJSON(approverEmailsRaw)
	item.Approvals = parseStringArrayJSON(approvalsRaw)
	return item, http.StatusOK, nil
}

func renderApprovalLandingHTML(errorMsg string, item *approvalRequestItem, id int64, token string) string {
	if errorMsg != "" {
		return fmt.Sprintf(`<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px"><h2 style="margin-top:0;color:#b91c1c">Approval Link Error</h2><p style="color:#475569">%s</p></div></body></html>`, errorMsg)
	}
	if item == nil {
		return `<html><body>Invalid request.</body></html>`
	}
	return fmt.Sprintf(`
<html>
  <body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px">
      <h2 style="margin:0 0 8px">Approval Review</h2>
      <p style="margin:0 0 14px;color:#475569">Review request details, then choose Approve or Reject.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;line-height:1.7">
        <div><b>Tenant:</b> %s</div>
        <div><b>Project:</b> %s</div>
        <div><b>Billable Hours:</b> %.2f</div>
        <div><b>Requested By:</b> %s</div>
        <div><b>Pipeline:</b> %s</div>
        <div><b>Step:</b> %d of %d</div>
        <div><b>Note:</b> %s</div>
      </div>
      <form method="POST" action="/api/v1/approvals/respond" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <input type="hidden" name="id" value="%d"/>
        <input type="hidden" name="token" value="%s"/>
        <button name="action" value="approve" style="border:0;border-radius:8px;background:#059669;color:#fff;padding:10px 14px;font-weight:600;cursor:pointer">Approve</button>
        <button name="action" value="reject" style="border:0;border-radius:8px;background:#dc2626;color:#fff;padding:10px 14px;font-weight:600;cursor:pointer">Reject</button>
      </form>
      <p style="margin-top:12px;font-size:12px;color:#64748b">This token is single-use per approval step.</p>
    </div>
  </body>
</html>`,
		item.TenantID,
		item.ProjectName,
		item.BillableHours,
		item.RequestedByEmail,
		strings.ReplaceAll(item.ApprovalMode, "_", " "),
		item.CurrentStep+1,
		item.RequiredApprovals,
		item.Note,
		id,
		token,
	)
}

func renderApprovalResultHTML(message string, statusCode int) string {
	color := "#0f172a"
	if statusCode >= 400 {
		color = "#b91c1c"
	}
	return fmt.Sprintf(`<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px"><h2 style="margin-top:0;color:%s">Approval Response</h2><p style="color:#475569">%s</p><p style="font-size:12px;color:#64748b">You can close this window.</p></div></body></html>`, color, message)
}

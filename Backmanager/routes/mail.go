package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type mailRequest struct {
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

type supportRequest struct {
	Subject  string `json:"subject" binding:"required"`
	Message  string `json:"message" binding:"required"`
	Priority string `json:"priority"`
}

func (s *Service) TestNotification(c *gin.Context) {
	var req mailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	to := strings.TrimSpace(req.Email)
	if to == "" {
		to = emailFromContext(c)
	}
	if to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing recipient email"})
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "PulseForge notification"
	}
	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		msg = "This is a test notification from PulseForge backend."
	}

	if err := s.sendMail(context.Background(), to, subject, msg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

func (s *Service) SupportRequest(c *gin.Context) {
	var req supportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	requester := strings.TrimSpace(emailFromContext(c))
	tenant := strings.TrimSpace(tenantFromContext(c))
	if requester == "" || tenant == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user context"})
		return
	}

	to := strings.TrimSpace(os.Getenv("SUPPORT_MAIL_TO"))
	if to == "" {
		to = strings.TrimSpace(os.Getenv("MAIL_FROM"))
	}
	if to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SUPPORT_MAIL_TO (or MAIL_FROM) not configured"})
		return
	}

	priority := strings.TrimSpace(req.Priority)
	if priority == "" {
		priority = "normal"
	}
	subject := fmt.Sprintf("[Support][%s][%s] %s", tenant, priority, strings.TrimSpace(req.Subject))
	message := fmt.Sprintf(
		"Requester: %s\nTenant: %s\nPriority: %s\n\n%s",
		requester,
		tenant,
		priority,
		strings.TrimSpace(req.Message),
	)

	if err := s.sendMail(context.Background(), to, subject, message); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

func (s *Service) sendAsyncNotification(to, subject, message string) {
	if strings.TrimSpace(to) == "" {
		return
	}
	go func() {
		_ = s.sendMail(context.Background(), to, subject, message)
	}()
}

func (s *Service) sendMail(ctx context.Context, to, subject, message string) error {
	apiKey := strings.TrimSpace(os.Getenv("BREVO_API_KEY"))
	if apiKey == "" {
		return errors.New("BREVO_API_KEY not configured")
	}

	fromEmail := strings.TrimSpace(os.Getenv("MAIL_FROM"))
	if fromEmail == "" {
		return errors.New("MAIL_FROM not configured")
	}
	fromName := strings.TrimSpace(os.Getenv("MAIL_FROM_NAME"))
	if fromName == "" {
		fromName = "PulseForge"
	}

	body := map[string]any{
		"sender": map[string]string{
			"name":  fromName,
			"email": fromEmail,
		},
		"to": []map[string]string{
			{"email": to},
		},
		"subject":     subject,
		"htmlContent": renderMailHTML(subject, message),
		"textContent": message,
	}
	raw, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.brevo.com/v3/smtp/email", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("content-type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("mail provider error: status %d", resp.StatusCode)
	}
	return nil
}

func renderMailHTML(subject, message string) string {
	kind, icon, accent := mailTheme(subject)
	safeSubject := html.EscapeString(subject)
	safeMessage := strings.ReplaceAll(html.EscapeString(message), "\n", "<br/>")

	return fmt.Sprintf(`
<html>
  <body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px;background:%s;color:#ffffff;">
                <div style="display:flex;align-items:center;gap:10px;font-weight:600;">
                  <span style="display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;background:rgba(255,255,255,0.18);border-radius:8px;">%s</span>
                  <span>PulseForge %s</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 20px;">
                <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;">%s</h2>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">%s</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
                This is an automated PulseForge message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, accent, icon, kind, safeSubject, safeMessage)
}

func mailTheme(subject string) (kind, icon, accent string) {
	s := strings.ToLower(strings.TrimSpace(subject))
	switch {
	case strings.Contains(s, "welcome"):
		return "Welcome", "👋", "#0ea5e9"
	case strings.Contains(s, "support"):
		return "Support", "🛟", "#334155"
	case strings.Contains(s, "notification"):
		return "Notification", "🔔", "#4f46e5"
	default:
		return "Update", "✉️", "#1f2937"
	}
}

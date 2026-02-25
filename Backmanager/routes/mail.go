package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		"htmlContent": fmt.Sprintf("<html><body><p>%s</p></body></html>", message),
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

package routes

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type sessionItem struct {
	UserID      string     `json:"user_id"`
	Name        string     `json:"name"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	Blocked     bool       `json:"blocked"`
	DeviceLabel string     `json:"device_label"`
	IP          string     `json:"ip"`
}

type sessionActionRequest struct {
	Action string `json:"action"`
}

func (s *Service) ListSessions(c *gin.Context) {
	role := strings.TrimSpace(roleFromContext(c))
	if role != "org_admin" && role != "system_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}
	tenantSlug := strings.TrimSpace(tenantFromContext(c))
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT
			COALESCE(u.public_id, ''),
			u.name,
			lower(u.email),
			COALESCE(u.role, 'org_admin'),
			u.last_login_at,
			COALESCE(u.blocked, false),
			COALESCE(u.last_login_user_agent, ''),
			COALESCE(u.last_login_ip, '')
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1
		  AND u.last_login_at IS NOT NULL
		  AND u.last_login_at >= NOW() - INTERVAL '24 hours'
		ORDER BY u.last_login_at DESC NULLS LAST, u.created_at DESC
	`, tenantSlug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]sessionItem, 0)
	for rows.Next() {
		var item sessionItem
		var userAgent string
		if err := rows.Scan(&item.UserID, &item.Name, &item.Email, &item.Role, &item.LastLoginAt, &item.Blocked, &userAgent, &item.IP); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		item.DeviceLabel = deriveDeviceLabel(userAgent)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func deriveDeviceLabel(ua string) string {
	value := strings.ToLower(strings.TrimSpace(ua))
	if value == "" {
		return "Unknown device"
	}
	os := "Unknown OS"
	switch {
	case strings.Contains(value, "windows"):
		os = "Windows"
	case strings.Contains(value, "android"):
		os = "Android"
	case strings.Contains(value, "iphone"), strings.Contains(value, "ipad"), strings.Contains(value, "ios"):
		os = "iOS"
	case strings.Contains(value, "mac os"), strings.Contains(value, "macintosh"):
		os = "macOS"
	case strings.Contains(value, "linux"):
		os = "Linux"
	}
	device := "Desktop"
	if strings.Contains(value, "mobile") || strings.Contains(value, "iphone") || strings.Contains(value, "android") {
		device = "Mobile"
	}
	browser := "Browser"
	switch {
	case strings.Contains(value, "edg/"):
		browser = "Edge"
	case strings.Contains(value, "chrome/"):
		browser = "Chrome"
	case strings.Contains(value, "firefox/"):
		browser = "Firefox"
	case strings.Contains(value, "safari/") && !strings.Contains(value, "chrome/"):
		browser = "Safari"
	}
	return os + " | " + device + " | " + browser
}

func (s *Service) SessionAction(c *gin.Context) {
	role := strings.TrimSpace(roleFromContext(c))
	if role != "org_admin" && role != "system_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}
	tenantSlug := strings.TrimSpace(tenantFromContext(c))
	currentEmail := strings.ToLower(strings.TrimSpace(emailFromContext(c)))
	userID := strings.TrimSpace(c.Param("id"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req sessionActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "terminate" && action != "block" && action != "unblock" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "action must be terminate, block or unblock"})
		return
	}

	var tenantID int64
	var targetEmail string
	if err := s.DB.QueryRow(c.Request.Context(), `
		SELECT t.id, lower(u.email)
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE t.slug = $1 AND u.public_id = $2
		LIMIT 1
	`, tenantSlug, userID).Scan(&tenantID, &targetEmail); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if action == "block" && targetEmail == currentEmail {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot block your own account"})
		return
	}

	switch action {
	case "terminate":
		if _, err := s.DB.Exec(c.Request.Context(), `UPDATE users SET last_login_at = NULL WHERE public_id = $1 AND tenant_id = $2`, userID, tenantID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to terminate session"})
			return
		}
	case "block":
		if _, err := s.DB.Exec(c.Request.Context(), `UPDATE users SET blocked = true, last_login_at = NULL WHERE public_id = $1 AND tenant_id = $2`, userID, tenantID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to block user"})
			return
		}
	case "unblock":
		if _, err := s.DB.Exec(c.Request.Context(), `UPDATE users SET blocked = false WHERE public_id = $1 AND tenant_id = $2`, userID, tenantID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unblock user"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

package routes

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type systemUpdate struct {
	ID            int64     `json:"id"`
	ScheduledDate string    `json:"scheduled_date"`
	Title         string    `json:"title"`
	FeatureBrief  string    `json:"feature_brief"`
	Expectations  string    `json:"expectations"`
	CreatedBy     string    `json:"created_by_email"`
	CreatedAt     time.Time `json:"created_at"`
}

type createSystemUpdateRequest struct {
	ScheduledDate string `json:"scheduled_date" binding:"required"`
	Title         string `json:"title" binding:"required"`
	FeatureBrief  string `json:"feature_brief" binding:"required"`
	Expectations  string `json:"expectations" binding:"required"`
}

type updateSystemUpdateRequest struct {
	ScheduledDate string `json:"scheduled_date" binding:"required"`
	Title         string `json:"title" binding:"required"`
	FeatureBrief  string `json:"feature_brief" binding:"required"`
	Expectations  string `json:"expectations" binding:"required"`
}

func (s *Service) SystemUpdates(c *gin.Context) {
	rows, err := s.DB.Query(c.Request.Context(), `
		SELECT id, scheduled_date, title, feature_brief, expectations, created_by_email, created_at
		FROM system_updates
		ORDER BY scheduled_date ASC, id DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	items := make([]systemUpdate, 0)
	for rows.Next() {
		var item systemUpdate
		var scheduledDate time.Time
		if err := rows.Scan(&item.ID, &scheduledDate, &item.Title, &item.FeatureBrief, &item.Expectations, &item.CreatedBy, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		item.ScheduledDate = scheduledDate.Format("2006-01-02")
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Service) CreateSystemUpdate(c *gin.Context) {
	var req createSystemUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	scheduledDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.ScheduledDate))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_date must be YYYY-MM-DD"})
		return
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if !scheduledDate.After(today) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_date must be after today"})
		return
	}

	creator := strings.TrimSpace(emailFromContext(c))
	if creator == "" {
		creator = "system-admin"
	}
	title := strings.TrimSpace(req.Title)
	brief := strings.TrimSpace(req.FeatureBrief)
	expectations := strings.TrimSpace(req.Expectations)

	var item systemUpdate
	var dateFromDB time.Time
	err = s.DB.QueryRow(c.Request.Context(), `
		INSERT INTO system_updates (scheduled_date, title, feature_brief, expectations, created_by_email)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, scheduled_date, title, feature_brief, expectations, created_by_email, created_at
	`, scheduledDate, title, brief, expectations, creator).
		Scan(&item.ID, &dateFromDB, &item.Title, &item.FeatureBrief, &item.Expectations, &item.CreatedBy, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create system update"})
		return
	}
	item.ScheduledDate = dateFromDB.Format("2006-01-02")

	recipients, err := s.fetchOrgAdminEmails(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tenant recipients"})
		return
	}
	subject := "[PulseForge] Platform update scheduled: " + item.Title
	message := "Hello,\n\nA new platform update has been scheduled.\n\n" +
		"Date: " + item.ScheduledDate + "\n" +
		"Feature: " + item.Title + "\n\n" +
		"Brief:\n" + item.FeatureBrief + "\n\n" +
		"Expectation:\n" + item.Expectations + "\n\n" +
		"Please prepare your organization accordingly."

	sent := 0
	failed := 0
	for _, to := range recipients {
		if err := s.sendMail(context.Background(), to, subject, message); err != nil {
			failed++
			continue
		}
		sent++
	}

	c.JSON(http.StatusCreated, gin.H{
		"item":        item,
		"recipients":  len(recipients),
		"sent":        sent,
		"failed":      failed,
		"mail_status": "broadcast completed",
	})
}

func (s *Service) UpdateSystemUpdate(c *gin.Context) {
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid update id"})
		return
	}

	var req updateSystemUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	scheduledDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.ScheduledDate))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_date must be YYYY-MM-DD"})
		return
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if !scheduledDate.After(today) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_date must be after today"})
		return
	}

	var item systemUpdate
	var dateFromDB time.Time
	err = s.DB.QueryRow(c.Request.Context(), `
		UPDATE system_updates
		SET scheduled_date = $1, title = $2, feature_brief = $3, expectations = $4
		WHERE id = $5
		RETURNING id, scheduled_date, title, feature_brief, expectations, created_by_email, created_at
	`, scheduledDate, strings.TrimSpace(req.Title), strings.TrimSpace(req.FeatureBrief), strings.TrimSpace(req.Expectations), id).
		Scan(&item.ID, &dateFromDB, &item.Title, &item.FeatureBrief, &item.Expectations, &item.CreatedBy, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "system update not found"})
		return
	}
	item.ScheduledDate = dateFromDB.Format("2006-01-02")

	recipients, err := s.fetchOrgAdminEmails(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tenant recipients"})
		return
	}
	subject := "[PulseForge] Platform update revised: " + item.Title
	message := "Hello,\n\nA scheduled platform update has been revised.\n\n" +
		"Date: " + item.ScheduledDate + "\n" +
		"Feature: " + item.Title + "\n\n" +
		"Brief:\n" + item.FeatureBrief + "\n\n" +
		"Expectation:\n" + item.Expectations + "\n\n" +
		"Please align your organization plans accordingly."

	sent := 0
	failed := 0
	for _, to := range recipients {
		if err := s.sendMail(context.Background(), to, subject, message); err != nil {
			failed++
			continue
		}
		sent++
	}

	c.JSON(http.StatusOK, gin.H{
		"item":        item,
		"recipients":  len(recipients),
		"sent":        sent,
		"failed":      failed,
		"mail_status": "update broadcast completed",
	})
}

func (s *Service) fetchOrgAdminEmails(ctx context.Context) ([]string, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT DISTINCT lower(trim(email))
		FROM users
		WHERE role = 'org_admin'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return nil, err
		}
		email = strings.TrimSpace(email)
		if email != "" {
			items = append(items, email)
		}
	}
	return items, nil
}

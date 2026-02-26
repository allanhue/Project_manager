package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"backmanager/routes"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := connectDB(ctx)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "change-me-in-env"
	}
	jwtIssuer := os.Getenv("JWT_ISSUER")
	if jwtIssuer == "" {
		jwtIssuer = "backmanager"
	}
	jwtTTLHours := getEnvInt("JWT_TTL_HOURS", 24)
	systemAdmins := splitCSV(os.Getenv("SYSTEM_ADMIN_EMAILS"))

	svc := routes.NewService(db, []byte(jwtSecret), jwtIssuer, time.Duration(jwtTTLHours)*time.Hour, systemAdmins)

	if err := svc.EnsureBaseTables(context.Background()); err != nil {
		log.Fatalf("schema init failed: %v", err)
	}
	if err := svc.EnsureTasksTable(); err != nil {
		log.Fatalf("tasks schema init failed: %v", err)
	}
	if err := svc.EnsureSystemAdminRoles(context.Background()); err != nil {
		log.Fatalf("system-admin role sync failed: %v", err)
	}

	r := gin.Default()
	r.Use(corsConfigFromEnv())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", svc.Register)
		auth.POST("/login", svc.Login)
		auth.POST("/forgot-password", svc.ForgotPassword)
	}

	api := r.Group("/api/v1")
	api.Use(routes.AuthMiddleware(svc.JWTSecret, svc.JWTIssuer), svc.AuditLogMiddleware())
	{
		api.GET("/projects", svc.ListProjects)
		api.POST("/projects", svc.CreateProject)
		api.GET("/tasks", svc.ListTasks)
		api.POST("/tasks", svc.CreateTask)
		api.POST("/notifications/test", svc.TestNotification)
		api.POST("/support/request", svc.SupportRequest)
	}

	system := api.Group("/system")
	system.Use(routes.RequireSystemAdmin())
	{
		system.GET("/organizations", svc.SystemOrganizations)
		system.GET("/analytics", svc.SystemAnalytics)
		system.GET("/logs", svc.SystemLogs)
		system.GET("/tenants", svc.SystemTenants)
		system.POST("/tenants", svc.CreateTenant)
		system.PUT("/tenants/:id", svc.UpdateTenant)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("server listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func corsConfigFromEnv() gin.HandlerFunc {
	origins := splitCSV(os.Getenv("CORS_ALLOW_ORIGINS"))
	if len(origins) == 0 {
		origins = []string{"http://localhost:3000"}
	}
	methods := splitCSV(os.Getenv("CORS_ALLOW_METHODS"))
	if len(methods) == 0 {
		methods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	}
	headers := splitCSV(os.Getenv("CORS_ALLOW_HEADERS"))
	if len(headers) == 0 {
		headers = []string{"Origin", "Content-Type", "Authorization"}
	}

	cfg := cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     methods,
		AllowHeaders:     headers,
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	return cors.New(cfg)
}

func splitCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

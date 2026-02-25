package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	DB        *pgxpool.Pool
	JWTSecret []byte
	JWTIssuer string
	JWTTTL    time.Duration
}

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

	app := &App{
		DB:        db,
		JWTSecret: []byte(jwtSecret),
		JWTIssuer: jwtIssuer,
		JWTTTL:    time.Duration(jwtTTLHours) * time.Hour,
	}

	if err := app.ensureBaseTables(context.Background()); err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", app.Register)
		auth.POST("/login", app.Login)
	}

	api := r.Group("/api/v1")
	api.Use(AuthMiddleware(app.JWTSecret, app.JWTIssuer))
	{
		api.GET("/projects", app.ListProjects)
		api.POST("/projects", app.CreateProject)
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

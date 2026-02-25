package routes

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	DB        *pgxpool.Pool
	JWTSecret []byte
	JWTIssuer string
	JWTTTL    time.Duration
}

func NewService(db *pgxpool.Pool, jwtSecret []byte, jwtIssuer string, jwtTTL time.Duration) *Service {
	return &Service{
		DB:        db,
		JWTSecret: jwtSecret,
		JWTIssuer: jwtIssuer,
		JWTTTL:    jwtTTL,
	}
}

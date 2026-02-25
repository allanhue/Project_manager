package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// connectDB creates a pooled PostgreSQL connection for Neon.
func connectDB(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DB_URL")
	}
	if dsn == "" {
		dsn = os.Getenv("PSQL_URL")
	}
	if dsn == "" {
		dsn = os.Getenv("psql")
	}
	if dsn == "" {
		return nil, errors.New("missing database url: set DATABASE_URL (or DB_URL/psql)")
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}

	cfg.MaxConns = int32(getEnvInt("DB_MAX_CONNS", 15))
	cfg.MinConns = int32(getEnvInt("DB_MIN_CONNS", 2))
	cfg.MaxConnIdleTime = time.Duration(getEnvInt("DB_MAX_CONN_IDLE_MIN", 15)) * time.Minute
	cfg.MaxConnLifetime = time.Duration(getEnvInt("DB_MAX_CONN_LIFE_MIN", 60)) * time.Minute

	return pgxpool.NewWithConfig(ctx, cfg)
}

func getEnvInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}

	var n int
	_, err := fmt.Sscanf(v, "%d", &n)
	if err != nil {
		return def
	}
	return n
}


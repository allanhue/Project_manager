package routes

import (
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	DB                *pgxpool.Pool
	JWTSecret         []byte
	JWTIssuer         string
	JWTTTL            time.Duration
	SystemAdminEmails map[string]struct{}
}

func NewService(db *pgxpool.Pool, jwtSecret []byte, jwtIssuer string, jwtTTL time.Duration, systemAdminEmails []string) *Service {
	systemAdmins := make(map[string]struct{}, len(systemAdminEmails))
	for _, email := range systemAdminEmails {
		e := strings.ToLower(strings.TrimSpace(email))
		if e != "" {
			systemAdmins[e] = struct{}{}
		}
	}

	return &Service{
		DB:                db,
		JWTSecret:         jwtSecret,
		JWTIssuer:         jwtIssuer,
		JWTTTL:            jwtTTL,
		SystemAdminEmails: systemAdmins,
	}
}

func (s *Service) roleForEmail(email string) string {
	_, ok := s.SystemAdminEmails[strings.ToLower(strings.TrimSpace(email))]
	if ok {
		return "system_admin"
	}
	return "org_admin"
}

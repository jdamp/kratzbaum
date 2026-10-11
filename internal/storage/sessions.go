package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

type Session struct {
	Hash        string
	Identity    string
	Issuer      string
	Subject     string
	DisplayName string
	CSRF        string
	ExpiresAt   time.Time
}

func HashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}
func (s *Store) SaveSession(ctx context.Context, session Session) error {
	_, err := s.db.ExecContext(ctx, s.query(`INSERT INTO oidc_sessions(session_hash,identity,issuer,subject,display_name,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_hash) DO UPDATE SET expires_at=excluded.expires_at`), session.Hash, session.Identity, session.Issuer, session.Subject, session.DisplayName, session.CSRF, instant(session.ExpiresAt), instant(time.Now()))
	return err
}
func (s *Store) GetSession(ctx context.Context, hash string) (Session, error) {
	var v Session
	var expiry dbTime
	err := s.db.QueryRowContext(ctx, s.query(`SELECT session_hash,identity,issuer,subject,display_name,csrf_token,expires_at FROM oidc_sessions WHERE session_hash=?`), hash).Scan(&v.Hash, &v.Identity, &v.Issuer, &v.Subject, &v.DisplayName, &v.CSRF, &expiry)
	v.ExpiresAt = expiry.Time
	return v, err
}
func (s *Store) DeleteSession(ctx context.Context, hash string) error {
	_, err := s.db.ExecContext(ctx, s.query(`DELETE FROM oidc_sessions WHERE session_hash=?`), hash)
	return err
}

type IdentificationAttempt struct {
	ID, Key, Status, ErrorCode string
	Candidates                 json.RawMessage
	CreatedAt                  time.Time
}

func (s *Store) BeginIdentification(ctx context.Context, key string) (IdentificationAttempt, bool, error) {
	now := instant(time.Now())
	id := newID()
	_, err := s.db.ExecContext(ctx, s.query(`INSERT INTO identification_attempts(id,attempt_key,status,candidates_json,error_code,created_at,updated_at) VALUES(?,?,'pending','[]','',?,?) ON CONFLICT(attempt_key) DO NOTHING`), id, key, now, now)
	if err != nil {
		return IdentificationAttempt{}, false, err
	}
	a, err := s.GetIdentification(ctx, key)
	if err != nil {
		return a, false, err
	}
	return a, a.ID == id, nil
}
func (s *Store) GetIdentification(ctx context.Context, key string) (IdentificationAttempt, error) {
	var a IdentificationAttempt
	var created dbTime
	var candidates string
	err := s.db.QueryRowContext(ctx, s.query(`SELECT id,attempt_key,status,candidates_json,error_code,created_at FROM identification_attempts WHERE attempt_key=?`), key).Scan(&a.ID, &a.Key, &a.Status, &candidates, &a.ErrorCode, &created)
	a.Candidates = json.RawMessage(candidates)
	a.CreatedAt = created.Time
	return a, err
}
func (s *Store) CompleteIdentification(ctx context.Context, key, status, code string, candidates []byte) error {
	_, err := s.db.ExecContext(ctx, s.query(`UPDATE identification_attempts SET status=?,error_code=?,candidates_json=?,updated_at=? WHERE attempt_key=? AND status='pending'`), status, code, string(candidates), instant(time.Now()), key)
	return err
}

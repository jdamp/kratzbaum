package storage

import (
	"context"
	"crypto/rand"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/kratzbaum/kratzbaum/internal/config"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Store struct {
	db       *sql.DB
	dialect  string
	timezone *time.Location
	mediaDir string
}

func Open(ctx context.Context, cfg config.Config, timezone *time.Location) (*Store, error) {
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	if err := os.MkdirAll(cfg.MediaDir, 0o750); err != nil {
		return nil, fmt.Errorf("create media directory: %w", err)
	}
	var dialect, driver, dsn string
	if cfg.DatabaseDriver == "sqlite" {
		dialect, driver, dsn = "sqlite", "sqlite", sqliteDSN(cfg.DatabaseURL)
	} else {
		dialect, dsn = "postgres", cfg.DatabaseURL
		driver = "pgx"
	}
	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open %s database: %w", dialect, err)
	}
	if dialect == "sqlite" {
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
		db.SetConnMaxIdleTime(0)
	} else {
		db.SetMaxOpenConns(12)
		db.SetMaxIdleConns(4)
		db.SetConnMaxIdleTime(5 * time.Minute)
	}
	store := &Store{db: db, dialect: dialect, timezone: timezone, mediaDir: cfg.MediaDir}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("connect to configured %s database: %w", dialect, err)
	}
	if dialect == "sqlite" {
		if _, err := db.ExecContext(ctx, "PRAGMA foreign_keys=ON"); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("enable SQLite foreign keys: %w", err)
		}
		if _, err := db.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
			slog.Warn("SQLite WAL mode unavailable", "error", err)
		}
		if _, err := db.ExecContext(ctx, "PRAGMA busy_timeout=5000"); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("configure SQLite busy timeout: %w", err)
		}
	}
	if err := store.Migrate(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func sqliteDSN(databaseURL string) string {
	if strings.HasPrefix(databaseURL, "file:") || databaseURL == ":memory:" {
		return databaseURL
	}
	absolute, err := filepath.Abs(databaseURL)
	if err != nil {
		return databaseURL
	}
	return "file:" + filepath.ToSlash(absolute)
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Migrate(ctx context.Context) error {
	ledger := `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
	if s.dialect == "postgres" {
		ledger = `CREATE TABLE IF NOT EXISTS schema_migrations (version BIGINT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)`
	}
	if _, err := s.db.ExecContext(ctx, ledger); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}
	name := "migrations/000001_init." + s.dialect + ".sql"
	script, err := fs.ReadFile(migrations, name)
	if err != nil {
		return fmt.Errorf("read %s migration: %w", s.dialect, err)
	}
	var version int
	err = s.db.QueryRowContext(ctx, "SELECT version FROM schema_migrations WHERE version = 1").Scan(&version)
	switch {
	case err == nil:
		return nil
	case !errors.Is(err, sql.ErrNoRows):
		return fmt.Errorf("check database migration version: %w", err)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin schema migration: %w", err)
	}
	for _, statement := range strings.Split(string(script), ";") {
		statement = strings.TrimSpace(statement)
		if statement == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply database migration 1: %w", err)
		}
	}
	appliedAt := any(instant(time.Now()).Format(time.RFC3339Nano))
	if s.dialect == "postgres" {
		appliedAt = instant(time.Now())
	}
	if _, err := tx.ExecContext(ctx, s.query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"), 1, appliedAt); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("record applied migration: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit database migration: %w", err)
	}
	return nil
}

var placeholders = regexp.MustCompile(`\?`)

func (s *Store) bind(index int) string {
	if s.dialect == "postgres" {
		return fmt.Sprintf("$%d", index)
	}
	return "?"
}

func (s *Store) query(sqlText string) string {
	if s.dialect == "sqlite" {
		return sqlText
	}
	index := 0
	return placeholders.ReplaceAllStringFunc(sqlText, func(string) string {
		index++
		return s.bind(index)
	})
}

func instant(t time.Time) time.Time { return t.UTC().Truncate(time.Microsecond) }

func newID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic("cryptographic random source unavailable: " + err.Error())
	}
	value[6] = value[6]&0x0f | 0x40
	value[8] = value[8]&0x3f | 0x80
	encoded := hex.EncodeToString(value)
	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32]
}

func NewID() string { return newID() }

func cleanFilename(name string) string {
	name = filepath.Base(name)
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f || r == '/' || r == '\\' {
			return -1
		}
		return r
	}, name)
	if len(name) > 160 {
		name = name[len(name)-160:]
	}
	if name == "" || name == "." {
		return "plant-photo.jpg"
	}
	return name
}

func displayMediaURL(id string) string { return "/media/" + url.PathEscape(id) + "/thumb.jpg" }

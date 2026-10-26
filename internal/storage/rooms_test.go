package storage

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/config"
)

func runMigrationUpgradeContract(t *testing.T, cfg config.Config) {
	t.Helper()
	ctx := context.Background()
	if err := os.MkdirAll(cfg.DataDir, 0750); err != nil {
		t.Fatal(err)
	}
	driver, dsn := "pgx", cfg.DatabaseURL
	if cfg.DatabaseDriver == "sqlite" {
		driver, dsn = "sqlite", sqliteDSN(dsn)
	}
	db, err := sql.Open(driver, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if cfg.DatabaseDriver == "sqlite" {
		if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
			t.Fatal(err)
		}
	}
	s := &Store{db: db, dialect: cfg.DatabaseDriver, timezone: time.UTC}
	name := "migrations/000001_init." + s.dialect + ".sql"
	script, err := fs.ReadFile(migrations, name)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.migrate(ctx, fstest.MapFS{name: &fstest.MapFile{Data: script}}); err != nil {
		t.Fatal(err)
	}
	id := NewID()
	now := instant(time.Now())
	if _, err := db.ExecContext(ctx, s.query("INSERT INTO plants(id,name,care_start_date,created_at,updated_at) VALUES(?,?,?,?,?)"), id, "Before upgrade", "2026-06-01", now, now); err != nil {
		t.Fatal(err)
	}
	photo, err := s.SavePhoto(ctx, NewID(), id, "old.jpg", 80, 60, "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	activity, err := s.AddActivity(ctx, Activity{PlantID: id, Type: "watering", OccurredAt: now}, "before-upgrade", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	session := Session{Hash: HashSecret("upgrade-session"), Identity: "test", Issuer: "issuer", Subject: "subject", CSRF: "csrf", ExpiresAt: now.Add(time.Hour)}
	if err := s.SaveSession(ctx, session); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	p, err := s.GetPlant(ctx, id)
	if err != nil || p.RoomID != nil || p.CareStartDate != "2026-06-01" || p.CoverPhotoID != photo.ID {
		t.Fatalf("upgrade changed plant: %#v %v", p, err)
	}
	if activities, err := s.ListActivities(ctx, id); err != nil || len(activities) != 2 || activities[0].ID == "" || activity.ID == "" {
		t.Fatalf("history after upgrade: %#v %v", activities, err)
	}
	if _, err := s.GetSession(ctx, session.Hash); err != nil {
		t.Fatal(err)
	}
	broken := fstest.MapFS{"migrations/3_fail." + s.dialect + ".sql": &fstest.MapFile{Data: []byte("CREATE TABLE migration_probe(id TEXT); INSERT INTO nonexistent_migration_table VALUES (1);")}}
	if err := s.migrate(ctx, broken); err == nil {
		t.Fatal("broken upgrade succeeded")
	}
	var count int
	if err := db.QueryRow("SELECT count(*) FROM schema_migrations WHERE version=3").Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed migration recorded: %d %v", count, err)
	}
	// A successful retry also proves CREATE TABLE from the failed transaction rolled back.
	retry := fstest.MapFS{
		"migrations/3_retry." + s.dialect + ".sql":  &fstest.MapFile{Data: []byte("CREATE TABLE migration_probe(id TEXT);")},
		"migrations/10_after." + s.dialect + ".sql": &fstest.MapFile{Data: []byte("INSERT INTO migration_probe(id) VALUES ('ordered');")},
	}
	if err := s.migrate(ctx, retry); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT count(*) FROM migration_probe").Scan(&count); err != nil || count != 1 {
		t.Fatalf("numeric migration order: %d %v", count, err)
	}
}

func runRoomContract(t *testing.T, store *Store) {
	t.Helper()
	ctx := context.Background()
	room, err := store.SaveRoom(ctx, "", "  Arbeitszimmer  ")
	if err != nil || room.Name != "Arbeitszimmer" {
		t.Fatalf("create room: %#v %v", room, err)
	}
	for _, name := range []string{"", "   ", strings.Repeat("ä", 121)} {
		if _, err := store.SaveRoom(ctx, "", name); !errors.Is(err, ErrRoomName) {
			t.Fatalf("name %q: %v", name, err)
		}
	}
	if _, err := store.SaveRoom(ctx, "", " ARBEITSZIMMER "); !errors.Is(err, ErrRoomDuplicate) {
		t.Fatalf("duplicate: %v", err)
	}
	second, err := store.SaveRoom(ctx, "", "Wohnzimmer")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.SaveRoom(ctx, second.ID, "arbeitszimmer"); !errors.Is(err, ErrRoomDuplicate) {
		t.Fatalf("rename duplicate: %v", err)
	}
	p := Plant{ID: NewID(), Name: "Room fern", WateringIntervalDays: 7, RoomID: &room.ID}
	if err := store.SavePlant(ctx, p); err != nil {
		t.Fatal(err)
	}
	now := instant(time.Now())
	if _, err := store.AddActivity(ctx, Activity{PlantID: p.ID, Type: "watering", OccurredAt: now}, "room-care", "", "", ""); err != nil {
		t.Fatal(err)
	}
	photo, err := store.SavePhoto(ctx, NewID(), p.ID, "room.jpg", 2, 2, "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, membership := range []*string{&second.ID, nil, &room.ID} {
		p.RoomID = membership
		if err := store.SavePlant(ctx, p); err != nil {
			t.Fatal(err)
		}
		got, err := store.GetPlant(ctx, p.ID)
		if err != nil || (got.RoomID == nil) != (membership == nil) || membership != nil && *got.RoomID != *membership {
			t.Fatalf("membership: %#v %v", got, err)
		}
	}
	missing := NewID()
	p.RoomID = &missing
	if err := store.SavePlant(ctx, p); !errors.Is(err, ErrRoomReference) {
		t.Fatalf("foreign key: %v", err)
	}
	if _, err := store.SaveRoom(ctx, room.ID, "Büro"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SaveRoom(ctx, "", "BÜRO"); !errors.Is(err, ErrRoomDuplicate) {
		t.Fatalf("Unicode case: %v", err)
	}
	if err := store.DeleteRoom(ctx, room.ID); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetPlant(ctx, p.ID)
	if err != nil || got.RoomID != nil || got.CoverPhotoID != photo.ID || got.CareStartDate != "" {
		t.Fatalf("room deletion damaged plant: %#v %v", got, err)
	}
	if history, err := store.ListActivities(ctx, p.ID); err != nil || len(history) != 2 {
		t.Fatalf("room deletion damaged history: %v %#v", err, history)
	}
	if _, err := store.SaveRoom(ctx, room.ID, "Missing"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("missing update: %v", err)
	}
	if err := store.DeleteRoom(ctx, room.ID); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("missing delete: %v", err)
	}
	if rooms, err := store.ListRooms(ctx); err != nil || len(rooms) != 1 || rooms[0].ID != second.ID {
		t.Fatalf("list rooms: %#v %v", rooms, err)
	}
	if err := store.DeletePlant(ctx, p.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteRoom(ctx, second.ID); err != nil {
		t.Fatal(err)
	}
}

func TestSQLiteMigrationUpgrade(t *testing.T) {
	dir := t.TempDir()
	runMigrationUpgradeContract(t, config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "upgrade.db"), DataDir: dir})
}

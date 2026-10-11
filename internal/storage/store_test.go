package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/kratzbaum/kratzbaum/internal/care"
	"github.com/kratzbaum/kratzbaum/internal/config"
	_ "modernc.org/sqlite"
)

func TestSQLiteRepositoryContract(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "test.db"), DataDir: dir, MediaDir: filepath.Join(dir, "media")}
	runRepositoryContract(t, cfg)
	t.Run("migration failure prevents opening", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "broken.db")
		db, err := sql.Open("sqlite", sqliteDSN(path))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`CREATE TABLE plants (broken TEXT)`); err != nil {
			t.Fatal(err)
		}
		_ = db.Close()
		bad := cfg
		bad.DatabaseURL = path
		bad.DataDir = t.TempDir()
		bad.MediaDir = filepath.Join(bad.DataDir, "media")
		if store, err := Open(context.Background(), bad, time.UTC); err == nil {
			_ = store.Close()
			t.Fatal("opened database after migration failed")
		}
	})
}

func TestPostgresRepositoryContractAgainstDisposableDatabase(t *testing.T) {
	connection := os.Getenv("KRATZBAUM_TEST_POSTGRES_URL")
	if connection == "" {
		t.Skip("set KRATZBAUM_TEST_POSTGRES_URL to a disposable database ending in _test")
	}
	parsed, err := url.Parse(connection)
	if err != nil {
		t.Fatal("invalid PostgreSQL test URL")
	}
	if !strings.HasSuffix(strings.ToLower(strings.TrimPrefix(parsed.Path, "/")), "_test") {
		t.Fatal("refusing to run PostgreSQL integration test unless database name ends in _test")
	}
	admin, err := sql.Open("pgx", connection)
	if err != nil {
		t.Fatal("open disposable PostgreSQL test database")
	}
	defer admin.Close()

	newSchemaURL := func() string {
		schema := "kratzbaum_test_" + strings.ReplaceAll(NewID(), "-", "")
		if _, err := admin.Exec(`CREATE SCHEMA "` + schema + `"`); err != nil {
			t.Fatalf("create isolated schema: %v", err)
		}
		t.Cleanup(func() { _, _ = admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`) })
		query := parsed.Query()
		query.Set("search_path", schema)
		parsedCopy := *parsed
		parsedCopy.RawQuery = query.Encode()
		return parsedCopy.String()
	}

	t.Run("shared repository contract and repeat startup", func(t *testing.T) {
		dir := t.TempDir()
		cfg := config.Config{DatabaseDriver: "postgres", DatabaseURL: newSchemaURL(), DataDir: dir, MediaDir: filepath.Join(dir, "media")}
		runRepositoryContract(t, cfg)
	})
	t.Run("migration failure prevents opening", func(t *testing.T) {
		dir := t.TempDir()
		databaseURL := newSchemaURL()
		db, err := sql.Open("pgx", databaseURL)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`CREATE TABLE plants (broken TEXT)`); err != nil {
			t.Fatal(err)
		}
		_ = db.Close()
		cfg := config.Config{DatabaseDriver: "postgres", DatabaseURL: databaseURL, DataDir: dir, MediaDir: filepath.Join(dir, "media")}
		if store, err := Open(context.Background(), cfg, time.UTC); err == nil {
			_ = store.Close()
			t.Fatal("opened database after migration failed")
		}
	})
}

func TestPostgresSelectionNeverFallsBackToSQLite(t *testing.T) {
	dir := t.TempDir()
	fallbackPath := filepath.Join(dir, "fallback.db")
	cfg := config.Config{DatabaseDriver: "postgres", DatabaseURL: fallbackPath, DataDir: dir, MediaDir: filepath.Join(dir, "media")}
	if store, err := Open(context.Background(), cfg, time.UTC); err == nil {
		_ = store.Close()
		t.Fatal("invalid PostgreSQL configuration unexpectedly opened")
	}
	if _, err := os.Stat(fallbackPath); !os.IsNotExist(err) {
		t.Fatalf("SQLite fallback file was created: %v", err)
	}
}

func TestSQLiteBackupRestoreKeepsCollectionAndDueState(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "db.sqlite"), DataDir: dir, MediaDir: filepath.Join(dir, "media")}
	plantID, photoID := createBackupFixture(t, cfg)
	restoredDir := filepath.Join(t.TempDir(), "restored")
	if err := copyTree(cfg.DataDir, restoredDir); err != nil {
		t.Fatalf("copy stopped SQLite data directory: %v", err)
	}
	restored := cfg
	restored.DataDir = restoredDir
	restored.DatabaseURL = filepath.Join(restoredDir, "db.sqlite")
	restored.MediaDir = filepath.Join(restoredDir, "media")
	assertBackupFixture(t, restored, plantID, photoID)
}

func TestPostgresBackupRestoreKeepsCollectionAndDueState(t *testing.T) {
	connection := os.Getenv("KRATZBAUM_TEST_POSTGRES_URL")
	if connection == "" {
		t.Skip("set KRATZBAUM_TEST_POSTGRES_URL to a disposable database ending in _test")
	}
	if _, err := exec.LookPath("pg_dump"); err != nil {
		t.Skip("pg_dump and pg_restore are required for the PostgreSQL backup/restore test")
	}
	parsed, err := url.Parse(connection)
	if err != nil || !strings.HasSuffix(strings.ToLower(strings.TrimPrefix(parsed.Path, "/")), "_test") {
		t.Fatal("refusing PostgreSQL backup test unless database name ends in _test")
	}
	schema := "kratzbaum_restore_test_" + strings.ReplaceAll(NewID(), "-", "")
	admin, err := sql.Open("pgx", connection)
	if err != nil {
		t.Fatal("open disposable database for backup fixture")
	}
	if _, err := admin.Exec(`CREATE SCHEMA "` + schema + `"`); err != nil {
		_ = admin.Close()
		t.Fatalf("create isolated backup schema: %v", err)
	}
	defer func() {
		_, _ = admin.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`)
		_ = admin.Close()
	}()
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "postgres", DatabaseURL: parsed.String(), DataDir: dir, MediaDir: filepath.Join(dir, "media")}
	plantID, photoID := createBackupFixture(t, cfg)

	archive := filepath.Join(t.TempDir(), "kratzbaum.dump")
	dump := exec.Command("pg_dump", "--format=custom", "--schema", schema, "--file", archive, "--dbname", connection)
	if output, err := dump.CombinedOutput(); err != nil {
		t.Fatalf("create schema-scoped PostgreSQL backup: %v: %s", err, output)
	}
	if _, err := admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`); err != nil {
		_ = admin.Close()
		t.Fatalf("remove schema before restoring backup: %v", err)
	}
	_ = admin.Close()
	restore := exec.Command("pg_restore", "--no-owner", "--no-privileges", "--dbname", connection, archive)
	if output, err := restore.CombinedOutput(); err != nil {
		t.Fatalf("restore PostgreSQL backup: %v: %s", err, output)
	}
	defer func() {
		admin, err := sql.Open("pgx", connection)
		if err == nil {
			_, _ = admin.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`)
			_ = admin.Close()
		}
	}()
	restored := cfg
	restored.DataDir = filepath.Join(t.TempDir(), "restored")
	restored.MediaDir = filepath.Join(restored.DataDir, "media")
	if err := copyTree(cfg.MediaDir, restored.MediaDir); err != nil {
		t.Fatalf("restore PostgreSQL media backup: %v", err)
	}
	assertBackupFixture(t, restored, plantID, photoID)
}

func createBackupFixture(t *testing.T, cfg config.Config) (string, string) {
	t.Helper()
	ctx := context.Background()
	store, err := Open(ctx, cfg, time.UTC)
	if err != nil {
		t.Fatalf("open database for backup fixture: %v", err)
	}
	plant := Plant{Name: "Backup fern", ScientificName: "Nephrolepis exaltata", Notes: "Bright indirect light", CareStartDate: "2026-09-01", WateringIntervalDays: 9, SummerFertilizingIntervalDays: intPointer(15), WinterFertilizingIntervalDays: intPointer(40)}
	if err := store.SavePlant(ctx, plant); err != nil {
		t.Fatal(err)
	}
	plants, err := store.ListPlants(ctx, "Backup fern")
	if err != nil || len(plants) != 1 {
		t.Fatalf("read backup fixture plant: %v %#v", err, plants)
	}
	plantID := plants[0].ID
	wateredAt := time.Date(2026, time.October, 5, 9, 0, 0, 0, time.UTC)
	if _, err := store.AddActivity(ctx, Activity{PlantID: plantID, Type: "watering", OccurredAt: wateredAt}, "restore-water-key", "", "", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := store.AddActivity(ctx, Activity{PlantID: plantID, Type: "note", OccurredAt: time.Date(2026, time.October, 6, 10, 0, 0, 0, time.UTC), Note: "Rotate weekly"}, "restore-note-key", "", "", ""); err != nil {
		t.Fatal(err)
	}
	photo, err := store.SavePhoto(ctx, NewID(), plantID, "fern.jpg", 2, 3, "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	photoBytes := []byte{0xff, 0xd8, 0xff, 0x01, 0x02}
	if err := os.WriteFile(store.MediaFile(photo, false), photoBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store.MediaFile(photo, true), photoBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	return plantID, photo.ID
}

func assertBackupFixture(t *testing.T, cfg config.Config, plantID, photoID string) {
	t.Helper()
	ctx := context.Background()
	store, err := Open(ctx, cfg, time.UTC)
	if err != nil {
		t.Fatalf("open restored database: %v", err)
	}
	defer store.Close()
	plant, err := store.GetPlant(ctx, plantID)
	if err != nil || plant.Name != "Backup fern" || plant.Notes != "Bright indirect light" || plant.CoverPhotoID != photoID {
		t.Fatalf("restored plant: %#v, %v", plant, err)
	}
	activities, err := store.ListActivities(ctx, plantID)
	if err != nil || len(activities) != 3 {
		t.Fatalf("restored timeline: %v %#v", err, activities)
	}
	var watering time.Time
	seenNote, seenPhoto := false, false
	for _, activity := range activities {
		switch activity.Type {
		case "watering":
			watering = activity.OccurredAt
		case "note":
			seenNote = activity.Note == "Rotate weekly"
		case "photo":
			seenPhoto = activity.PhotoID == photoID
		}
	}
	if !seenNote || !seenPhoto || watering.IsZero() {
		t.Fatalf("restored timeline is missing watering, note, or photo: %#v", activities)
	}
	schedule := care.PlantSchedule{CareStart: time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC), WaterDays: plant.WateringIntervalDays, SummerFeedDays: plant.SummerFertilizingIntervalDays, WinterFeedDays: plant.WinterFertilizingIntervalDays, LastWater: &watering}
	due := care.Calculate(schedule, time.Date(2026, time.October, 10, 0, 0, 0, 0, time.UTC), time.UTC)
	if len(due) != 2 || due[0].DueAt.Format("2006-01-02") != "2026-10-14" || due[1].DueAt.Format("2006-01-02") != "2026-10-11" {
		t.Fatalf("restored schedule due state: %#v", due)
	}
	photos, err := store.ListPhotos(ctx, plantID)
	if err != nil || len(photos) != 1 || photos[0].ID != photoID {
		t.Fatalf("restored photo metadata: %v %#v", err, photos)
	}
	for _, thumbnail := range []bool{false, true} {
		data, err := os.ReadFile(store.MediaFile(photos[0], thumbnail))
		if err != nil || len(data) != 5 || data[0] != 0xff || data[1] != 0xd8 || data[2] != 0xff {
			t.Fatalf("restored photo file (thumbnail=%t): %v %x", thumbnail, err, data)
		}
	}
}

func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o750)
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		defer input.Close()
		output, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(output, input)
		closeErr := output.Close()
		return errors.Join(copyErr, closeErr)
	})
}

func runRepositoryContract(t *testing.T, cfg config.Config) {
	t.Helper()
	ctx := context.Background()
	store, err := Open(ctx, cfg, time.UTC)
	if err != nil {
		t.Fatalf("first startup/migration: %v", err)
	}

	plant := Plant{Name: "Fern", ScientificName: "Nephrolepis exaltata", CommonName: "Sword fern", CareStartDate: "2026-01-01", WateringIntervalDays: 8, SummerFertilizingIntervalDays: intPointer(18), WinterFertilizingIntervalDays: intPointer(42), WinterFertilizingPaused: true}
	if err := store.SavePlant(ctx, plant); err != nil {
		t.Fatal(err)
	}
	plants, err := store.ListPlants(ctx, "nephro")
	if err != nil || len(plants) != 1 {
		t.Fatalf("plant search: %v %#v", err, plants)
	}
	plantID := plants[0].ID
	if plants[0].WinterFertilizingIntervalDays == nil || *plants[0].WinterFertilizingIntervalDays != 42 || !plants[0].WinterFertilizingPaused {
		t.Fatalf("seasonal fields did not persist: %#v", plants[0])
	}
	plants[0].Name = "Updated fern"
	if err := store.SavePlant(ctx, plants[0]); err != nil {
		t.Fatal(err)
	}
	if got, err := store.GetPlant(ctx, plantID); err != nil || got.Name != "Updated fern" || got.CreatedAt.IsZero() || got.UpdatedAt.IsZero() {
		t.Fatalf("plant update/timestamps: %#v %v", got, err)
	}

	occurred := time.Date(2026, 1, 3, 9, 15, 0, 0, time.UTC)
	activity, err := store.AddActivity(ctx, Activity{PlantID: plantID, Type: "watering", OccurredAt: occurred, Note: "topsoil dry"}, "shared-contract-key", "issuer", "subject", "Test user")
	if err != nil {
		t.Fatal(err)
	}
	again, err := store.AddActivity(ctx, Activity{PlantID: plantID, Type: "watering", OccurredAt: occurred}, "shared-contract-key", "issuer", "subject", "Test user")
	if err != nil || again.ID != activity.ID {
		t.Fatalf("idempotent activity insert: %v, %#v", err, again)
	}
	activities, err := store.ListActivities(ctx, plantID)
	if err != nil || len(activities) != 1 || activities[0].ActorName != "Test user" || !activities[0].OccurredAt.Equal(occurred) || activities[0].CreatedAt.IsZero() {
		t.Fatalf("activity retrieval/timestamps/actor: %v %#v", err, activities)
	}
	calendar, err := store.ListCalendarActivities(ctx, occurred.Add(-time.Hour), occurred.Add(time.Hour))
	if err != nil || len(calendar) != 1 || calendar[0].PlantName != "Updated fern" {
		t.Fatalf("calendar query: %v %#v", err, calendar)
	}
	if err := store.UpdateActivity(ctx, activity.ID, occurred.Add(time.Hour), "corrected"); err != nil {
		t.Fatal(err)
	}

	photoID := NewID()
	photo, err := store.SavePhoto(ctx, photoID, plantID, "leaf.jpg", 80, 60, "issuer", "subject", "Test user")
	if err != nil {
		t.Fatal(err)
	}
	photos, err := store.ListPhotos(ctx, plantID)
	if err != nil || len(photos) != 1 || photos[0].ID != photo.ID {
		t.Fatalf("photo metadata: %v %#v", err, photos)
	}
	gotPlant, err := store.GetPlant(ctx, plantID)
	if err != nil || gotPlant.CoverPhotoID != photo.ID {
		t.Fatalf("first photo cover: %#v %v", gotPlant, err)
	}
	if _, err := store.SavePhoto(ctx, NewID(), "missing-plant", "orphan.jpg", 1, 1, "", "", ""); err == nil {
		t.Fatal("photo write without plant passed its foreign key")
	}
	if photos, err := store.ListPhotos(ctx, "missing-plant"); err != nil || len(photos) != 0 {
		t.Fatalf("failed photo transaction left rows: %v %#v", err, photos)
	}
	if _, err := store.DeletePhoto(ctx, plantID, photo.ID); err != nil {
		t.Fatal(err)
	}

	session := Session{Hash: HashSecret("session-token"), Identity: "issuer|subject", Issuer: "issuer", Subject: "subject", DisplayName: "Test user", CSRF: "csrf", ExpiresAt: time.Now().Add(time.Hour)}
	if err := store.SaveSession(ctx, session); err != nil {
		t.Fatal(err)
	}
	if got, err := store.GetSession(ctx, session.Hash); err != nil || got.DisplayName != session.DisplayName || got.CSRF != session.CSRF {
		t.Fatalf("session persistence: %#v %v", got, err)
	}
	attempt, created, err := store.BeginIdentification(ctx, "contract-attempt")
	if err != nil || !created {
		t.Fatalf("begin identification: %v, created=%t", err, created)
	}
	againAttempt, created, err := store.BeginIdentification(ctx, "contract-attempt")
	if err != nil || created || againAttempt.ID != attempt.ID {
		t.Fatalf("identification idempotency: %v, created=%t", err, created)
	}
	if err := store.CompleteIdentification(ctx, attempt.Key, "succeeded", "", json.RawMessage(`[{"name":"fern"}]`)); err != nil {
		t.Fatal(err)
	}
	if got, err := store.GetIdentification(ctx, attempt.Key); err != nil || got.Status != "succeeded" || !json.Valid(got.Candidates) {
		t.Fatalf("identification persistence: %#v %v", got, err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}

	// Repeated startup must leave the schema intact and data available.
	store, err = Open(ctx, cfg, time.UTC)
	if err != nil {
		t.Fatalf("repeat startup/migration: %v", err)
	}
	defer store.Close()
	persisted, err := store.ListPlants(ctx, "updated fern")
	if err != nil || len(persisted) != 1 || persisted[0].ID != plantID {
		t.Fatalf("plant did not survive restart: %v %#v", err, persisted)
	}
	activities, err = store.ListActivities(ctx, plantID)
	if err != nil || len(activities) != 2 {
		t.Fatalf("activities did not persist after restart: %v %#v", err, activities)
	}
	if err := store.DeletePlant(ctx, plantID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.GetPlant(ctx, plantID); err == nil {
		t.Fatal("deleted plant remained available")
	}
	if activities, err := store.ListActivities(ctx, plantID); err != nil || len(activities) != 0 {
		t.Fatalf("plant deletion did not cascade activity rows: %v %#v", err, activities)
	}
	if err := store.DeleteSession(ctx, session.Hash); err != nil {
		t.Fatal(err)
	}
}

func intPointer(value int) *int { return &value }

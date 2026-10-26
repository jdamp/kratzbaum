package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

type Plant struct {
	RoomID                        *string   `json:"room_id"`
	ID                            string    `json:"id"`
	Name                          string    `json:"name"`
	ScientificName                string    `json:"scientific_name"`
	CommonName                    string    `json:"common_name"`
	Family                        string    `json:"family"`
	Notes                         string    `json:"notes"`
	CareStartDate                 string    `json:"care_start_date"`
	WateringIntervalDays          int       `json:"watering_interval_days"`
	SummerFertilizingIntervalDays *int      `json:"summer_fertilizing_interval_days"`
	WinterFertilizingIntervalDays *int      `json:"winter_fertilizing_interval_days"`
	SummerFertilizingPaused       bool      `json:"summer_fertilizing_paused"`
	WinterFertilizingPaused       bool      `json:"winter_fertilizing_paused"`
	CoverPhotoID                  string    `json:"cover_photo_id"`
	PhotoURL                      string    `json:"photo_url,omitempty"`
	CreatedAt                     time.Time `json:"created_at"`
	UpdatedAt                     time.Time `json:"updated_at"`
}

type Activity struct {
	ID         string    `json:"id"`
	PlantID    string    `json:"plant_id"`
	Type       string    `json:"type"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
	PhotoID    string    `json:"photo_id,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	PlantName  string    `json:"plant_name,omitempty"`
	ActorName  string    `json:"actor_name,omitempty"`
}

func (s *Store) ListCalendarActivities(ctx context.Context, start, end time.Time) ([]Activity, error) {
	rows, err := s.db.QueryContext(ctx, s.query(`SELECT a.id,a.plant_id,p.name,a.type,a.occurred_at,a.note,COALESCE(a.photo_id,''),a.created_at,COALESCE(a.actor_name,'') FROM activities a JOIN plants p ON p.id=a.plant_id WHERE a.occurred_at>=? AND a.occurred_at<? ORDER BY a.occurred_at`), start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Activity{}
	for rows.Next() {
		var a Activity
		var occurred, created dbTime
		if err := rows.Scan(&a.ID, &a.PlantID, &a.PlantName, &a.Type, &occurred, &a.Note, &a.PhotoID, &created, &a.ActorName); err != nil {
			return nil, err
		}
		a.OccurredAt, a.CreatedAt = occurred.Time, created.Time
		out = append(out, a)
	}
	return out, rows.Err()
}

type Photo struct {
	ID        string    `json:"id"`
	PlantID   string    `json:"plant_id"`
	Filename  string    `json:"filename"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) SavePhoto(ctx context.Context, id, plantID, filename string, width, height int, issuer, subject, actorName string) (Photo, error) {
	p := Photo{ID: id, PlantID: plantID, Filename: filename, Width: width, Height: height, CreatedAt: instant(time.Now())}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Photo{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, s.query(`INSERT INTO photos(id,plant_id,filename,width,height,created_at) VALUES(?,?,?,?,?,?)`), p.ID, p.PlantID, p.Filename, p.Width, p.Height, p.CreatedAt); err != nil {
		return Photo{}, err
	}
	if _, err = tx.ExecContext(ctx, s.query(`INSERT INTO activities(id,plant_id,type,occurred_at,note,photo_id,actor_issuer,actor_subject,actor_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`), newID(), plantID, "photo", p.CreatedAt, "", p.ID, issuer, subject, actorName, p.CreatedAt); err != nil {
		return Photo{}, err
	}
	if _, err = tx.ExecContext(ctx, s.query(`UPDATE plants SET cover_photo_id=CASE WHEN cover_photo_id='' THEN ? ELSE cover_photo_id END,updated_at=? WHERE id=?`), p.ID, p.CreatedAt, plantID); err != nil {
		return Photo{}, err
	}
	if err = tx.Commit(); err != nil {
		return Photo{}, err
	}
	return p, nil
}
func (s *Store) ListPhotos(ctx context.Context, plantID string) ([]Photo, error) {
	rows, err := s.db.QueryContext(ctx, s.query(`SELECT id,plant_id,filename,width,height,created_at FROM photos WHERE plant_id=? ORDER BY created_at DESC`), plantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Photo{}
	for rows.Next() {
		var p Photo
		var at dbTime
		if err := rows.Scan(&p.ID, &p.PlantID, &p.Filename, &p.Width, &p.Height, &at); err != nil {
			return nil, err
		}
		p.CreatedAt = at.Time
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Store) GetPhoto(ctx context.Context, id string) (Photo, error) {
	var p Photo
	var at dbTime
	err := s.db.QueryRowContext(ctx, s.query(`SELECT id,plant_id,filename,width,height,created_at FROM photos WHERE id=?`), id).Scan(&p.ID, &p.PlantID, &p.Filename, &p.Width, &p.Height, &at)
	p.CreatedAt = at.Time
	return p, err
}
func (s *Store) MediaFile(photo Photo, thumbnail bool) string {
	suffix := ""
	if thumbnail {
		suffix = "_thumb"
	}
	return filepath.Join(s.mediaDir, photo.ID+suffix+".jpg")
}

func (s *Store) ListPlants(ctx context.Context, search string) ([]Plant, error) {
	rows, err := s.db.QueryContext(ctx, s.query(`SELECT id,name,scientific_name,common_name,family,notes,care_start_date,watering_interval_days,summer_fertilizing_interval_days,winter_fertilizing_interval_days,summer_fertilizing_paused,winter_fertilizing_paused,cover_photo_id,room_id,created_at,updated_at FROM plants WHERE (? = '' OR lower(name || ' ' || scientific_name || ' ' || common_name) LIKE ?) ORDER BY lower(name)`), search, "%"+strings.ToLower(search)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Plant{}
	for rows.Next() {
		p, e := scanPlant(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Store) GetPlant(ctx context.Context, id string) (Plant, error) {
	return scanPlant(s.db.QueryRowContext(ctx, s.query(`SELECT id,name,scientific_name,common_name,family,notes,care_start_date,watering_interval_days,summer_fertilizing_interval_days,winter_fertilizing_interval_days,summer_fertilizing_paused,winter_fertilizing_paused,cover_photo_id,room_id,created_at,updated_at FROM plants WHERE id=?`), id))
}

type scanner interface{ Scan(...any) error }

type dbTime struct{ time.Time }

func (d *dbTime) Scan(v any) error {
	switch value := v.(type) {
	case time.Time:
		d.Time = instant(value)
		return nil
	case string:
		for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999-07:00", "2006-01-02 15:04:05.999999999Z07:00", "2006-01-02 15:04:05.999999 -0700 MST", "2006-01-02 15:04:05"} {
			if t, err := time.Parse(layout, value); err == nil {
				d.Time = instant(t)
				return nil
			}
		}
		return fmt.Errorf("parse database timestamp %q", value)
	case []byte:
		return d.Scan(string(value))
	case nil:
		d.Time = time.Time{}
		return nil
	default:
		return fmt.Errorf("unsupported database timestamp %T", v)
	}
}

func scanPlant(row scanner) (p Plant, err error) {
	var created, updated dbTime
	err = row.Scan(&p.ID, &p.Name, &p.ScientificName, &p.CommonName, &p.Family, &p.Notes, &p.CareStartDate, &p.WateringIntervalDays, &p.SummerFertilizingIntervalDays, &p.WinterFertilizingIntervalDays, &p.SummerFertilizingPaused, &p.WinterFertilizingPaused, &p.CoverPhotoID, &p.RoomID, &created, &updated)
	p.CreatedAt, p.UpdatedAt = created.Time, updated.Time
	if p.CoverPhotoID != "" {
		p.PhotoURL = "/media/" + p.CoverPhotoID + "/thumb.jpg"
	}
	return
}

func (s *Store) SavePlant(ctx context.Context, p Plant) error {
	now := instant(time.Now())
	if p.ID == "" {
		p.ID = newID()
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	_, err := s.db.ExecContext(ctx, s.query(`INSERT INTO plants (id,name,scientific_name,common_name,family,notes,care_start_date,watering_interval_days,summer_fertilizing_interval_days,winter_fertilizing_interval_days,summer_fertilizing_paused,winter_fertilizing_paused,cover_photo_id,room_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,scientific_name=excluded.scientific_name,common_name=excluded.common_name,family=excluded.family,notes=excluded.notes,care_start_date=excluded.care_start_date,watering_interval_days=excluded.watering_interval_days,summer_fertilizing_interval_days=excluded.summer_fertilizing_interval_days,winter_fertilizing_interval_days=excluded.winter_fertilizing_interval_days,summer_fertilizing_paused=excluded.summer_fertilizing_paused,winter_fertilizing_paused=excluded.winter_fertilizing_paused,room_id=excluded.room_id,updated_at=excluded.updated_at`), p.ID, p.Name, p.ScientificName, p.CommonName, p.Family, p.Notes, p.CareStartDate, p.WateringIntervalDays, p.SummerFertilizingIntervalDays, p.WinterFertilizingIntervalDays, p.SummerFertilizingPaused, p.WinterFertilizingPaused, p.CoverPhotoID, p.RoomID, now, now)
	if isConstraint(err, "23503", 787) {
		return ErrRoomReference
	}
	return err
}
func (s *Store) DeletePlant(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, s.query(`DELETE FROM plants WHERE id=?`), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
func (s *Store) ListActivities(ctx context.Context, plantID string) ([]Activity, error) {
	rows, err := s.db.QueryContext(ctx, s.query(`SELECT id,plant_id,type,occurred_at,note,COALESCE(photo_id,''),created_at,COALESCE(actor_name,'') FROM activities WHERE plant_id=? ORDER BY occurred_at DESC,created_at DESC`), plantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Activity{}
	for rows.Next() {
		var a Activity
		var occurred, created dbTime
		if err := rows.Scan(&a.ID, &a.PlantID, &a.Type, &occurred, &a.Note, &a.PhotoID, &created, &a.ActorName); err != nil {
			return nil, err
		}
		a.OccurredAt, a.CreatedAt = occurred.Time, created.Time
		out = append(out, a)
	}
	return out, rows.Err()
}
func (s *Store) AddActivity(ctx context.Context, a Activity, key, issuer, subject, name string) (Activity, error) {
	if key != "" {
		var existing Activity
		var occurred, created dbTime
		err := s.db.QueryRowContext(ctx, s.query(`SELECT id,plant_id,type,occurred_at,note,COALESCE(photo_id,''),created_at,COALESCE(actor_name,'') FROM activities WHERE idempotency_key=?`), key).Scan(&existing.ID, &existing.PlantID, &existing.Type, &occurred, &existing.Note, &existing.PhotoID, &created, &existing.ActorName)
		if err == nil {
			existing.OccurredAt, existing.CreatedAt = occurred.Time, created.Time
			return existing, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return a, err
		}
	}
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = instant(time.Now())
	a.ActorName = name
	_, err := s.db.ExecContext(ctx, s.query(`INSERT INTO activities(id,plant_id,type,occurred_at,note,idempotency_key,actor_issuer,actor_subject,actor_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`), a.ID, a.PlantID, a.Type, instant(a.OccurredAt), a.Note, nullString(key), issuer, subject, name, a.CreatedAt)
	return a, err
}
func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func (s *Store) DeleteActivity(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, s.query(`DELETE FROM activities WHERE id=?`), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) UpdateActivity(ctx context.Context, id string, occurred time.Time, note string) error {
	res, err := s.db.ExecContext(ctx, s.query(`UPDATE activities SET occurred_at=?,note=? WHERE id=?`), instant(occurred), note, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
func (s *Store) SetCover(ctx context.Context, plantID, photoID string) error {
	res, err := s.db.ExecContext(ctx, s.query(`UPDATE plants SET cover_photo_id=?,updated_at=? WHERE id=? AND (?='' OR EXISTS (SELECT 1 FROM photos WHERE id=? AND plant_id=?))`), photoID, instant(time.Now()), plantID, photoID, photoID, plantID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("plant not found")
	}
	return nil
}

func (s *Store) DeletePhoto(ctx context.Context, plantID, photoID string) (Photo, error) {
	p, err := s.GetPhoto(ctx, photoID)
	if err != nil || p.PlantID != plantID {
		return Photo{}, sql.ErrNoRows
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Photo{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, s.query(`DELETE FROM photos WHERE id=? AND plant_id=?`), photoID, plantID); err != nil {
		return Photo{}, err
	}
	if _, err = tx.ExecContext(ctx, s.query(`UPDATE plants SET cover_photo_id=CASE WHEN cover_photo_id=? THEN COALESCE((SELECT id FROM photos WHERE plant_id=? ORDER BY created_at DESC LIMIT 1),'') ELSE cover_photo_id END,updated_at=? WHERE id=?`), photoID, plantID, instant(time.Now()), plantID); err != nil {
		return Photo{}, err
	}
	if err = tx.Commit(); err != nil {
		return Photo{}, err
	}
	return p, nil
}

package storage

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"modernc.org/sqlite"
)

var (
	ErrRoomName      = errors.New("Room name must contain between 1 and 120 characters")
	ErrRoomDuplicate = errors.New("A room with this name already exists")
	ErrRoomReference = errors.New("This room no longer exists. Choose another room or Unassigned")
)

type Room struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *Store) ListRooms(ctx context.Context) ([]Room, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id,name,created_at,updated_at FROM rooms ORDER BY name_key,id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rooms := []Room{}
	for rows.Next() {
		var room Room
		var created, updated dbTime
		if err := rows.Scan(&room.ID, &room.Name, &created, &updated); err != nil {
			return nil, err
		}
		room.CreatedAt, room.UpdatedAt = created.Time, updated.Time
		rooms = append(rooms, room)
	}
	return rooms, rows.Err()
}

func (s *Store) SaveRoom(ctx context.Context, id, name string) (Room, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < 1 || n > 120 {
		return Room{}, ErrRoomName
	}
	now := instant(time.Now())
	room := Room{ID: id, Name: name, CreatedAt: now, UpdatedAt: now}
	var err error
	if id == "" {
		room.ID = newID()
		_, err = s.db.ExecContext(ctx, s.query("INSERT INTO rooms(id,name,name_key,created_at,updated_at) VALUES(?,?,?,?,?)"), room.ID, name, strings.ToLower(name), now, now)
	} else {
		var created dbTime
		err = s.db.QueryRowContext(ctx, s.query("UPDATE rooms SET name=?,name_key=?,updated_at=? WHERE id=? RETURNING created_at"), name, strings.ToLower(name), now, id).Scan(&created)
		room.CreatedAt = created.Time
	}
	if isConstraint(err, "23505", 2067) {
		err = ErrRoomDuplicate
	}
	return room, err
}

func (s *Store) DeleteRoom(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, s.query("DELETE FROM rooms WHERE id=?"), id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return sql.ErrNoRows
	}
	return err
}

func isConstraint(err error, postgresCode string, sqliteCode int) bool {
	var pg *pgconn.PgError
	var sq *sqlite.Error
	return errors.As(err, &pg) && pg.Code == postgresCode || errors.As(err, &sq) && sq.Code() == sqliteCode
}

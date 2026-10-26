CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE plants ADD COLUMN room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL;
CREATE INDEX plants_room_idx ON plants(room_id);

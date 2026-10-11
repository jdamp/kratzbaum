CREATE TABLE plants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    scientific_name TEXT NOT NULL DEFAULT '',
    common_name TEXT NOT NULL DEFAULT '',
    family TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    care_start_date TEXT NOT NULL,
    watering_interval_days BIGINT NOT NULL DEFAULT 7 CHECK (watering_interval_days > 0),
    summer_fertilizing_interval_days BIGINT CHECK (summer_fertilizing_interval_days IS NULL OR summer_fertilizing_interval_days > 0),
    winter_fertilizing_interval_days BIGINT CHECK (winter_fertilizing_interval_days IS NULL OR winter_fertilizing_interval_days > 0),
    summer_fertilizing_paused BOOLEAN NOT NULL DEFAULT FALSE,
    winter_fertilizing_paused BOOLEAN NOT NULL DEFAULT FALSE,
    cover_photo_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    width BIGINT NOT NULL CHECK (width > 0),
    height BIGINT NOT NULL CHECK (height > 0),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(id, plant_id)
);

CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('watering', 'fertilizing', 'photo', 'note')),
    occurred_at TIMESTAMPTZ NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    actor_issuer TEXT NOT NULL DEFAULT '',
    actor_subject TEXT NOT NULL DEFAULT '',
    actor_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX activities_plant_time_idx ON activities(plant_id, occurred_at DESC, created_at DESC);
CREATE INDEX activities_calendar_idx ON activities(occurred_at, type);

CREATE TABLE identification_attempts (
    id TEXT PRIMARY KEY,
    attempt_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'no_match', 'failed')),
    candidates_json TEXT NOT NULL DEFAULT '[]',
    error_code TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE oidc_sessions (
    session_hash TEXT PRIMARY KEY,
    identity TEXT NOT NULL,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    csrf_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX oidc_sessions_expiry_idx ON oidc_sessions(expires_at);

CREATE TABLE oidc_login_attempts (
    state_hash TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    verifier TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

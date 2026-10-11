# kratzbaum

A self-hosted plant collection and care tracker. The app is a single-origin Go service with a React PWA, SQLite by default, and PostgreSQL support for homelabs. Collection access is shared by everyone admitted to the deployment.

## Run locally

Install Go 1.27+, Node.js 22+, and `libheif-examples` (`heif-convert`) for HEIC uploads. From the repository root:

```sh
cd web && npm ci --legacy-peer-deps && npm run build && cd ..
go test ./...
go run ./cmd/kratzbaum
```

For Chromium end-to-end checks, keep kratzbaum running and in another terminal run `cd web && npx playwright install chromium && npm run test:ui`.

To run the shared repository and HTTP API integration cases against PostgreSQL, start the isolated test service with `docker compose -f deploy/compose.postgres-test.yaml up -d --wait`, set `KRATZBAUM_TEST_POSTGRES_URL=postgres://kratzbaum_test:kratzbaum_test@127.0.0.1:55432/kratzbaum_test?sslmode=disable`, then run `go test ./...`. PostgreSQL tests refuse database names that do not end in `_test`, create random temporary schemas, and drop only those schemas afterward. The backup/restore case also requires matching PostgreSQL 18 `pg_dump` and `pg_restore` tools; it recreates only its own temporary schema and copies the media directory. The same package tests also run on SQLite. Stop the test service with `docker compose -f deploy/compose.postgres-test.yaml down`.

The first run creates `./data/kratzbaum.db` and `./data/media`. Set `APP_TIMEZONE` to an IANA timezone. Northern hemisphere fertilizer seasons are April–September and October–March. Intervals are per plant; due dates anchor to care start until a completion is recorded, then to the latest completion.

## Container deployment

`docker compose up --build -d` starts a SQLite deployment on port 8080. Put it behind HTTPS before installing the PWA on phones. The named `kratzbaum-data` volume contains both the SQLite database and photo files.

For external PostgreSQL, copy `deploy/postgres.env.example` to `deploy/postgres.env`, set a dedicated database URL, then run `docker compose -f deploy/compose.postgres.yaml up --build -d`. PostgreSQL must be reachable from the container. The media volume remains local to the app host.

Supported configuration: `LISTEN_ADDR`, `DATABASE_DRIVER=sqlite|postgres`, `DATABASE_URL`, `DATA_DIR`, `MEDIA_DIR`, `APP_TIMEZONE`, `AUTH_MODE=no|oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL`, `PLANTNET_API_KEY`, `PLANTNET_API_URL`, `HEIF_CONVERT`, `MAX_UPLOAD_BYTES`, and `MAX_IMAGE_PIXELS`. Invalid database/auth/timezone configuration fails startup. Keep database credentials, OIDC secrets, and PlantNet keys outside source control.

## Backups

Stop the app for a consistent SQLite backup, then copy the entire `/data` directory so the database and photos stay together. For PostgreSQL, take a database dump and copy `/data/media` under a brief maintenance window. Restore both before starting the app; migrations run automatically at startup. Test restores periodically.

OIDC deployments need an HTTPS callback URL matching `OIDC_REDIRECT_URL`; all accepted users share the same collection. PlantNet is optional and should only be invoked through an explicit identification action. Standard browser service workers require HTTPS (localhost is allowed for development).

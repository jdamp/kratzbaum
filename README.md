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

The first run creates `./data/kratzbaum.db` and `./data/media`. Set `APP_TIMEZONE` to an IANA timezone. Northern hemisphere fertilizer seasons are April–September and October–March. Intervals are per plant. Care started is optional and blank by default: each watering or fertilizing schedule starts independently from the first actual care record, unless you supply a fallback date. Today lists enabled schedules without an anchor under **Not started yet**; use **Watered** or **Fertilized** to choose the actual completion date. Due and upcoming reminders show the selected cover photo when available.

## Rooms and care

Create, rename, or delete rooms in **Rooms** (after Calendar in the sidebar and phone navigation), or open **Manage rooms** from the plant form without losing the draft. Assign, move, or unassign an existing plant using **Room** and **Save room** on its detail page. The Add/Edit Plant form also offers **Room · optional**. Plants and Today share an **All rooms / room / Unassigned** filter, so you can work through one room with individual care actions. Catalogue search combines with its room filter; it does not hide care actions on Today. Deleting a room keeps its plants, photos, and history and makes the plants unassigned.

Click a reminder photo or its fallback to open that plant directly. New care notes use the current save time automatically; existing note timestamps remain editable.

Successfully cached plants, rooms, reminders, and photos remain readable offline, including room filtering. Offline views show their saved refresh time; care recording and room changes require a connection. Room data that was not cached is shown as unavailable.

Upgrades run automatically on startup for SQLite and PostgreSQL. Existing plants retain their saved care start dates and history and begin without a room assignment. To stop using an old automatically suggested start date, clear **Care started** in Edit plant; recorded care remains intact. Back up the database and media before upgrading. Rolling back to the old application requires the matching pre-upgrade database backup because the old calculator does not support absent care anchors.

## Container deployment

`docker compose up --build -d` starts a SQLite deployment on port 8080. Put it behind HTTPS before installing the PWA on phones. The named `kratzbaum-data` volume contains both the SQLite database and photo files.

For external PostgreSQL, copy `deploy/postgres.env.example` to `deploy/postgres.env`, set a dedicated database URL, then run `docker compose -f deploy/compose.postgres.yaml up --build -d`. PostgreSQL must be reachable from the container. The media volume remains local to the app host.

Supported configuration: `LISTEN_ADDR`, `DATABASE_DRIVER=sqlite|postgres`, `DATABASE_URL`, `DATA_DIR`, `MEDIA_DIR`, `APP_TIMEZONE`, `AUTH_MODE=no|oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL`, `PLANTNET_API_KEY`, `PLANTNET_API_URL`, `HEIF_CONVERT`, `MAX_UPLOAD_BYTES`, and `MAX_IMAGE_PIXELS`. Invalid database/auth/timezone configuration fails startup. Keep database credentials, OIDC secrets, and PlantNet keys outside source control.

## Published images and versions

GitHub Actions runs Go (SQLite and PostgreSQL 18, including backup/restore), frontend unit/type checks, browser checks, and container HEIC smoke tests on pull requests and pushes to main. Every passing push to main publishes the production image to GHCR:

```sh
docker pull ghcr.io/jdamp/kratzbaum:latest
# Select a particular published workflow run, for example:
docker pull ghcr.io/jdamp/kratzbaum:0.1.42
```

Use that image in your deployment with the same environment and persistent mounts described above. The Compose examples build locally; to use GHCR, remove the app service's `build` setting and set its `image` to `ghcr.io/jdamp/kratzbaum:latest` (or a published version).

Versions are `0.1.<GitHub Actions run number>`. PRs and failed runs consume numbers, so gaps are expected. Reruns reuse the version and may replace its image. `latest` follows publication completion order; overlapping runs or rerunning an older run can move it to an older commit. Both tags for a publication identify the same image. For exact pinning or rollback, use `ghcr.io/jdamp/kratzbaum@sha256:<digest>`; each publication's Actions summary includes its digest. Keep the CI workflow identity stable; if its numbering is reset, change the version prefix before publishing again.

Publication uses the repository's automatic `GITHUB_TOKEN` with `packages: write`; no PAT secret is required. After the first publication, check the package settings on GitHub: make the package public for anonymous homelab pulls, or authenticate your deployment for private pulls. If the package already exists, grant this repository Actions access. Actions and package publishing must be enabled for the repository. Publication is initially linux/amd64 only.

## Backups

Stop the app for a consistent SQLite backup, then copy the entire `/data` directory so the database and photos stay together. For PostgreSQL, take a database dump and copy `/data/media` under a brief maintenance window. Restore both before starting the app; migrations run automatically at startup. Test restores periodically.

OIDC deployments need an HTTPS callback URL matching `OIDC_REDIRECT_URL`; all accepted users share the same collection. Set `OIDC_ISSUER` to the exact issuer advertised by the provider's discovery document, including any trailing slash. For example, an Authentik per-provider issuer can be `https://auth.example.com/application/o/kratzbaum/`. Discovery and identity-token issuers must match this identifier exactly.

## Species identification

Set `PLANTNET_API_KEY` on the server to enable optional Pl@ntNet identification. `PLANTNET_API_URL` defaults to `https://my-api.plantnet.org/v2/identify/all`. The project belongs in the URL path; do not add a `project` query parameter. Keep the key outside source control; the browser receives only an availability flag. Without a key, plants can still be saved with a manually entered scientific name or no species information.

In Add Plant, choose a photo and click **Identify species** before saving. Review the ranked suggestions and confidence scores, then **Confirm species** to fill the draft. **Add plant** saves it separately. Identification sends the selected image to the server and Pl@ntNet only after that explicit action; selecting a photo alone sends nothing. If the plant is later saved with that photo, the local file is uploaded again for its gallery and cover. Cancelling creation leaves no plant or catalogue photo.

For existing plants, click **Identify this photo** on a saved gallery photo to start identification immediately. To identify a new image, use **Add photo** first, then identify it from the gallery. Review the suggestions and select **Confirm species** to save species information; cancelling leaves the species unchanged. To retry identification, click **Identify this photo** again. If saving a confirmed species fails, retry **Confirm species** without repeating identification. Identification alone does not attach a new photo or add a photo activity. Photo uploads and identification remain separate, including when retrying a failed catalogue photo upload.

Identification failures produce structured server logs visible through normal container or pod logs. Each event includes `attempt_id`, `failure_code`, and `upstream_status` when a response was received. Transport failures instead include a bounded `transport` category such as `dns`, `connection`, `tls`, or `timeout`. HTTP 400/422 indicates request rejection, 401/403 indicates API-key or account rejection, 404 indicates no match, and 429 indicates exhausted quota. Logs omit API keys, request URLs, image data, and provider response bodies. Replaying a stored attempt does not send another request or duplicate its failure event.

Identification is unavailable offline. Failures retain recoverable input and require an explicit retry; requests are never queued or automatically replayed. A failed species save can be retried with **Confirm species** without spending another identification request.

Standard browser service workers require HTTPS (localhost is allowed for development).

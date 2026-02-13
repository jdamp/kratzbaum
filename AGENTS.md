# AGENTS.md

Practical guide for coding agents working in `kratzbaum`.

## 1. Project Snapshot
- Product: Self-hosted plant management app (single-user).
- Stack: FastAPI + SQLModel (backend), SvelteKit 5 + Tailwind v4 (frontend), PostgreSQL + local uploads, Docker Compose.
- Deployment shape: `api` + `frontend` + `db` services in `docker-compose.yml`.

## 2. Repository Map
- Backend app: `backend/app/`
- Backend tests: `backend/tests/`
- Frontend app: `frontend/src/`
- Product/technical docs: `docs/`
- CI workflow: `.github/workflows/ci.yml`

## 3. Source of Truth Rules
- Treat backend code as API source of truth, not `docs/02_technical/api_contracts.md`.
- Treat current frontend code as UX source of truth, not `docs/03_ui_ux/user_flows.md`.
- Several docs describe planned endpoints/features that are not implemented.

## 4. Actual Backend API (Implemented)
All implemented routes are mounted under `/api`.

### Auth
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Plants
- `GET /api/plants`
- `POST /api/plants`
- `GET /api/plants/{plant_id}`
- `PUT /api/plants/{plant_id}`
- `DELETE /api/plants/{plant_id}`
- `POST /api/plants/{plant_id}/photos`
- `DELETE /api/plants/{plant_id}/photos/{photo_id}`
- `POST /api/plants/{plant_id}/photos/{photo_id}/primary`
- `POST /api/plants/{plant_id}/care-events`
- `GET /api/plants/{plant_id}/care-events`
- `DELETE /api/plants/{plant_id}/care-events/{event_id}`

### Pots
- `GET /api/pots`
- `GET /api/pots/available`
- `POST /api/pots`
- `GET /api/pots/{pot_id}`
- `PUT /api/pots/{pot_id}`
- `DELETE /api/pots/{pot_id}`
- `POST /api/pots/{pot_id}/photos`

### Reminders
- `GET /api/reminders`
- `GET /api/reminders/upcoming`
- `POST /api/reminders/{reminder_id}/snooze`
- `DELETE /api/reminders/{reminder_id}`

### Identify
- `POST /api/identify`

### Settings
- `GET /api/settings/reminders`
- `PUT /api/settings/reminders`
- `GET /api/settings/plantnet`
- `PUT /api/settings/plantnet`

### Health
- `GET /api/health`

## 5. Not Implemented (Despite Docs/Frontend References)
- No `/api/push/subscribe` routes.
- No `/api/reminders/overdue` route.
- No `POST /api/reminders/{id}/complete` route.
- No general reminder CRUD (`POST /api/reminders`, `PUT /api/reminders/{id}`, `GET /api/reminders/{id}`).

## 6. Core Domain Invariants
- Single-user auth model: `settings` table uses singleton row (`id = 1`).
- IDs: UUID for plants/pots/photos/events/reminders/subscriptions.
- Datetimes: timezone-aware UTC in backend models/services.
- Photos:
  - Stored on disk in `uploads/plants` and `uploads/pots`.
  - DB stores filename, API returns `/uploads/...` URLs.
- Reminder model is interval-based and recalculated from plant/global settings + care events.

## 7. High-Risk Mismatches to Check Before Editing
- Keep `frontend/src/lib/api/types.ts` aligned with backend response models in `backend/app/api/*.py`; contracts are currently aligned for plants/pots/reminders.
- `frontend/src/lib/api/client.ts` currently handles both `{"detail":"..."}` and structured `detail.message` error payloads.
- Product docs under `docs/01_features/` still describe planned reminder/push endpoints that are not implemented in backend routes.

## 8. Backend Architecture Notes
- App entry/lifespan: `backend/app/main.py`.
- Scheduler: APScheduler in-process job `check_due_reminders` runs every minute.
- DB init: tables created at startup via `SQLModel.metadata.create_all` (no migration flow in runtime path).
- Security: bcrypt + JWT (`HS256`) in `backend/app/core/security.py`.

## 9. Frontend Architecture Notes
- Global route guard is in `frontend/src/routes/+layout.svelte` (redirects to `/login` when unauthenticated).
- API base URL in browser is `/api`, proxied by Vite dev server to backend.
- UI relies on local token storage (`localStorage`) from `frontend/src/lib/stores/auth.ts`.

## 10. Quality Gates (Current Baseline)
Validated on 2026-02-13:
- Backend lint: `cd backend && UV_CACHE_DIR=/tmp/uv-cache uv run ruff check` passes.
- Backend tests: `cd backend && UV_CACHE_DIR=/tmp/uv-cache uv run pytest -q` passes (`63 passed`), with no warnings.
- Frontend type check: `cd frontend && npm run check` passes with no warnings.
- Frontend build: `cd frontend && npm run build` passes with no warnings.

## 11. Agent Workflow Recommendations
- Before adding features, verify endpoint actually exists in `backend/app/api/*.py`.
- If you change backend response models, update:
  - `frontend/src/lib/api/types.ts`
  - related client/service usage
  - `docs/02_technical/api_contracts.md`
- If you implement missing endpoints (`identify`, `push`, reminder complete/overdue), update frontend services currently assuming they exist.
- Keep timezone handling explicit (`datetime.now(UTC)` pattern).
- Prefer adding/adjusting tests in `backend/tests/` for any behavior change.
- Always write commit messages in Conventional Commits style (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).

## 12. Useful Commands
- Backend dev: `cd backend && uv run fastapi dev app/main.py`
- Backend tests: `cd backend && uv run pytest -v`
- Backend lint: `cd backend && uv run ruff check`
- Frontend dev: `cd frontend && npm run dev`
- Frontend checks: `cd frontend && npm run check`
- Full stack: `docker compose up --build`

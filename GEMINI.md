# GEMINI.md

Guidelines for AI coding agents working on the Kratzbaum repository.

## Project Context

**Kratzbaum** is a self-hosted plant management system for tracking houseplants, managing watering/fertilizing schedules, and identifying plant species using AI.

**Key Goals:**
- Track plants with photos, species, and care history
- Smart reminders for watering and fertilizing
- Pot inventory management
- Species recognition via PlantNet API

**Target Platform:** Progressive Web App (PWA) for iPhone and desktop browsers.

**Architecture:** FastAPI backend + SvelteKit frontend (TailwindCSS v4, Skeleton UI), deployed via Docker Compose.


## Core Commands

### Backend Development

```bash
cd backend

# Install dependencies
uv sync

# Run development server
uv run fastapi dev app/main.py

# Run tests
uv run pytest -v

# Run specific test file
uv run pytest tests/test_security.py -v
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run Svelte check (Type checking)
npm run check
```

### Docker

```bash
# Start full stack (API + PostgreSQL)
docker compose up

# Rebuild after code changes
docker compose up --build
```

### Initial Setup

After starting the server, create the initial user:
```bash
curl -X POST http://localhost:8000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'
```

---

## Coding Standards

### Python (Backend)

- **Python 3.11+** with modern type hints (`str | None`, not `Optional[str]`)
- **Formatter:** Use `ruff format`
- **Linter:** Use `ruff check`
- **Type Checking:** Use `ty` for static type checking
- **Imports:** Group as stdlib → third-party → local, sorted alphabetically
- **Async:** All database operations use `async/await`
- **Models:** Use SQLModel (combines SQLAlchemy + Pydantic)

### API Design

- RESTful endpoints under `/api/`
- Use Pydantic models for request/response validation
- Return appropriate HTTP status codes (201 for create, 204 for delete)
- Include `CurrentUser` dependency on protected endpoints

### Testing

- Use `pytest` with `pytest-asyncio`
- Pure logic should be tested without database dependencies
- Test files named `test_*.py`

---

## Project Structure

```
kratzbaum/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point + scheduler
│   │   ├── core/             # Config, database, security utilities
│   │   ├── models/           # SQLModel database models (plant, pot, reminder, etc.)
│   │   ├── api/              # API route handlers (auth, plants, pots, reminders, settings)
│   │   ├── services/         # Business logic (file uploads, PlantNet, push)
│   │   └── scheduler/        # APScheduler jobs
│   ├── tests/                # pytest tests
│   ├── uploads/              # Uploaded photos (gitignored)
│   └── pyproject.toml        # uv project config
├── frontend/                 # SvelteKit app
│   ├── src/
│   │   ├── routes/           # Application pages (+page.svelte, +layout.svelte)
│   │   └── lib/              # Shared components and utilities
│   ├── static/               # Static assets
│   ├── package.json          # Frontend dependencies and scripts
│   └── svelte.config.js      # SvelteKit configuration
├── docs/
│   ├── 00_project_context.md # Vision, tech stack, decisions
│   ├── 01_features/          # Feature specifications
│   ├── 02_technical/         # Architecture, schema, API contracts
│   └── 03_ui_ux/             # Style guide, user flows
├── docker-compose.yml
└── GEMINI.md                 # This file

### Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, routes, scheduler initialization |
| `backend/app/core/config.py` | Environment variables via Pydantic Settings |
| `backend/app/core/security.py` | JWT tokens, password hashing |
| `backend/app/api/deps.py` | FastAPI dependencies (auth, database) |
| `frontend/src/routes/+page.svelte` | Frontend Home Page |
| `frontend/package.json` | Frontend dependencies and scripts |
| `docs/02_technical/database_schema.md` | Entity relationships and table definitions |
| `docs/02_technical/api_contracts.md` | API endpoint specifications |

---

## Guidelines

### Before Making Changes

1. **Read the docs first** — Check `docs/` for existing specifications before implementing
2. **Check existing patterns** — Follow established code patterns in similar files
3. **Run tests** — Ensure `uv run pytest` passes before and after changes

### When Adding Features

1. Add/update feature doc in `docs/01_features/`
2. Create/update SQLModel models in `backend/app/models/`
3. Create API endpoints in `backend/app/api/`
4. Add tests in `backend/tests/`
5. Update `docs/02_technical/api_contracts.md` if adding endpoints

### Important Conventions

- **Single-user system** — No `user_id` foreign keys on most models
- **UUIDs for IDs** — All primary keys use UUID, not auto-increment
- **Timezone-aware datetimes** — Always use `datetime.now(UTC)`, never naive datetimes
- **Relationships** — Use `cascade="all, delete-orphan"` for child entities
- **Photos** — Stored in `backend/uploads/{plants,pots}/` with UUID filenames

### Common Pitfalls

- **Don't use passlib** — Use `bcrypt` directly (passlib has Python 3.13 compatibility issues)
- **SQLModel relationships** — Import related models at bottom of file to avoid circular imports
- **APScheduler** — Jobs run in-process; avoid blocking operations
- **File uploads** — Validate file type and size in `services/files.py`

### Environment Variables

Required for production (see `backend/app/core/config.py`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key |
| `PLANTNET_API_KEY` | PlantNet API key (optional) |
| `VAPID_PRIVATE_KEY` | Web push private key (optional) |
| `VAPID_PUBLIC_KEY` | Web push public key (optional) |

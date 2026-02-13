# Kratzbaum 🌿

**Kratzbaum** is a comprehensive, self-hosted plant management system designed to help you track your houseplants, manage care schedules, and identify species using AI.

> [!NOTE]
> This app is completely vibe-coded. 🎨✨

## ✨ Features

- **Plant Tracking**: Maintain a detailed inventory of your plants with photos, nicknames, and species information.
- **Smart Reminders**: Automated scheduling for watering and fertilizing based on configurable intervals.
- **Care History**: Log all care events (watering, fertilizing, repotting) to keep a history of plant health.
- **Pot Inventory**: Manage your collection of pots to easily track which plants are paired with which pots.
- **Species Identification**: Integrated with the **PlantNet API** to automatically identify plant species from uploaded photos.
- **Progressive Web App (PWA)**: Optimized for both desktop and mobile devices, installable on your home screen.

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLModel (SQLAlchemy + Pydantic), PostgreSQL.
- **Frontend**: SvelteKit, TypeScript, TailwindCSS v4, Skeleton UI.
- **Infrastructure**: Docker & Docker Compose for easy deployment.

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- (Optional) Node.js and Python 3.11+ for local development

### Quick Start (Docker)

The easiest way to run Kratzbaum is using Docker Compose.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/kratzbaum.git
   cd kratzbaum
   ```

2. **Start the application:**
   ```bash
   docker compose up -d
   ```
   This will start the PostgreSQL database and the API server.

3. **Access the application:**
   - Frontend: `http://localhost:5173` (If running frontend locally) or configured port through Docker.
   - API Docs: `http://localhost:8000/docs`

4. **Create an admin user:**
   ```bash
   curl -X POST http://localhost:8000/api/auth/setup \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "yourpassword"}'
   ```

### Local Development

#### Backend

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Configuration

The application is configured using environment variables. For production, set these in `backend/app/core/config.py` or your deployment environment.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key |
| `PLANTNET_API_KEY` | Key for PlantNet API (optional, for identification) |
| `VAPID_PRIVATE_KEY` | Web push private key (optional) |
| `VAPID_PUBLIC_KEY` | Web push public key (optional) |

## 📂 Project Structure

```
kratzbaum/
├── backend/          # FastAPI application
├── frontend/         # SvelteKit application
├── docs/             # Detailed documentation
└── GEMINI.md         # Developer guidelines (AI agent context)
```

## 🤝 Contributing

See [GEMINI.md](./GEMINI.md) for detailed development guidelines, coding standards, and architectural decisions.

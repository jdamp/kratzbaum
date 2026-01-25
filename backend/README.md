# Kratzbaum Backend

Plant management system API built with FastAPI.

## Development

```bash
# Install dependencies
uv sync

# Run development server
uv run fastapi dev app/main.py

# Run with specific port
uv run fastapi dev app/main.py --port 8000
```

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql+asyncpg://kratzbaum:kratzbaum@localhost:5432/kratzbaum
SECRET_KEY=your-secret-key-change-in-production
PLANTNET_API_KEY=your-plantnet-api-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key
```

## Initial Setup

1. Start the database (see docker-compose.yml)
2. Run the API
3. Call `POST /api/auth/setup` to create the initial user

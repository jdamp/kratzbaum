"""Kratzbaum API - Main FastAPI application."""

from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, plants, pots, reminders
from app.api import settings as settings_api
from app.core.config import get_settings
from app.core.database import init_db
from app.scheduler.jobs import check_due_reminders

settings = get_settings()

# APScheduler instance
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    await init_db()

    # Ensure upload directories exist
    settings.upload_plants_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_pots_dir.mkdir(parents=True, exist_ok=True)

    # Start scheduler
    scheduler.add_job(
        check_due_reminders,
        CronTrigger(minute="*"),  # Run every minute
        id="reminder_checker",
        replace_existing=True,
    )
    scheduler.start()

    yield

    # Shutdown
    scheduler.shutdown()


app = FastAPI(
    title="Kratzbaum API",
    description="Plant management system API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,  # type: ignore
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(plants.router, prefix="/api")
app.include_router(pots.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

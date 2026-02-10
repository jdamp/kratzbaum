"""Settings API endpoints."""

from datetime import UTC, datetime, time

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models import Settings
from app.services.reminders import update_all_reminders

router = APIRouter(prefix="/settings", tags=["settings"])


class ReminderSettingsResponse(BaseModel):
    """Reminder settings response."""

    default_watering_interval: int | None
    default_fertilizing_interval: int | None
    preferred_reminder_time: time


class ReminderSettingsUpdate(BaseModel):
    """Update reminder settings request."""

    default_watering_interval: int | None = None
    default_fertilizing_interval: int | None = None
    preferred_reminder_time: time | None = None


@router.get("/reminders", response_model=ReminderSettingsResponse)
async def get_reminder_settings(
    db: DbSession,
    _user: CurrentUser,
) -> ReminderSettingsResponse:
    """Get global reminder settings."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = result.first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found. Please run initial setup.",
        )

    return ReminderSettingsResponse(
        default_watering_interval=settings.default_watering_interval,
        default_fertilizing_interval=settings.default_fertilizing_interval,
        preferred_reminder_time=settings.preferred_reminder_time,
    )


@router.put("/reminders", response_model=ReminderSettingsResponse)
async def update_reminder_settings(
    request: ReminderSettingsUpdate,
    db: DbSession,
    _user: CurrentUser,
) -> ReminderSettingsResponse:
    """Update global reminder settings."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = result.first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found. Please run initial setup.",
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.updated_at = datetime.now(UTC)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)

    # Recalculate all reminders
    await update_all_reminders(db)

    return ReminderSettingsResponse(
        default_watering_interval=settings.default_watering_interval,
        default_fertilizing_interval=settings.default_fertilizing_interval,
        preferred_reminder_time=settings.preferred_reminder_time,
    )

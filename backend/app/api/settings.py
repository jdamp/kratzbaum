"""Settings API endpoints."""

from datetime import UTC, datetime, time

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
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


class PlantNetSettingsResponse(BaseModel):
    """PlantNet settings response."""

    is_configured: bool
    masked_api_key: str | None = None
    updated_at: datetime


class PlantNetSettingsUpdate(BaseModel):
    """PlantNet settings update request."""

    api_key: str = Field(min_length=1, max_length=255)


def _mask_api_key(api_key: str) -> str:
    """Return a minimally revealing masked version of an API key."""
    if len(api_key) <= 4:
        return "*" * len(api_key)
    return f"{api_key[:2]}***{api_key[-2:]}"


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


@router.get("/plantnet", response_model=PlantNetSettingsResponse)
async def get_plantnet_settings(
    db: DbSession,
    _user: CurrentUser,
) -> PlantNetSettingsResponse:
    """Get PlantNet API key configuration status."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = result.first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found. Please run initial setup.",
        )

    key = (settings.plantnet_api_key or "").strip()
    return PlantNetSettingsResponse(
        is_configured=bool(key),
        masked_api_key=_mask_api_key(key) if key else None,
        updated_at=settings.updated_at,
    )


@router.put("/plantnet", response_model=PlantNetSettingsResponse)
async def update_plantnet_settings(
    request: PlantNetSettingsUpdate,
    db: DbSession,
    _user: CurrentUser,
) -> PlantNetSettingsResponse:
    """Save or update PlantNet API key."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = result.first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found. Please run initial setup.",
        )

    sanitized_key = request.api_key.strip()
    if not sanitized_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key cannot be empty",
        )

    settings.plantnet_api_key = sanitized_key
    settings.updated_at = datetime.now(UTC)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)

    return PlantNetSettingsResponse(
        is_configured=True,
        masked_api_key=_mask_api_key(sanitized_key),
        updated_at=settings.updated_at,
    )

"""Reminder API endpoints."""

from datetime import datetime, time, timedelta, UTC
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import col, select

from app.api.deps import CurrentUser, DbSession
from app.models import Reminder, ReminderType, FrequencyType, Plant

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderCreate(BaseModel):
    """Create reminder request."""

    plant_id: UUID
    reminder_type: ReminderType
    frequency_type: FrequencyType
    frequency_value: int | None = None
    specific_days: list[int] | None = None
    preferred_time: time


class ReminderUpdate(BaseModel):
    """Update reminder request."""

    frequency_type: FrequencyType | None = None
    frequency_value: int | None = None
    specific_days: list[int] | None = None
    preferred_time: time | None = None
    is_enabled: bool | None = None
    dormant_start: int | None = None
    dormant_end: int | None = None


class ReminderResponse(BaseModel):
    """Reminder response."""

    id: UUID
    plant_id: UUID
    plant_name: str
    reminder_type: ReminderType
    frequency_type: FrequencyType
    frequency_value: int | None
    specific_days: list[int] | None
    preferred_time: time
    is_enabled: bool
    next_due: datetime
    created_at: datetime


class SnoozeRequest(BaseModel):
    """Snooze request."""

    snooze_hours: int = 1


def calculate_next_due(reminder: Reminder, from_date: datetime | None = None) -> datetime:
    """Calculate the next due date for a reminder."""
    base = from_date or datetime.now(UTC)
    
    if reminder.frequency_type == FrequencyType.DAILY:
        next_date = base + timedelta(days=1)
    elif reminder.frequency_type == FrequencyType.INTERVAL:
        days = reminder.frequency_value or 1
        next_date = base + timedelta(days=days)
    elif reminder.frequency_type == FrequencyType.WEEKLY:
        next_date = base + timedelta(weeks=1)
    elif reminder.frequency_type == FrequencyType.SPECIFIC_DAYS:
        # Find next occurrence of specified weekday
        if reminder.specific_days:
            today_weekday = base.weekday()
            days_ahead = min(
                (d - today_weekday) % 7 or 7 for d in reminder.specific_days
            )
            next_date = base + timedelta(days=days_ahead)
        else:
            next_date = base + timedelta(days=1)
    else:
        next_date = base + timedelta(days=1)
    
    # Combine with preferred time
    return next_date.replace(
        hour=reminder.preferred_time.hour,
        minute=reminder.preferred_time.minute,
        second=0,
        microsecond=0,
    )


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    db: DbSession,
    _user: CurrentUser,
) -> list[ReminderResponse]:
    """List all reminders."""
    result = await db.exec(select(Reminder).order_by(Reminder.next_due))
    reminders = result.all()

    responses = []
    for r in reminders:
        plant_result = await db.exec(select(Plant).where(Plant.id == r.plant_id))
        plant = plant_result.first()

        responses.append(
            ReminderResponse(
                id=r.id,
                plant_id=r.plant_id,
                plant_name=plant.name if plant else "Unknown",
                reminder_type=r.reminder_type,
                frequency_type=r.frequency_type,
                frequency_value=r.frequency_value,
                specific_days=r.specific_days,
                preferred_time=r.preferred_time,
                is_enabled=r.is_enabled,
                next_due=r.next_due,
                created_at=r.created_at,
            )
        )

    return responses


@router.get("/upcoming", response_model=list[ReminderResponse])
async def list_upcoming_reminders(
    db: DbSession,
    _user: CurrentUser,
    days: int = 7,
) -> list[ReminderResponse]:
    """List reminders due in the next N days."""
    cutoff = datetime.now(UTC) + timedelta(days=days)
    result = await db.exec(
        select(Reminder)
        .where(Reminder.is_enabled == True, Reminder.next_due <= cutoff)
        .order_by(Reminder.next_due)
    )
    reminders = result.all()

    responses = []
    for r in reminders:
        plant_result = await db.exec(select(Plant).where(Plant.id == r.plant_id))
        plant = plant_result.first()

        responses.append(
            ReminderResponse(
                id=r.id,
                plant_id=r.plant_id,
                plant_name=plant.name if plant else "Unknown",
                reminder_type=r.reminder_type,
                frequency_type=r.frequency_type,
                frequency_value=r.frequency_value,
                specific_days=r.specific_days,
                preferred_time=r.preferred_time,
                is_enabled=r.is_enabled,
                next_due=r.next_due,
                created_at=r.created_at,
            )
        )

    return responses


@router.get("/overdue", response_model=list[ReminderResponse])
async def list_overdue_reminders(
    db: DbSession,
    _user: CurrentUser,
) -> list[ReminderResponse]:
    """List overdue reminders."""
    now = datetime.now(UTC)
    result = await db.exec(
        select(Reminder)
        .where(Reminder.is_enabled == True, Reminder.next_due < now)
        .order_by(Reminder.next_due)
    )
    reminders = result.all()

    responses = []
    for r in reminders:
        plant_result = await db.exec(select(Plant).where(Plant.id == r.plant_id))
        plant = plant_result.first()

        responses.append(
            ReminderResponse(
                id=r.id,
                plant_id=r.plant_id,
                plant_name=plant.name if plant else "Unknown",
                reminder_type=r.reminder_type,
                frequency_type=r.frequency_type,
                frequency_value=r.frequency_value,
                specific_days=r.specific_days,
                preferred_time=r.preferred_time,
                is_enabled=r.is_enabled,
                next_due=r.next_due,
                created_at=r.created_at,
            )
        )

    return responses


@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    request: ReminderCreate,
    db: DbSession,
    _user: CurrentUser,
) -> ReminderResponse:
    """Create a new reminder."""
    # Verify plant exists
    plant_result = await db.exec(select(Plant).where(Plant.id == request.plant_id))
    plant = plant_result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    reminder = Reminder(
        plant_id=request.plant_id,
        reminder_type=request.reminder_type,
        frequency_type=request.frequency_type,
        frequency_value=request.frequency_value,
        specific_days=request.specific_days,
        preferred_time=request.preferred_time,
        next_due=datetime.now(UTC),  # Will be recalculated
    )
    reminder.next_due = calculate_next_due(reminder)

    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    return ReminderResponse(
        id=reminder.id,
        plant_id=reminder.plant_id,
        plant_name=plant.name,
        reminder_type=reminder.reminder_type,
        frequency_type=reminder.frequency_type,
        frequency_value=reminder.frequency_value,
        specific_days=reminder.specific_days,
        preferred_time=reminder.preferred_time,
        is_enabled=reminder.is_enabled,
        next_due=reminder.next_due,
        created_at=reminder.created_at,
    )


@router.put("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: UUID,
    request: ReminderUpdate,
    db: DbSession,
    _user: CurrentUser,
) -> ReminderResponse:
    """Update a reminder."""
    result = await db.exec(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.first()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    if request.frequency_type is not None:
        reminder.frequency_type = request.frequency_type
    if request.frequency_value is not None:
        reminder.frequency_value = request.frequency_value
    if request.specific_days is not None:
        reminder.specific_days = request.specific_days
    if request.preferred_time is not None:
        reminder.preferred_time = request.preferred_time
    if request.is_enabled is not None:
        reminder.is_enabled = request.is_enabled
    if request.dormant_start is not None:
        reminder.dormant_start = request.dormant_start
    if request.dormant_end is not None:
        reminder.dormant_end = request.dormant_end

    reminder.updated_at = datetime.now(UTC)
    reminder.next_due = calculate_next_due(reminder)

    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    plant_result = await db.exec(select(Plant).where(Plant.id == reminder.plant_id))
    plant = plant_result.first()

    return ReminderResponse(
        id=reminder.id,
        plant_id=reminder.plant_id,
        plant_name=plant.name if plant else "Unknown",
        reminder_type=reminder.reminder_type,
        frequency_type=reminder.frequency_type,
        frequency_value=reminder.frequency_value,
        specific_days=reminder.specific_days,
        preferred_time=reminder.preferred_time,
        is_enabled=reminder.is_enabled,
        next_due=reminder.next_due,
        created_at=reminder.created_at,
    )


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """Delete a reminder."""
    result = await db.exec(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.first()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    await db.delete(reminder)
    await db.commit()


@router.post("/{reminder_id}/complete", response_model=ReminderResponse)
async def complete_reminder(
    reminder_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> ReminderResponse:
    """Mark a reminder as complete and reschedule."""
    result = await db.exec(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.first()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    # Reschedule
    reminder.next_due = calculate_next_due(reminder)
    reminder.updated_at = datetime.now(UTC)

    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    plant_result = await db.exec(select(Plant).where(Plant.id == reminder.plant_id))
    plant = plant_result.first()

    return ReminderResponse(
        id=reminder.id,
        plant_id=reminder.plant_id,
        plant_name=plant.name if plant else "Unknown",
        reminder_type=reminder.reminder_type,
        frequency_type=reminder.frequency_type,
        frequency_value=reminder.frequency_value,
        specific_days=reminder.specific_days,
        preferred_time=reminder.preferred_time,
        is_enabled=reminder.is_enabled,
        next_due=reminder.next_due,
        created_at=reminder.created_at,
    )


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: UUID,
    request: SnoozeRequest,
    db: DbSession,
    _user: CurrentUser,
) -> ReminderResponse:
    """Snooze a reminder."""
    result = await db.exec(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.first()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    reminder.next_due = datetime.now(UTC) + timedelta(hours=request.snooze_hours)
    reminder.updated_at = datetime.now(UTC)

    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    plant_result = await db.exec(select(Plant).where(Plant.id == reminder.plant_id))
    plant = plant_result.first()

    return ReminderResponse(
        id=reminder.id,
        plant_id=reminder.plant_id,
        plant_name=plant.name if plant else "Unknown",
        reminder_type=reminder.reminder_type,
        frequency_type=reminder.frequency_type,
        frequency_value=reminder.frequency_value,
        specific_days=reminder.specific_days,
        preferred_time=reminder.preferred_time,
        is_enabled=reminder.is_enabled,
        next_due=reminder.next_due,
        created_at=reminder.created_at,
    )

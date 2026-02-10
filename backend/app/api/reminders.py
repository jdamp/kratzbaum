"""Reminder API endpoints."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models import Plant, Reminder, ReminderType

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderResponse(BaseModel):
    """Reminder response."""

    id: UUID
    plant_id: UUID
    plant_name: str
    reminder_type: ReminderType
    next_due: datetime
    is_enabled: bool
    created_at: datetime


class SnoozeRequest(BaseModel):
    """Snooze request."""

    snooze_hours: int = 24  # Default to 1 day


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    db: DbSession,
    _user: CurrentUser,
    upcoming_only: bool = False,
    days: int = 7,
) -> list[ReminderResponse]:
    """
    List reminders.

    If upcoming_only is True, returns only enabled reminders due within 'days'.
    Otherwise returns all reminders sorted by due date.
    """
    query = select(Reminder)

    if upcoming_only:
        cutoff = datetime.now(UTC) + timedelta(days=days)
        # Filter for enabled and due before cutoff
        query = query.where(
            Reminder.is_enabled == True,  # noqa: E712
            Reminder.next_due <= cutoff
        )

    query = query.order_by(Reminder.next_due)

    result = await db.exec(query)
    reminders = result.all()

    responses = []
    for r in reminders:
        plant_result = await db.exec(select(Plant).where(Plant.id == r.plant_id))
        plant = plant_result.first()

        # If plant is deleted but reminder remains (shouldn't happen with cascade), skip
        if not plant:
            continue

        responses.append(
            ReminderResponse(
                id=r.id,
                plant_id=r.plant_id,
                plant_name=plant.name,
                reminder_type=r.reminder_type,
                next_due=r.next_due,
                is_enabled=r.is_enabled,
                created_at=r.created_at,
            )
        )

    return responses


@router.get("/upcoming", response_model=list[ReminderResponse])
async def list_upcoming_reminders(
    db: DbSession,
    user: CurrentUser,
    days: int = 7,
) -> list[ReminderResponse]:
    """Shortcut for list_reminders with upcoming_only=True."""
    return await list_reminders(db, user, upcoming_only=True, days=days)


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

    # Update next_due
    # NOTE: This overrides the calculated interval-based date.
    # The next care event will reset this to the correct interval.
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
        next_due=reminder.next_due,
        is_enabled=reminder.is_enabled,
        created_at=reminder.created_at,
    )


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """
    delete/disable a reminder.

    Actually, since reminders are auto-calculated, "deleting" it might just
    mean it comes back if we recalculate.
    Ideally, we should toggle `is_enabled=False`.
    But for now, sticking to standard CRUD delete.
    NOTE: If the user refreshes settings or adds care events, it might reappear.
    To permanently disable, they should remove the interval override on the plant/settings.
    """
    result = await db.exec(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.first()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    await db.delete(reminder)
    await db.commit()

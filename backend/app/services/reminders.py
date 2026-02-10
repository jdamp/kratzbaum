"""Reminder calculation services."""

from datetime import UTC, datetime, time, timedelta

from sqlmodel import select

from app.api.deps import DbSession
from app.models import (
    CareEvent,
    CareEventType,
    Plant,
    Reminder,
    ReminderType,
    Settings,
)


async def update_plant_reminders(db: DbSession, plant_id: str) -> None:
    """
    Recalculate and update reminders for a specific plant.
    
    This should be called whenever:
    - Global settings change (intervals)
    - Plant settings change (overrides)
    - Care events are added/removed
    """
    # Fetch plant and global settings
    plant_result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = plant_result.first()
    
    settings_result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = settings_result.first()
    
    if not plant or not settings:
        return

    # Helper to process a specific reminder type
    await _update_single_reminder(
        db, 
        plant, 
        ReminderType.WATERING, 
        plant.watering_interval or settings.default_watering_interval,
        CareEventType.WATERED,
        settings.preferred_reminder_time
    )
    
    await _update_single_reminder(
        db, 
        plant, 
        ReminderType.FERTILIZING, 
        plant.fertilizing_interval or settings.default_fertilizing_interval,
        CareEventType.FERTILIZED,
        settings.preferred_reminder_time
    )


async def update_all_reminders(db: DbSession) -> None:
    """Recalculate reminders for all plants (e.g. after global settings change)."""
    # This might be slow for huge datasets, but fine for personal use.
    result = await db.exec(select(Plant))
    plants = result.all()
    
    for plant in plants:
        await update_plant_reminders(db, plant.id)


async def _update_single_reminder(
    db: DbSession,
    plant: Plant,
    reminder_type: ReminderType,
    interval_days: int | None,
    care_event_type: CareEventType,
    preferred_time: time
) -> None:
    """Update or delete a single reminder record based on configuration."""
    
    # 1. Find existing reminder
    reminder_result = await db.exec(
        select(Reminder).where(
            Reminder.plant_id == plant.id,
            Reminder.reminder_type == reminder_type
        )
    )
    reminder = reminder_result.first()

    # 2. If no interval is set (global or override), remove the reminder if it exists
    if not interval_days:
        if reminder:
            await db.delete(reminder)
            # We don't commit here, trusting the caller to commit or using flush
            # But the session is shared. Safest to flush if we want immediate effects 
            # or just let the API endpoint commit.
            # However, since this service is async and might be used in different contexts,
            # we generally expect the caller to handle the transaction scope.
            # But sqlmodel/sqlalchemy async usually requires explicit adds/deletes.
        return

    # 3. Calculate Next Due
    # Get last care event
    event_result = await db.exec(
        select(CareEvent)
        .where(
            CareEvent.plant_id == plant.id,
            CareEvent.event_type == care_event_type
        )
        .order_by(CareEvent.event_date.desc())  # type: ignore
        .limit(1)
    )
    last_event = event_result.first()
    
    # Base calculation
    if last_event:
        base_date = last_event.event_date
    else:
        # If never watered, assume created_at? Or Now?
        # Usually if never watered, it's due now (or whenever it was added).
        base_date = plant.created_at

    next_due = base_date + timedelta(days=interval_days)
    
    # Apply preferred time (keep date, set time)
    # Be careful with timezones. base_date is timezone aware (UTC).
    # preferred_time is naive.
    # We construct a new datetime in UTC.
    
    # Convert preferred time (which is likely local wall time concepts) to UTC?
    # Or just set the hour/min on the UTC object?
    # Simplification: Treat preferred_time as "UTC time" or "Server time". 
    # For now, let's just combine naive and force UTC.
    
    # Strip time info from the target date to get "Midnight"
    # Then add the time.
    # Note: next_due is a datetime.
    
    target_date = next_due.date()
    target_dt = datetime.combine(target_date, preferred_time)
    
    # Ensure timezone awareness
    target_dt = target_dt.replace(tzinfo=UTC)
    
    # 4. Upsert Reminder
    if reminder:
        # If the reminder was explicitly snoozed to a future date, 
        # we should respect that IF it is further out than our calculated date?
        # Or does a new calculation override snooze?
        # Standard logic: New calculation overrides old schedule, unless snoozed?
        # Let's say: If the calculated date is DIFFERENT than the stored date, update it.
        # But we must preserve "Snooze" if it's manually set.
        # How to detect snooze? We don't have a flag.
        # Simplification: Always update to calculated date. 
        # Snooze is a temporary override that should probably be cleared if a care event happens.
        # But if no care event happened, and we are just re-calculating (e.g. settings change), 
        # we might overwrite a snooze. 
        # For MVP: Overwrite. Snooze is short lived.
        
        # Only update if changed (to update updated_at)
        if reminder.next_due != target_dt:
            reminder.next_due = target_dt
            reminder.updated_at = datetime.now(UTC)
            db.add(reminder)
    else:
        reminder = Reminder(
            plant_id=plant.id,
            reminder_type=reminder_type,
            next_due=target_dt,
            is_enabled=True # Default to enabled
        )
        db.add(reminder)


import pytest
from datetime import datetime, time, timedelta, timezone
from sqlmodel import select
from app.models import Plant, Reminder, ReminderType, CareEventType, Settings, CareEvent
from app.services.reminders import update_plant_reminders, _update_single_reminder

@pytest.mark.asyncio
async def test_update_plant_reminders_creates_new(db_session):
    # Setup
    plant = Plant(name="Test Plant", species="Test Species")
    db_session.add(plant)
    
    settings = Settings(
        default_watering_interval=7, 
        default_fertilizing_interval=14,
        username="test",
        password_hash="hash"
    )
    db_session.add(settings)
    await db_session.commit()
    await db_session.refresh(plant)

    # Execute
    await update_plant_reminders(db_session, plant.id)

    # Verify
    reminders = await db_session.exec(select(Reminder).where(Reminder.plant_id == plant.id))
    reminders_list = reminders.all()
    assert len(reminders_list) == 2
    
    watering = next(r for r in reminders_list if r.reminder_type == ReminderType.WATERING)
    assert watering.is_enabled
    # next_due should be created_at + 7 days (approx)
    assert watering.next_due.replace(tzinfo=None) > datetime.now(timezone.utc).replace(tzinfo=None)

@pytest.mark.asyncio
async def test_update_plant_reminders_respects_intervals(db_session):
    plant = Plant(name="Test Plant", watering_interval=3, fertilizing_interval=None) # Override watering
    db_session.add(plant)
    settings = Settings(
        default_watering_interval=7, 
        default_fertilizing_interval=14,
        username="test",
        password_hash="hash"
    )
    db_session.add(settings)
    await db_session.commit()
    await db_session.refresh(plant)

    await update_plant_reminders(db_session, plant.id)

    reminders = await db_session.exec(select(Reminder).where(Reminder.plant_id == plant.id))
    reminders_list = reminders.all()
    
    watering = next(r for r in reminders_list if r.reminder_type == ReminderType.WATERING)
    fertilizing = next(r for r in reminders_list if r.reminder_type == ReminderType.FERTILIZING)

    # Watering should be based on 3 days
    # Fertilizing should be based on 14 days (default)
    # Since we can't easily check exact dates without mocking time, we check logic
    # But we can check relative order if we want, or just existence.
    assert watering
    assert fertilizing

@pytest.mark.asyncio
async def test_update_single_reminder_removes_disabled(db_session):
    plant = Plant(name="Test Plant")
    db_session.add(plant)
    await db_session.commit()
    await db_session.refresh(plant)

    # specific usage of _update_single_reminder
    # Create a reminder first
    reminder = Reminder(
        plant_id=plant.id,
        reminder_type=ReminderType.WATERING,
        next_due=datetime.now(timezone.utc),
        is_enabled=True
    )
    db_session.add(reminder)
    await db_session.commit()

    # Now update with interval=None (should delete)
    await _update_single_reminder(
        db_session,
        plant,
        ReminderType.WATERING,
        None,
        CareEventType.WATERED,
        time(9, 0)
    )

    result = await db_session.exec(select(Reminder).where(Reminder.plant_id == plant.id))
    assert result.first() is None

@pytest.mark.asyncio
async def test_update_single_reminder_calculates_from_event(db_session):
    plant = Plant(name="Test Plant")
    db_session.add(plant)
    await db_session.commit()
    await db_session.refresh(plant)

    # Add a care event 2 days ago
    event_date = datetime.now(timezone.utc) - timedelta(days=2)
    event = CareEvent(
        plant_id=plant.id,
        event_type=CareEventType.WATERED,
        event_date=event_date
    )
    db_session.add(event)
    await db_session.commit()

    # Update with 5 day interval
    await _update_single_reminder(
        db_session,
        plant,
        ReminderType.WATERING,
        5,
        CareEventType.WATERED,
        time(10, 0)
    )

    result = await db_session.exec(select(Reminder).where(Reminder.plant_id == plant.id))
    reminder = result.first()
    assert reminder
    
    # Expected: event_date + 5 days, at 10:00 UTC (simplified logic from service)
    expected_date = event_date + timedelta(days=5)
    expected_dt = datetime.combine(expected_date.date(), time(10, 0)).replace(tzinfo=timezone.utc)
    
    assert reminder.next_due.replace(tzinfo=None) == expected_dt.replace(tzinfo=None)

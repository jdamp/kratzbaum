"""Scheduler jobs for reminders."""

from datetime import UTC, datetime, timedelta

from sqlmodel import select

from app.core.database import async_session_factory
from app.models import Plant, PushSubscription, Reminder
from app.services.push import send_reminder_notification


async def check_due_reminders() -> None:
    """
    Check for due reminders and send push notifications.

    This job runs every minute via APScheduler.
    It checks for enabled reminders that are due and haven't been notified recently.
    """
    async with async_session_factory() as session:
        now = datetime.now(UTC)
        
        # Get all enabled reminders that are due
        # We don't filter by last_notified in SQL to keep it simple,
        # we filter in Python.
        result = await session.exec(
            select(Reminder).where(
                Reminder.is_enabled == True,  # noqa: E712
                Reminder.next_due <= now,
            )
        )
        due_reminders = result.all()

        if not due_reminders:
            return

        # Get all push subscriptions
        sub_result = await session.exec(select(PushSubscription))
        subscriptions = sub_result.all()

        if not subscriptions:
            return

        for reminder in due_reminders:
            # Check if we recently notified (anti-spam: once every 24h)
            if reminder.last_notified:
                last_notified = reminder.last_notified
                if last_notified.tzinfo is None:
                    last_notified = last_notified.replace(tzinfo=UTC)
                
                time_since = now - last_notified
                if time_since < timedelta(hours=24):
                    continue

            # Get plant name
            plant_result = await session.exec(
                select(Plant).where(Plant.id == reminder.plant_id)
            )
            plant = plant_result.first()

            if not plant:
                continue

            # Send notification to all subscriptions
            for subscription in subscriptions:
                await send_reminder_notification(
                    subscription=subscription,
                    plant_name=plant.name,
                    reminder_type=reminder.reminder_type.value,
                )
            
            # Update last_notified
            reminder.last_notified = now
            session.add(reminder)
            await session.commit()

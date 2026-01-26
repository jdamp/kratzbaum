"""Scheduler jobs for reminders."""

from datetime import UTC, datetime

from sqlmodel import select

from app.core.database import async_session_factory
from app.models import Plant, PushSubscription, Reminder
from app.services.push import send_reminder_notification


async def check_due_reminders() -> None:
    """
    Check for due reminders and send push notifications.

    This job runs every minute via APScheduler.
    """
    async with async_session_factory() as session:
        # Get all enabled reminders that are due
        now = datetime.now(UTC)
        result = await session.exec(
            select(Reminder).where(
                Reminder.is_enabled,
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

            # Note: The reminder's next_due is NOT automatically updated here.
            # The user should mark the reminder as complete via the API,
            # which will trigger the reschedule.

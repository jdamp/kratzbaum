
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Plant, PushSubscription, Reminder, ReminderType
from app.scheduler.jobs import check_due_reminders


@pytest.fixture
def mock_session_factory(db_session):
    # Mock the session factory to return our db_session
    context_manager = MagicMock()
    context_manager.__aenter__ = AsyncMock(return_value=db_session)
    context_manager.__aexit__ = AsyncMock(return_value=None)

    # The factory itself is called to get the context manager
    factory = MagicMock(return_value=context_manager)
    return factory

@pytest.mark.asyncio
async def test_check_due_reminders_no_reminders(db_session, mock_session_factory):
    with patch("app.scheduler.jobs.async_session_factory", mock_session_factory):
        await check_due_reminders()
        # Should complete without error

@pytest.mark.asyncio
async def test_check_due_reminders_sends_notification(db_session, mock_session_factory):
    # Setup
    plant = Plant(name="Test Plant", species="Fern")
    db_session.add(plant)

    # Add subscription
    sub = PushSubscription(endpoint="https://push.example.com", p256dh_key="key", auth_key="auth")
    db_session.add(sub)

    await db_session.commit()
    await db_session.refresh(plant)

    # Add due reminder
    due_time = datetime.now(UTC) - timedelta(minutes=10)
    reminder = Reminder(
        plant_id=plant.id,
        reminder_type=ReminderType.WATERING,
        next_due=due_time,
        is_enabled=True
    )
    db_session.add(reminder)

    await db_session.commit()

    # Mock send_reminder_notification
    with patch("app.scheduler.jobs.async_session_factory", mock_session_factory), \
         patch("app.scheduler.jobs.send_reminder_notification",
               new_callable=AsyncMock) as mock_send:

        await check_due_reminders()

        # Verify notification sent
        mock_send.assert_called_once()
        call_args = mock_send.call_args[1]
        assert call_args["plant_name"] == "Test Plant"
        assert call_args["reminder_type"] == "WATERING"

        # Verify reminder updated
        await db_session.refresh(reminder)
        assert reminder.last_notified is not None
        # Should be recent (handle naive/aware mismatch from sqlite)
        last_notified = reminder.last_notified
        if last_notified.tzinfo is None:
            last_notified = last_notified.replace(tzinfo=UTC)

        assert (datetime.now(UTC) - last_notified) < timedelta(seconds=10)

@pytest.mark.asyncio
async def test_check_due_reminders_spam_prevention(db_session, mock_session_factory):
    # Setup
    plant = Plant(name="Test Plant")
    db_session.add(plant)
    sub = PushSubscription(endpoint="https://push.example.com", p256dh_key="key", auth_key="auth")
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(plant)

    # Reminder notified 1 hour ago
    last_notified = datetime.now(UTC) - timedelta(hours=1)
    reminder = Reminder(
        plant_id=plant.id,
        reminder_type=ReminderType.WATERING,
        next_due=datetime.now(UTC) - timedelta(hours=2),
        is_enabled=True,
        last_notified=last_notified
    )
    db_session.add(reminder)
    await db_session.commit()

    with patch("app.scheduler.jobs.async_session_factory", mock_session_factory), \
         patch("app.scheduler.jobs.send_reminder_notification",
               new_callable=AsyncMock) as mock_send:

        await check_due_reminders()

        # Should verify that NO notification was sent (spam prevention < 24h)
        mock_send.assert_not_called()

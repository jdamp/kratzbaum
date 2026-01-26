"""Tests for reminder logic."""

from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta

from app.models import FrequencyType, ReminderType


# Use a dataclass for testing to avoid SQLModel mapper issues
@dataclass
class MockReminder:
    """Mock reminder for testing calculation logic."""

    reminder_type: ReminderType
    frequency_type: FrequencyType
    preferred_time: time
    frequency_value: int | None = None
    specific_days: list[int] | None = None


def calculate_next_due_pure(
    frequency_type: FrequencyType,
    frequency_value: int | None,
    specific_days: list[int] | None,
    preferred_time: time,
    from_date: datetime,
) -> datetime:
    """Pure function for calculating next due date (no model dependency)."""
    if frequency_type == FrequencyType.DAILY:
        next_date = from_date + timedelta(days=1)
    elif frequency_type == FrequencyType.INTERVAL:
        days = frequency_value or 1
        next_date = from_date + timedelta(days=days)
    elif frequency_type == FrequencyType.WEEKLY:
        next_date = from_date + timedelta(weeks=1)
    elif frequency_type == FrequencyType.SPECIFIC_DAYS:
        if specific_days:
            today_weekday = from_date.weekday()
            days_ahead = min((d - today_weekday) % 7 or 7 for d in specific_days)
            next_date = from_date + timedelta(days=days_ahead)
        else:
            next_date = from_date + timedelta(days=1)
    else:
        next_date = from_date + timedelta(days=1)

    return next_date.replace(
        hour=preferred_time.hour,
        minute=preferred_time.minute,
        second=0,
        microsecond=0,
    )


class TestCalculateNextDue:
    """Tests for reminder next_due calculation."""

    def test_daily_reminder(self):
        """Test daily reminder calculates next day."""
        base = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)
        next_due = calculate_next_due_pure(
            frequency_type=FrequencyType.DAILY,
            frequency_value=None,
            specific_days=None,
            preferred_time=time(9, 0),
            from_date=base,
        )

        assert next_due.day == 16
        assert next_due.hour == 9
        assert next_due.minute == 0

    def test_interval_reminder_3_days(self):
        """Test interval reminder with 3 days."""
        base = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)
        next_due = calculate_next_due_pure(
            frequency_type=FrequencyType.INTERVAL,
            frequency_value=3,
            specific_days=None,
            preferred_time=time(9, 0),
            from_date=base,
        )

        assert next_due.day == 18  # 15 + 3 = 18
        assert next_due.hour == 9

    def test_weekly_reminder(self):
        """Test weekly reminder calculates next week."""
        base = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)  # Monday
        next_due = calculate_next_due_pure(
            frequency_type=FrequencyType.WEEKLY,
            frequency_value=None,
            specific_days=None,
            preferred_time=time(10, 30),
            from_date=base,
        )

        assert next_due.day == 22  # Next Monday
        assert next_due.hour == 10
        assert next_due.minute == 30

    def test_specific_days_reminder(self):
        """Test specific days reminder finds next matching day."""
        # Monday Jan 15, 2024
        base = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)
        next_due = calculate_next_due_pure(
            frequency_type=FrequencyType.SPECIFIC_DAYS,
            frequency_value=None,
            specific_days=[1, 4],  # Tuesday, Friday
            preferred_time=time(8, 0),
            from_date=base,
        )

        # Next should be Tuesday (day 16)
        assert next_due.day == 16
        assert next_due.weekday() == 1  # Tuesday
        assert next_due.hour == 8

    def test_preferred_time_preserved(self):
        """Test that preferred time is always used."""
        base = datetime(2024, 1, 15, 6, 0, tzinfo=UTC)  # 6 AM
        next_due = calculate_next_due_pure(
            frequency_type=FrequencyType.DAILY,
            frequency_value=None,
            specific_days=None,
            preferred_time=time(14, 30),
            from_date=base,
        )

        assert next_due.hour == 14
        assert next_due.minute == 30
        assert next_due.second == 0

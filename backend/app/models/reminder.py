"""Reminder model."""

from datetime import datetime, time, UTC
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel


class ReminderType(str, Enum):
    """Types of reminders."""

    WATERING = "WATERING"
    FERTILIZING = "FERTILIZING"


class FrequencyType(str, Enum):
    """Frequency types for reminders."""

    DAILY = "DAILY"
    INTERVAL = "INTERVAL"
    WEEKLY = "WEEKLY"
    SPECIFIC_DAYS = "SPECIFIC_DAYS"


class Reminder(SQLModel, table=True):
    """A reminder for plant care."""

    __tablename__ = "reminders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plant_id: UUID = Field(foreign_key="plants.id", index=True)
    reminder_type: ReminderType
    frequency_type: FrequencyType
    frequency_value: int | None = Field(default=None)  # Days interval
    specific_days: list[int] | None = Field(
        default=None, sa_column=Column(JSONB)
    )  # Weekdays 0-6
    preferred_time: time
    is_enabled: bool = Field(default=True)
    dormant_start: int | None = Field(default=None)  # Month 1-12
    dormant_end: int | None = Field(default=None)  # Month 1-12
    next_due: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    plant: "Plant" = Relationship(back_populates="reminders")


# Avoid circular imports
from app.models.plant import Plant  # noqa: E402

Reminder.model_rebuild()

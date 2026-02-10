"""Reminder model."""

from datetime import UTC, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel


class ReminderType(str, Enum):
    """Types of reminders."""

    WATERING = "WATERING"
    FERTILIZING = "FERTILIZING"


class Reminder(SQLModel, table=True):
    """A reminder for plant care, calculated from care events and intervals."""

    __tablename__ = "reminders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plant_id: UUID = Field(foreign_key="plants.id", index=True)
    reminder_type: ReminderType
    next_due: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    is_enabled: bool = Field(default=True)
    last_notified: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    # Relationships
    plant: "Plant" = Relationship(back_populates="reminders")


# Avoid circular imports
from app.models.plant import Plant  # noqa: E402

Reminder.model_rebuild()

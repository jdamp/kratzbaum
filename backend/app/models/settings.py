"""Single-user authentication and app settings model."""

from datetime import UTC, datetime, time

from sqlalchemy import Column, DateTime, Time

from sqlmodel import Field, SQLModel


class Settings(SQLModel, table=True):
    """Single-user auth and app settings (singleton row with id=1)."""

    __tablename__ = "settings"

    id: int = Field(default=1, primary_key=True)
    username: str = Field(max_length=50)
    password_hash: str = Field(max_length=255)

    # Global reminder settings
    default_watering_interval: int | None = Field(default=None)
    default_fertilizing_interval: int | None = Field(default=None)
    preferred_reminder_time: time = Field(
        default=time(9, 0),
        sa_column=Column(Time, nullable=False),
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

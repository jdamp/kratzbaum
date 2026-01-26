"""Single-user authentication settings model."""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Settings(SQLModel, table=True):
    """Single-user auth settings (singleton row with id=1)."""

    __tablename__ = "settings"

    id: int = Field(default=1, primary_key=True)
    username: str = Field(max_length=50)
    password_hash: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))

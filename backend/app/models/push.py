"""PushSubscription model."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime

from sqlmodel import Field, SQLModel


class PushSubscription(SQLModel, table=True):
    """A web push notification subscription."""

    __tablename__ = "push_subscriptions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    endpoint: str = Field(max_length=500, unique=True, index=True)
    p256dh_key: str = Field(max_length=255)
    auth_key: str = Field(max_length=255)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

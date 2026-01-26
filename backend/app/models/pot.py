"""Pot and PotPhoto models."""

from datetime import UTC, datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel


class Pot(SQLModel, table=True):
    """A pot for plants."""

    __tablename__ = "pots"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=100)
    diameter_cm: float
    height_cm: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    photos: list["PotPhoto"] = Relationship(
        back_populates="pot",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    plant: Optional["Plant"] = Relationship(back_populates="pot")


class PotPhoto(SQLModel, table=True):
    """A photo of a pot."""

    __tablename__ = "pot_photos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    pot_id: UUID = Field(foreign_key="pots.id", index=True)
    file_path: str = Field(max_length=500)
    is_primary: bool = Field(default=False)
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    pot: Pot = Relationship(back_populates="photos")


# Avoid circular imports
from app.models.plant import Plant  # noqa: E402

Pot.model_rebuild()

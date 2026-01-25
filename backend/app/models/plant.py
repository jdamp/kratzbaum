"""Plant, PlantPhoto, and CareEvent models."""

from datetime import datetime, UTC
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel


class CareEventType(str, Enum):
    """Types of care events."""

    WATERED = "WATERED"
    FERTILIZED = "FERTILIZED"
    REPOTTED = "REPOTTED"


class Plant(SQLModel, table=True):
    """A plant in the user's collection."""

    __tablename__ = "plants"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    pot_id: UUID | None = Field(default=None, foreign_key="pots.id")
    name: str = Field(max_length=100, index=True)
    species: str | None = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    pot: "Pot | None" = Relationship(back_populates="plant")
    photos: list["PlantPhoto"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    care_events: list["CareEvent"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    reminders: list["Reminder"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class PlantPhoto(SQLModel, table=True):
    """A photo of a plant."""

    __tablename__ = "plant_photos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plant_id: UUID = Field(foreign_key="plants.id", index=True)
    file_path: str = Field(max_length=500)
    is_primary: bool = Field(default=False)
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    plant: Plant = Relationship(back_populates="photos")


class CareEvent(SQLModel, table=True):
    """A care event for a plant (watering, fertilizing, repotting)."""

    __tablename__ = "care_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plant_id: UUID = Field(foreign_key="plants.id", index=True)
    event_type: CareEventType
    event_date: datetime
    notes: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Relationships
    plant: Plant = Relationship(back_populates="care_events")


# Avoid circular imports
from app.models.pot import Pot  # noqa: E402
from app.models.reminder import Reminder  # noqa: E402

Plant.model_rebuild()

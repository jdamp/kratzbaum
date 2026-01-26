"""PlantIdentification model."""

from datetime import UTC, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class OrganType(str, Enum):
    """Plant organ types for identification."""

    LEAF = "LEAF"
    FLOWER = "FLOWER"
    FRUIT = "FRUIT"
    BARK = "BARK"


class PlantIdentification(SQLModel, table=True):
    """A plant identification request and result."""

    __tablename__ = "plant_identifications"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plant_id: UUID | None = Field(default=None, foreign_key="plants.id", index=True)
    photo_path: str = Field(max_length=500)
    organ: OrganType
    results: dict = Field(default_factory=dict, sa_column=Column(JSON))
    selected_species: str | None = Field(default=None, max_length=200)
    requested_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

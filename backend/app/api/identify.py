"""Plant identification API endpoints."""

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models import Settings
from app.services.plantnet import identify_plant

router = APIRouter(prefix="/identify", tags=["identify"])

ALLOWED_ORGANS = {"leaf", "flower", "fruit", "bark"}


class IdentificationResult(BaseModel):
    """Single identification candidate."""

    score: float
    scientific_name: str
    common_names: list[str] = Field(default_factory=list)
    family: str
    genus: str


class IdentifyResponse(BaseModel):
    """Plant identification response."""

    results: list[IdentificationResult] = Field(default_factory=list)
    error: str | None = None
    error_code: str | None = None
    remaining_identifications: int | None = None


@router.post("", response_model=IdentifyResponse)
async def identify(
    _user: CurrentUser,
    db: DbSession,
    image: Annotated[UploadFile, File(...)],
    organ: Annotated[str, Form()] = "leaf",
) -> IdentifyResponse:
    """Identify plant species from an uploaded image using PlantNet."""
    normalized_organ = organ.strip().lower()
    if normalized_organ not in ALLOWED_ORGANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organ. Use one of: leaf, flower, fruit, bark",
        )

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an image.",
        )

    image_data = await image.read()
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    settings_result = await db.exec(select(Settings).where(Settings.id == 1))
    settings = settings_result.first()
    api_key = settings.plantnet_api_key if settings else None

    result = await identify_plant(
        image_data=image_data,
        organ=normalized_organ,
        api_key=api_key,
    )
    return IdentifyResponse.model_validate(result)

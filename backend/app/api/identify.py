"""Plant identification API endpoints."""

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser
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
    remaining_identifications: int | None = None


@router.post("", response_model=IdentifyResponse)
async def identify(
    _user: CurrentUser,
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

    result = await identify_plant(image_data=image_data, organ=normalized_organ)
    return IdentifyResponse.model_validate(result)

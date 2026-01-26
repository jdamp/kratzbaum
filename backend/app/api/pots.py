"""Pot API endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models import Plant, Pot, PotPhoto
from app.services.files import save_upload_file

router = APIRouter(prefix="/pots", tags=["pots"])


class PotCreate(BaseModel):
    """Create pot request."""

    name: str
    diameter_cm: float
    height_cm: float


class PotUpdate(BaseModel):
    """Update pot request."""

    name: str | None = None
    diameter_cm: float | None = None
    height_cm: float | None = None


class PotPhotoResponse(BaseModel):
    """Photo response."""

    id: UUID
    url: str
    is_primary: bool
    uploaded_at: datetime


class PotResponse(BaseModel):
    """Pot response."""

    id: UUID
    name: str
    diameter_cm: float
    height_cm: float
    primary_photo_url: str | None
    plant_id: UUID | None
    plant_name: str | None
    created_at: datetime


class PotDetailResponse(PotResponse):
    """Pot detail response."""

    photos: list[PotPhotoResponse]


@router.get("", response_model=list[PotResponse])
async def list_pots(
    db: DbSession,
    _user: CurrentUser,
) -> list[PotResponse]:
    """List all pots."""
    result = await db.exec(select(Pot))
    pots = result.all()

    responses = []
    for pot in pots:
        # Get primary photo
        photo_result = await db.exec(
            select(PotPhoto).where(PotPhoto.pot_id == pot.id, PotPhoto.is_primary)
        )
        primary_photo = photo_result.first()

        # Check if assigned to a plant
        plant_result = await db.exec(select(Plant).where(Plant.pot_id == pot.id))
        plant = plant_result.first()

        responses.append(
            PotResponse(
                id=pot.id,
                name=pot.name,
                diameter_cm=pot.diameter_cm,
                height_cm=pot.height_cm,
                primary_photo_url=f"/uploads/pots/{primary_photo.file_path}"
                if primary_photo
                else None,
                plant_id=plant.id if plant else None,
                plant_name=plant.name if plant else None,
                created_at=pot.created_at,
            )
        )

    return responses


@router.get("/available", response_model=list[PotResponse])
async def list_available_pots(
    db: DbSession,
    _user: CurrentUser,
) -> list[PotResponse]:
    """List pots not assigned to any plant."""
    # Get all pot IDs that are assigned to plants
    assigned_result = await db.exec(
        select(Plant.pot_id).where(Plant.pot_id.is_not(None))  # type: ignore
    )
    assigned_pot_ids = set(assigned_result.all())

    # Get all pots
    result = await db.exec(select(Pot))
    pots = result.all()

    responses = []
    for pot in pots:
        if pot.id in assigned_pot_ids:
            continue

        photo_result = await db.exec(
            select(PotPhoto).where(PotPhoto.pot_id == pot.id, PotPhoto.is_primary)
        )
        primary_photo = photo_result.first()

        responses.append(
            PotResponse(
                id=pot.id,
                name=pot.name,
                diameter_cm=pot.diameter_cm,
                height_cm=pot.height_cm,
                primary_photo_url=f"/uploads/pots/{primary_photo.file_path}"
                if primary_photo
                else None,
                plant_id=None,
                plant_name=None,
                created_at=pot.created_at,
            )
        )

    return responses


@router.post("", response_model=PotResponse, status_code=status.HTTP_201_CREATED)
async def create_pot(
    request: PotCreate,
    db: DbSession,
    _user: CurrentUser,
) -> PotResponse:
    """Create a new pot."""
    pot = Pot(
        name=request.name,
        diameter_cm=request.diameter_cm,
        height_cm=request.height_cm,
    )
    db.add(pot)
    await db.commit()
    await db.refresh(pot)

    return PotResponse(
        id=pot.id,
        name=pot.name,
        diameter_cm=pot.diameter_cm,
        height_cm=pot.height_cm,
        primary_photo_url=None,
        plant_id=None,
        plant_name=None,
        created_at=pot.created_at,
    )


@router.get("/{pot_id}", response_model=PotDetailResponse)
async def get_pot(
    pot_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> PotDetailResponse:
    """Get pot details."""
    result = await db.exec(select(Pot).where(Pot.id == pot_id))
    pot = result.first()

    if not pot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pot not found",
        )

    # Get photos
    photos_result = await db.exec(select(PotPhoto).where(PotPhoto.pot_id == pot_id))
    photos = photos_result.all()

    # Check if assigned to a plant
    plant_result = await db.exec(select(Plant).where(Plant.pot_id == pot.id))
    plant = plant_result.first()

    primary_photo = next((p for p in photos if p.is_primary), None)

    return PotDetailResponse(
        id=pot.id,
        name=pot.name,
        diameter_cm=pot.diameter_cm,
        height_cm=pot.height_cm,
        primary_photo_url=f"/uploads/pots/{primary_photo.file_path}"
        if primary_photo
        else None,
        plant_id=plant.id if plant else None,
        plant_name=plant.name if plant else None,
        created_at=pot.created_at,
        photos=[
            PotPhotoResponse(
                id=p.id,
                url=f"/uploads/pots/{p.file_path}",
                is_primary=p.is_primary,
                uploaded_at=p.uploaded_at,
            )
            for p in photos
        ],
    )


@router.put("/{pot_id}", response_model=PotResponse)
async def update_pot(
    pot_id: UUID,
    request: PotUpdate,
    db: DbSession,
    _user: CurrentUser,
) -> PotResponse:
    """Update a pot."""
    result = await db.exec(select(Pot).where(Pot.id == pot_id))
    pot = result.first()

    if not pot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pot not found",
        )

    if request.name is not None:
        pot.name = request.name
    if request.diameter_cm is not None:
        pot.diameter_cm = request.diameter_cm
    if request.height_cm is not None:
        pot.height_cm = request.height_cm

    pot.updated_at = datetime.now(UTC)
    db.add(pot)
    await db.commit()
    await db.refresh(pot)

    # Get primary photo
    photo_result = await db.exec(
        select(PotPhoto).where(PotPhoto.pot_id == pot.id, PotPhoto.is_primary)
    )
    primary_photo = photo_result.first()

    # Check if assigned to a plant
    plant_result = await db.exec(select(Plant).where(Plant.pot_id == pot.id))
    plant = plant_result.first()

    return PotResponse(
        id=pot.id,
        name=pot.name,
        diameter_cm=pot.diameter_cm,
        height_cm=pot.height_cm,
        primary_photo_url=f"/uploads/pots/{primary_photo.file_path}"
        if primary_photo
        else None,
        plant_id=plant.id if plant else None,
        plant_name=plant.name if plant else None,
        created_at=pot.created_at,
    )


@router.delete("/{pot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pot(
    pot_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """Delete a pot."""
    result = await db.exec(select(Pot).where(Pot.id == pot_id))
    pot = result.first()

    if not pot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pot not found",
        )

    # Check if assigned to a plant
    plant_result = await db.exec(select(Plant).where(Plant.pot_id == pot.id))
    plant = plant_result.first()

    if plant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pot is assigned to plant '{plant.name}'. Unassign it first.",
        )

    await db.delete(pot)
    await db.commit()


@router.post("/{pot_id}/photos", response_model=PotPhotoResponse)
async def upload_photo(
    pot_id: UUID,
    file: UploadFile,
    db: DbSession,
    _user: CurrentUser,
    is_primary: bool = False,
) -> PotPhotoResponse:
    """Upload a photo for a pot."""
    result = await db.exec(select(Pot).where(Pot.id == pot_id))
    pot = result.first()

    if not pot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pot not found",
        )

    file_path = await save_upload_file(file, "pots")

    if is_primary:
        photos_result = await db.exec(
            select(PotPhoto).where(PotPhoto.pot_id == pot_id, PotPhoto.is_primary)
        )
        for photo in photos_result.all():
            photo.is_primary = False
            db.add(photo)

    photo = PotPhoto(
        pot_id=pot_id,
        file_path=file_path,
        is_primary=is_primary,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return PotPhotoResponse(
        id=photo.id,
        url=f"/uploads/pots/{photo.file_path}",
        is_primary=photo.is_primary,
        uploaded_at=photo.uploaded_at,
    )

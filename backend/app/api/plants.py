"""Plant API endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlmodel import col, select

from app.api.deps import CurrentUser, DbSession
from app.models import CareEvent, CareEventType, Plant, PlantPhoto
from app.services.files import save_upload_file

router = APIRouter(prefix="/plants", tags=["plants"])


# Request/Response models
class PlantCreate(BaseModel):
    """Create plant request."""

    name: str
    species: str | None = None
    pot_id: UUID | None = None


class PlantUpdate(BaseModel):
    """Update plant request."""

    name: str | None = None
    species: str | None = None
    pot_id: UUID | None = None


class PlantPhotoResponse(BaseModel):
    """Photo response."""

    id: UUID
    url: str
    is_primary: bool
    uploaded_at: datetime


class PlantResponse(BaseModel):
    """Plant response."""

    id: UUID
    name: str
    species: str | None
    pot_id: UUID | None
    primary_photo_url: str | None
    created_at: datetime
    updated_at: datetime


class PlantDetailResponse(PlantResponse):
    """Plant detail response."""

    photos: list[PlantPhotoResponse]
    last_watered: datetime | None
    last_fertilized: datetime | None
    last_repotted: datetime | None


class CareEventCreate(BaseModel):
    """Create care event request."""

    event_type: CareEventType
    event_date: datetime | None = None
    notes: str | None = None


class CareEventResponse(BaseModel):
    """Care event response."""

    id: UUID
    event_type: CareEventType
    event_date: datetime
    notes: str | None
    created_at: datetime


@router.get("", response_model=list[PlantResponse])
async def list_plants(
    db: DbSession,
    _user: CurrentUser,
    sort: str = Query("name", pattern="^(name|species|created_at)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    search: str | None = Query(None),
) -> list[PlantResponse]:
    """List all plants with optional sorting and search."""
    query = select(Plant)

    if search:
        query = query.where(col(Plant.name).ilike(f"%{search}%"))

    # Apply sorting
    sort_col = getattr(Plant, sort)
    if order == "desc":
        query = query.order_by(col(sort_col).desc())
    else:
        query = query.order_by(sort_col)

    result = await db.exec(query)
    plants = result.all()

    responses = []
    for plant in plants:
        # Get primary photo
        photo_result = await db.exec(
            select(PlantPhoto).where(
                PlantPhoto.plant_id == plant.id, PlantPhoto.is_primary
            )
        )
        primary_photo = photo_result.first()

        responses.append(
            PlantResponse(
                id=plant.id,
                name=plant.name,
                species=plant.species,
                pot_id=plant.pot_id,
                primary_photo_url=f"/uploads/plants/{primary_photo.file_path}"
                if primary_photo
                else None,
                created_at=plant.created_at,
                updated_at=plant.updated_at,
            )
        )

    return responses


@router.post("", response_model=PlantResponse, status_code=status.HTTP_201_CREATED)
async def create_plant(
    request: PlantCreate,
    db: DbSession,
    _user: CurrentUser,
) -> PlantResponse:
    """Create a new plant."""
    plant = Plant(
        name=request.name,
        species=request.species,
        pot_id=request.pot_id,
    )
    db.add(plant)
    await db.commit()
    await db.refresh(plant)

    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        pot_id=plant.pot_id,
        primary_photo_url=None,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
    )


@router.get("/{plant_id}", response_model=PlantDetailResponse)
async def get_plant(
    plant_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> PlantDetailResponse:
    """Get plant details."""
    result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    # Get photos
    photos_result = await db.exec(
        select(PlantPhoto).where(PlantPhoto.plant_id == plant_id)
    )
    photos = photos_result.all()

    # Get last care events
    async def get_last_event(event_type: CareEventType) -> datetime | None:
        event_result = await db.exec(
            select(CareEvent)
            .where(CareEvent.plant_id == plant_id, CareEvent.event_type == event_type)
            .order_by(col(CareEvent.event_date).desc())
            .limit(1)
        )
        event = event_result.first()
        return event.event_date if event else None

    primary_photo = next((p for p in photos if p.is_primary), None)

    return PlantDetailResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        pot_id=plant.pot_id,
        primary_photo_url=f"/uploads/plants/{primary_photo.file_path}"
        if primary_photo
        else None,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
        photos=[
            PlantPhotoResponse(
                id=p.id,
                url=f"/uploads/plants/{p.file_path}",
                is_primary=p.is_primary,
                uploaded_at=p.uploaded_at,
            )
            for p in photos
        ],
        last_watered=await get_last_event(CareEventType.WATERED),
        last_fertilized=await get_last_event(CareEventType.FERTILIZED),
        last_repotted=await get_last_event(CareEventType.REPOTTED),
    )


@router.put("/{plant_id}", response_model=PlantResponse)
async def update_plant(
    plant_id: UUID,
    request: PlantUpdate,
    db: DbSession,
    _user: CurrentUser,
) -> PlantResponse:
    """Update a plant."""
    result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    if request.name is not None:
        plant.name = request.name
    if request.species is not None:
        plant.species = request.species
    if request.pot_id is not None:
        plant.pot_id = request.pot_id

    plant.updated_at = datetime.now(UTC)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)

    # Get primary photo
    photo_result = await db.exec(
        select(PlantPhoto).where(PlantPhoto.plant_id == plant.id, PlantPhoto.is_primary)
    )
    primary_photo = photo_result.first()

    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        pot_id=plant.pot_id,
        primary_photo_url=f"/uploads/plants/{primary_photo.file_path}"
        if primary_photo
        else None,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
    )


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plant(
    plant_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """Delete a plant."""
    result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    await db.delete(plant)
    await db.commit()


@router.post("/{plant_id}/photos", response_model=PlantPhotoResponse)
async def upload_photo(
    plant_id: UUID,
    file: UploadFile,
    db: DbSession,
    _user: CurrentUser,
    is_primary: bool = False,
) -> PlantPhotoResponse:
    """Upload a photo for a plant."""
    result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    # Save file
    file_path = await save_upload_file(file, "plants")

    # If this is primary, unset other primary photos
    if is_primary:
        photos_result = await db.exec(
            select(PlantPhoto).where(
                PlantPhoto.plant_id == plant_id, PlantPhoto.is_primary
            )
        )
        for photo in photos_result.all():
            photo.is_primary = False
            db.add(photo)

    photo = PlantPhoto(
        plant_id=plant_id,
        file_path=file_path,
        is_primary=is_primary,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return PlantPhotoResponse(
        id=photo.id,
        url=f"/uploads/plants/{photo.file_path}",
        is_primary=photo.is_primary,
        uploaded_at=photo.uploaded_at,
    )


@router.delete("/{plant_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    plant_id: UUID,
    photo_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """Delete a photo."""
    result = await db.exec(
        select(PlantPhoto).where(
            PlantPhoto.id == photo_id, PlantPhoto.plant_id == plant_id
        )
    )
    photo = result.first()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    await db.delete(photo)
    await db.commit()


@router.post("/{plant_id}/care-events", response_model=CareEventResponse)
async def create_care_event(
    plant_id: UUID,
    request: CareEventCreate,
    db: DbSession,
    _user: CurrentUser,
) -> CareEventResponse:
    """Record a care event."""
    result = await db.exec(select(Plant).where(Plant.id == plant_id))
    plant = result.first()

    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found",
        )

    event = CareEvent(
        plant_id=plant_id,
        event_type=request.event_type,
        event_date=request.event_date or datetime.now(UTC),
        notes=request.notes,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return CareEventResponse(
        id=event.id,
        event_type=event.event_type,
        event_date=event.event_date,
        notes=event.notes,
        created_at=event.created_at,
    )


@router.get("/{plant_id}/care-events", response_model=list[CareEventResponse])
async def list_care_events(
    plant_id: UUID,
    db: DbSession,
    _user: CurrentUser,
    event_type: CareEventType | None = None,
) -> list[CareEventResponse]:
    """List care events for a plant."""
    query = select(CareEvent).where(CareEvent.plant_id == plant_id)

    if event_type:
        query = query.where(CareEvent.event_type == event_type)

    query = query.order_by(col(CareEvent.event_date).desc())

    result = await db.exec(query)
    events = result.all()

    return [
        CareEventResponse(
            id=e.id,
            event_type=e.event_type,
            event_date=e.event_date,
            notes=e.notes,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.delete(
    "/{plant_id}/care-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_care_event(
    plant_id: UUID,
    event_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> None:
    """Delete a care event."""
    result = await db.exec(
        select(CareEvent).where(
            CareEvent.id == event_id, CareEvent.plant_id == plant_id
        )
    )
    event = result.first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Care event not found",
        )

    await db.delete(event)
    await db.commit()

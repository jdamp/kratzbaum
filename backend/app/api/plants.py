"""Plant API endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlmodel import col, select

from app.api.deps import CurrentUser, DbSession
from app.models import CareEvent, CareEventType, Plant, PlantPhoto, Pot
from app.services.files import save_upload_file
from app.services.reminders import update_plant_reminders

router = APIRouter(prefix="/plants", tags=["plants"])


# Request/Response models
class PlantCreate(BaseModel):
    """Create plant request."""

    name: str
    species: str | None = None
    pot_id: UUID | None = None
    watering_interval: int | None = None
    fertilizing_interval: int | None = None


class PlantUpdate(BaseModel):
    """Update plant request."""

    name: str | None = None
    species: str | None = None
    pot_id: UUID | None = None
    watering_interval: int | None = None
    fertilizing_interval: int | None = None


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
    watering_interval: int | None
    fertilizing_interval: int | None
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


async def validate_pot_assignment(
    db: DbSession,
    pot_id: UUID,
    current_plant_id: UUID | None = None,
) -> None:
    """Ensure pot exists and is not assigned to another plant."""
    pot_result = await db.exec(select(Pot).where(Pot.id == pot_id))
    pot = pot_result.first()
    if not pot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pot not found",
        )

    assignment_query = select(Plant).where(Plant.pot_id == pot_id)
    if current_plant_id is not None:
        assignment_query = assignment_query.where(Plant.id != current_plant_id)

    assigned_result = await db.exec(assignment_query)
    assigned_plant = assigned_result.first()
    if assigned_plant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pot is already assigned to plant '{assigned_plant.name}'. "
                "Unassign it first."
            ),
        )


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
                watering_interval=plant.watering_interval,
                fertilizing_interval=plant.fertilizing_interval,
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
    if request.pot_id is not None:
        await validate_pot_assignment(db, request.pot_id)

    plant = Plant(
        name=request.name,
        species=request.species,
        pot_id=request.pot_id,
        watering_interval=request.watering_interval,
        fertilizing_interval=request.fertilizing_interval,
    )
    db.add(plant)
    await db.commit()
    await db.refresh(plant)

    # Initial reminder calculation
    await update_plant_reminders(db, plant.id)
    await db.refresh(plant)  # Refresh to get updated reminders relation if needed

    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        pot_id=plant.pot_id,
        watering_interval=plant.watering_interval,
        fertilizing_interval=plant.fertilizing_interval,
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
        watering_interval=plant.watering_interval,
        fertilizing_interval=plant.fertilizing_interval,
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

    update_data = request.model_dump(exclude_unset=True)
    if "pot_id" in update_data and update_data["pot_id"] is not None:
        await validate_pot_assignment(
            db,
            update_data["pot_id"],
            current_plant_id=plant.id,
        )

    for key, value in update_data.items():
        setattr(plant, key, value)

    plant.updated_at = datetime.now(UTC)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)

    # Update reminders if intervals changed
    await update_plant_reminders(db, plant.id)
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
        watering_interval=plant.watering_interval,
        fertilizing_interval=plant.fertilizing_interval,
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


@router.post("/{plant_id}/photos/{photo_id}/primary", response_model=PlantPhotoResponse)
async def set_primary_photo(
    plant_id: UUID,
    photo_id: UUID,
    db: DbSession,
    _user: CurrentUser,
) -> PlantPhotoResponse:
    """Set an existing photo as the plant's primary photo."""
    target_result = await db.exec(
        select(PlantPhoto).where(
            PlantPhoto.id == photo_id, PlantPhoto.plant_id == plant_id
        )
    )
    target_photo = target_result.first()

    if not target_photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    current_primary_result = await db.exec(
        select(PlantPhoto).where(
            PlantPhoto.plant_id == plant_id,
            PlantPhoto.is_primary,
            PlantPhoto.id != photo_id,
        )
    )

    for photo in current_primary_result.all():
        photo.is_primary = False
        db.add(photo)

    target_photo.is_primary = True
    db.add(target_photo)
    await db.commit()
    await db.refresh(target_photo)

    return PlantPhotoResponse(
        id=target_photo.id,
        url=f"/uploads/plants/{target_photo.file_path}",
        is_primary=target_photo.is_primary,
        uploaded_at=target_photo.uploaded_at,
    )


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

    # Update reminders for this plant
    await update_plant_reminders(db, plant_id)

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

    # Recalculate reminders (might revert to previous event or creation date)
    await update_plant_reminders(db, plant_id)

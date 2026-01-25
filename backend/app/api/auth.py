"""Authentication API endpoints."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


class LoginRequest(BaseModel):
    """Login request body."""

    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class SetupRequest(BaseModel):
    """Initial setup request body."""

    username: str
    password: str


class SetupResponse(BaseModel):
    """Setup response."""

    message: str
    username: str


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: DbSession) -> TokenResponse:
    """Authenticate and return JWT token."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    user_settings = result.first()

    if not user_settings:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user configured. Please run setup first.",
        )

    if not verify_password(request.password, user_settings.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if request.username != user_settings.username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(
        data={"sub": user_settings.username},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/setup", response_model=SetupResponse)
async def setup(request: SetupRequest, db: DbSession) -> SetupResponse:
    """Initial user setup (only works if no user exists)."""
    result = await db.exec(select(Settings).where(Settings.id == 1))
    existing = result.first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already configured",
        )

    user_settings = Settings(
        id=1,
        username=request.username,
        password_hash=hash_password(request.password),
    )
    db.add(user_settings)
    await db.commit()

    return SetupResponse(
        message="User created successfully",
        username=request.username,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(db: DbSession) -> TokenResponse:
    """Refresh access token."""
    # In a real app, you'd validate the refresh token
    # For simplicity, we just issue a new token
    result = await db.exec(select(Settings).where(Settings.id == 1))
    user_settings = result.first()

    if not user_settings:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user configured",
        )

    access_token = create_access_token(
        data={"sub": user_settings.username},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )

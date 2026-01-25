"""File upload service."""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def save_upload_file(file: UploadFile, subfolder: str) -> str:
    """
    Save an uploaded file and return the relative path.
    
    Args:
        file: The uploaded file
        subfolder: Subdirectory (e.g., 'plants' or 'pots')
        
    Returns:
        Relative file path for storage in database
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )

    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # Generate unique filename
    unique_name = f"{uuid.uuid4()}{ext}"
    
    # Create upload directory if it doesn't exist
    if subfolder == "plants":
        upload_dir = settings.upload_plants_dir
    else:
        upload_dir = settings.upload_pots_dir
    
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = upload_dir / unique_name
    with open(file_path, "wb") as f:
        f.write(content)
    
    return unique_name


async def delete_upload_file(filename: str, subfolder: str) -> None:
    """Delete an uploaded file."""
    if subfolder == "plants":
        file_path = settings.upload_plants_dir / filename
    else:
        file_path = settings.upload_pots_dir / filename
    
    if file_path.exists():
        file_path.unlink()

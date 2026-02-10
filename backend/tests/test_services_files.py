
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile

from app.services.files import delete_upload_file, save_upload_file


@pytest.fixture
def mock_settings(tmp_path):
    with patch("app.services.files.settings", autospec=True) as mock:
        mock.upload_plants_dir = tmp_path / "plants"
        mock.upload_pots_dir = tmp_path / "pots"
        yield mock

@pytest.mark.asyncio
async def test_save_upload_file_success(mock_settings):
    content = b"fake image content"
    file = MagicMock(spec=UploadFile)
    file.filename = "test.jpg"
    file.read.return_value = content

    filename = await save_upload_file(file, "plants")

    assert filename.endswith(".jpg")
    file_path = mock_settings.upload_plants_dir / filename
    assert file_path.exists()
    assert file_path.read_bytes() == content

@pytest.mark.asyncio
async def test_save_upload_file_invalid_extension():
    file = MagicMock(spec=UploadFile)
    file.filename = "test.txt"

    with pytest.raises(HTTPException) as exc:
        await save_upload_file(file, "plants")
    assert exc.value.status_code == 400
    assert "File type not allowed" in exc.value.detail

@pytest.mark.asyncio
async def test_save_upload_file_too_large():
    file = MagicMock(spec=UploadFile)
    file.filename = "test.jpg"
    file.read.return_value = b"a" * (10 * 1024 * 1024 + 1)

    with pytest.raises(HTTPException) as exc:
        await save_upload_file(file, "plants")
    assert exc.value.status_code == 400
    assert "File too large" in exc.value.detail

@pytest.mark.asyncio
async def test_delete_upload_file(mock_settings):
    # Setup - create a dummy file
    mock_settings.upload_plants_dir.mkdir(parents=True, exist_ok=True)
    file_path = mock_settings.upload_plants_dir / "test.jpg"
    file_path.write_bytes(b"content")

    await delete_upload_file("test.jpg", "plants")

    assert not file_path.exists()

@pytest.mark.asyncio
async def test_delete_upload_file_not_found(mock_settings):
    # Should not raise error
    await delete_upload_file("nonexistent.jpg", "plants")


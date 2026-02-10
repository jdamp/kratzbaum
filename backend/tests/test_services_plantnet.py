
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.plantnet import identify_plant


@pytest.fixture
def mock_settings():
    with patch("app.services.plantnet.settings", autospec=True) as mock:
        mock.plantnet_api_key = "test_key"
        mock.plantnet_api_url = "https://my-api.plantnet.org/v2/identify/all"
        yield mock

@pytest.mark.asyncio
async def test_identify_plant_success(mock_settings):
    mock_response_data = {
        "results": [
            {
                "score": 0.95,
                "species": {
                    "scientificNameWithoutAuthor": "Monstera deliciosa",
                    "commonNames": ["Swiss cheese plant"],
                    "family": {"scientificNameWithoutAuthor": "Araceae"},
                    "genus": {"scientificNameWithoutAuthor": "Monstera"},
                },
            }
        ],
        "remainingIdentificationRequests": 100,
    }

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        # Setup response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data

        # When called, return mock_response (awaitable)
        mock_client.post.return_value = mock_response

        result = await identify_plant(b"image_data")

        assert result["remaining_identifications"] == 100
        assert len(result["results"]) == 1
        assert result["results"][0]["scientific_name"] == "Monstera deliciosa"
        assert result["results"][0]["score"] == 0.95

@pytest.mark.asyncio
async def test_identify_plant_no_api_key():
    with patch("app.services.plantnet.settings", autospec=True) as mock:
        mock.plantnet_api_key = None
        result = await identify_plant(b"image_data")
        assert "error" in result
        assert result["error"] == "PlantNet API key not configured"

@pytest.mark.asyncio
async def test_identify_plant_api_error(mock_settings):
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {}

        mock_client.post.return_value = mock_response

        result = await identify_plant(b"image_data")

        assert "error" in result
        assert "PlantNet API error: 400" in result["error"]

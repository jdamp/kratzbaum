"""Tests for identify API endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


class TestIdentifyEndpoint:
    """Tests for POST /api/identify."""

    @pytest.mark.asyncio
    async def test_identify_requires_auth(self, client: AsyncClient):
        """Endpoint should reject unauthenticated requests."""
        response = await client.post(
            "/api/identify",
            files={"image": ("leaf.jpg", b"fake-image", "image/jpeg")},
            data={"organ": "leaf"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_identify_success(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should return transformed identification results."""
        mock_payload = {
            "results": [
                {
                    "score": 0.93,
                    "scientific_name": "Monstera deliciosa",
                    "common_names": ["Swiss Cheese Plant"],
                    "family": "Araceae",
                    "genus": "Monstera",
                }
            ],
            "remaining_identifications": 91,
        }

        with patch(
            "app.api.identify.identify_plant",
            AsyncMock(return_value=mock_payload),
        ) as mock_identify:
            response = await client.post(
                "/api/identify",
                files={"image": ("leaf.jpg", b"fake-image", "image/jpeg")},
                data={"organ": "leaf"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.json() == {
            "results": [
                {
                    "score": 0.93,
                    "scientific_name": "Monstera deliciosa",
                    "common_names": ["Swiss Cheese Plant"],
                    "family": "Araceae",
                    "genus": "Monstera",
                }
            ],
            "error": None,
            "error_code": None,
            "remaining_identifications": 91,
        }
        mock_identify.assert_awaited_once_with(
            image_data=b"fake-image",
            organ="leaf",
            api_key=None,
        )

    @pytest.mark.asyncio
    async def test_identify_invalid_organ(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should validate organ values."""
        response = await client.post(
            "/api/identify",
            files={"image": ("leaf.jpg", b"fake-image", "image/jpeg")},
            data={"organ": "root"},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Invalid organ. Use one of: leaf, flower, fruit, bark"
        )

    @pytest.mark.asyncio
    async def test_identify_empty_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should reject empty file uploads."""
        response = await client.post(
            "/api/identify",
            files={"image": ("leaf.jpg", b"", "image/jpeg")},
            data={"organ": "leaf"},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Uploaded file is empty"

    @pytest.mark.asyncio
    async def test_identify_rejects_non_image_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should reject non-image MIME types."""
        response = await client.post(
            "/api/identify",
            files={"image": ("data.txt", b"not-an-image", "text/plain")},
            data={"organ": "leaf"},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Invalid file type. Please upload an image."
        )

    @pytest.mark.asyncio
    async def test_identify_service_error_payload(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should pass service errors in response body."""
        mock_payload = {
            "error": "PlantNet API key not configured",
            "error_code": "MISSING_API_KEY",
            "results": [],
        }

        with patch(
            "app.api.identify.identify_plant",
            AsyncMock(return_value=mock_payload),
        ):
            response = await client.post(
                "/api/identify",
                files={"image": ("leaf.jpg", b"fake-image", "image/jpeg")},
                data={"organ": "leaf"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.json() == {
            "results": [],
            "error": "PlantNet API key not configured",
            "error_code": "MISSING_API_KEY",
            "remaining_identifications": None,
        }

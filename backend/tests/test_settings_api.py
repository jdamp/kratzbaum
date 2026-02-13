"""Tests for settings API endpoints."""

import pytest
from httpx import AsyncClient


class TestPlantNetSettingsEndpoints:
    """Tests for PlantNet settings endpoints."""

    @pytest.mark.asyncio
    async def test_get_plantnet_settings_requires_auth(self, client: AsyncClient):
        """Endpoint should reject unauthenticated requests."""
        response = await client.get("/api/settings/plantnet")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_plantnet_settings_default_unconfigured(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should report unconfigured key when none is saved."""
        response = await client.get("/api/settings/plantnet", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["is_configured"] is False
        assert data["masked_api_key"] is None
        assert data["updated_at"]

    @pytest.mark.asyncio
    async def test_put_plantnet_settings_saves_masked_response(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should persist key but only return masked value."""
        response = await client.put(
            "/api/settings/plantnet",
            json={"api_key": "pl-test-key-1234"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_configured"] is True
        assert data["masked_api_key"] == "pl***34"

        get_response = await client.get("/api/settings/plantnet", headers=auth_headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["is_configured"] is True
        assert get_data["masked_api_key"] == "pl***34"

    @pytest.mark.asyncio
    async def test_put_plantnet_settings_rejects_whitespace_only(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Endpoint should reject empty key values after trimming."""
        response = await client.put(
            "/api/settings/plantnet",
            json={"api_key": "   "},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "API key cannot be empty"

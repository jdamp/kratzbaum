"""Tests for API endpoints."""

import pytest
from httpx import AsyncClient


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Test health check returns healthy status."""
        response = await client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_setup_creates_user(self, client: AsyncClient):
        """Test setup endpoint creates initial user."""
        response = await client.post(
            "/api/auth/setup",
            json={"username": "admin", "password": "adminpass123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert "message" in data

    @pytest.mark.asyncio
    async def test_setup_fails_if_user_exists(self, client: AsyncClient, test_user):
        """Test setup fails if user already exists."""
        response = await client.post(
            "/api/auth/setup",
            json={"username": "another", "password": "pass123"},
        )

        assert response.status_code == 400
        assert "already configured" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Test successful login returns token."""
        response = await client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "testpass123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Test login fails with wrong password."""
        response = await client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "wrongpass"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_wrong_username(self, client: AsyncClient, test_user):
        """Test login fails with wrong username."""
        response = await client.post(
            "/api/auth/login",
            json={"username": "wronguser", "password": "testpass123"},
        )

        assert response.status_code == 401


class TestPlantEndpoints:
    """Tests for plant CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_list_plants_unauthorized(self, client: AsyncClient):
        """Test list plants requires auth."""
        response = await client.get("/api/plants")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_plants_empty(self, client: AsyncClient, auth_headers: dict):
        """Test list plants returns empty list initially."""
        response = await client.get("/api/plants", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_create_plant(self, client: AsyncClient, auth_headers: dict):
        """Test creating a plant."""
        response = await client.post(
            "/api/plants",
            json={"name": "My Monstera", "species": "Monstera deliciosa"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Monstera"
        assert data["species"] == "Monstera deliciosa"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_list_plants_response_contract(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test list plants response shape matches API contract."""
        pot_response = await client.post(
            "/api/pots",
            json={
                "name": "Contract Pot",
                "diameter_cm": 18.0,
                "height_cm": 16.0,
            },
            headers=auth_headers,
        )
        pot_id = pot_response.json()["id"]

        create_response = await client.post(
            "/api/plants",
            json={"name": "Contract Plant", "pot_id": pot_id},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        await client.post(
            f"/api/plants/{plant_id}/care-events",
            json={"event_type": "WATERED"},
            headers=auth_headers,
        )

        response = await client.get("/api/plants", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        plant = data[0]
        assert set(plant.keys()) == {
            "id",
            "name",
            "species",
            "pot_id",
            "watering_interval",
            "fertilizing_interval",
            "primary_photo_url",
            "created_at",
            "updated_at",
        }
        assert plant["pot_id"] == pot_id
        assert "pot" not in plant
        assert "last_watered" not in plant
        assert "last_fertilized" not in plant
        assert "last_repotted" not in plant

    @pytest.mark.asyncio
    async def test_get_plant(self, client: AsyncClient, auth_headers: dict):
        """Test getting a plant by ID."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "Test Plant"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Get plant
        response = await client.get(
            f"/api/plants/{plant_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Test Plant"

    @pytest.mark.asyncio
    async def test_get_plant_response_contract(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test plant detail response shape matches API contract."""
        pot_response = await client.post(
            "/api/pots",
            json={
                "name": "Detail Pot",
                "diameter_cm": 20.0,
                "height_cm": 15.0,
            },
            headers=auth_headers,
        )
        pot_id = pot_response.json()["id"]

        create_response = await client.post(
            "/api/plants",
            json={"name": "Detail Plant", "pot_id": pot_id},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        await client.post(
            f"/api/plants/{plant_id}/care-events",
            json={"event_type": "WATERED"},
            headers=auth_headers,
        )

        response = await client.get(f"/api/plants/{plant_id}", headers=auth_headers)

        assert response.status_code == 200
        plant = response.json()
        assert set(plant.keys()) == {
            "id",
            "name",
            "species",
            "pot_id",
            "watering_interval",
            "fertilizing_interval",
            "primary_photo_url",
            "created_at",
            "updated_at",
            "photos",
            "last_watered",
            "last_fertilized",
            "last_repotted",
        }
        assert plant["pot_id"] == pot_id
        assert plant["photos"] == []
        assert plant["last_watered"] is not None
        assert plant["last_fertilized"] is None
        assert plant["last_repotted"] is None
        assert "pot" not in plant
        assert "reminders" not in plant

    @pytest.mark.asyncio
    async def test_update_plant(self, client: AsyncClient, auth_headers: dict):
        """Test updating a plant."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "Old Name"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Update plant
        response = await client.put(
            f"/api/plants/{plant_id}",
            json={"name": "New Name"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_delete_plant(self, client: AsyncClient, auth_headers: dict):
        """Test deleting a plant."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "To Delete"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Delete plant
        response = await client.delete(
            f"/api/plants/{plant_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(
            f"/api/plants/{plant_id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_care_event(self, client: AsyncClient, auth_headers: dict):
        """Test creating a care event for a plant."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "Thirsty Plant"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Create care event
        response = await client.post(
            f"/api/plants/{plant_id}/care-events",
            json={"event_type": "WATERED"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["event_type"] == "WATERED"

    @pytest.mark.asyncio
    async def test_delete_care_event(self, client: AsyncClient, auth_headers: dict):
        """Test deleting a care event."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "Test Plant"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Create care event
        event_response = await client.post(
            f"/api/plants/{plant_id}/care-events",
            json={"event_type": "WATERED"},
            headers=auth_headers,
        )
        event_id = event_response.json()["id"]

        # Delete care event
        delete_response = await client.delete(
            f"/api/plants/{plant_id}/care-events/{event_id}",
            headers=auth_headers,
        )

        assert delete_response.status_code == 204

        # Verify event is deleted by checking care events list
        list_response = await client.get(
            f"/api/plants/{plant_id}/care-events",
            headers=auth_headers,
        )
        events = list_response.json()
        assert all(e["id"] != event_id for e in events)

    @pytest.mark.asyncio
    async def test_delete_care_event_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test deleting a non-existent care event returns 404."""
        # Create plant first
        create_response = await client.post(
            "/api/plants",
            json={"name": "Test Plant"},
            headers=auth_headers,
        )
        plant_id = create_response.json()["id"]

        # Try to delete non-existent care event
        fake_event_id = "00000000-0000-0000-0000-000000000000"
        response = await client.delete(
            f"/api/plants/{plant_id}/care-events/{fake_event_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestPotEndpoints:
    """Tests for pot CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_pot(self, client: AsyncClient, auth_headers: dict):
        """Test creating a pot."""
        response = await client.post(
            "/api/pots",
            json={
                "name": "Terracotta Large",
                "diameter_cm": 25.0,
                "height_cm": 20.0,
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Terracotta Large"
        assert data["diameter_cm"] == 25.0

    @pytest.mark.asyncio
    async def test_list_available_pots(self, client: AsyncClient, auth_headers: dict):
        """Test listing available pots."""
        # Create a pot
        await client.post(
            "/api/pots",
            json={"name": "Available Pot", "diameter_cm": 15.0, "height_cm": 12.0},
            headers=auth_headers,
        )

        response = await client.get("/api/pots/available", headers=auth_headers)

        assert response.status_code == 200
        assert len(response.json()) >= 1

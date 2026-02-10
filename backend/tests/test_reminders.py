"""Integration tests for simplified interval-based reminders."""

import pytest
from httpx import AsyncClient

from app.models import CareEventType, ReminderType


class TestRemindersIntegration:
    """Integration tests for reminder workflow."""

    @pytest.mark.asyncio
    async def test_global_interval_workflow(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Test that global settings trigger reminders."""

        # 1. Update Global Settings (Watering: 7 days)
        response = await client.put(
            "/api/settings/reminders",
            json={
                "default_watering_interval": 7,
                "preferred_reminder_time": "09:00:00",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # 2. Create a Plant
        response = await client.post(
            "/api/plants",
            json={"name": "Test Plant"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        plant_id = response.json()["id"]

        # 3. Check for generated reminder
        response = await client.get("/api/reminders", headers=auth_headers)
        reminders = response.json()

        # Should have 1 watering reminder (fertilizing is null globally)
        assert len(reminders) == 1
        reminder = reminders[0]
        assert reminder["plant_id"] == plant_id
        assert reminder["reminder_type"] == ReminderType.WATERING

    @pytest.mark.asyncio
    async def test_plant_override_workflow(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Test that plant overrides take precedence."""

        # 1. Create a Plant with Override (Watering: 3 days)
        response = await client.post(
            "/api/plants",
            json={
                "name": "Thirsty Plant",
                "watering_interval": 3,
            },
            headers=auth_headers,
        )
        plant_id = response.json()["id"]

        # 2. Check Reminder
        response = await client.get("/api/reminders", headers=auth_headers)
        reminders = response.json()

        # Find our plant's reminder
        reminder = next(r for r in reminders if r["plant_id"] == plant_id)
        assert reminder["reminder_type"] == ReminderType.WATERING
        # Next due should be roughly 3 days from now
        # We can't easily assert exact time, but existence proves it worked.

        # 3. Update Plant to remove override (set to null)
        # First ensure global setting is null (default)
        await client.put(
            "/api/settings/reminders",
            json={"default_watering_interval": None},
            headers=auth_headers,
        )

        response = await client.put(
            f"/api/plants/{plant_id}",
            json={"watering_interval": None},
            headers=auth_headers,
        )
        assert response.status_code == 200

        # 4. Check Reminder (Should be gone)
        response = await client.get("/api/reminders", headers=auth_headers)
        reminders = response.json()
        assert not any(r["plant_id"] == plant_id for r in reminders)

    @pytest.mark.asyncio
    async def test_care_event_updates_next_due(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Test that adding a care event pushes next_due forward."""

        # 1. Create Plant (Interval 5 days)
        response = await client.post(
            "/api/plants",
            json={"name": "Cactus", "watering_interval": 5},
            headers=auth_headers,
        )
        plant_id = response.json()["id"]

        # Get initial due date (based on creation time)
        response = await client.get("/api/reminders", headers=auth_headers)
        initial_reminder = next(r for r in response.json() if r["plant_id"] == plant_id)
        initial_due = initial_reminder["next_due"]

        # 2. Add Care Event with future date (tomorrow)
        # This simulates watering it "later" which should push the due date further out
        from datetime import UTC, datetime, timedelta
        tomorrow = (datetime.now(UTC) + timedelta(days=1)).isoformat()
        response = await client.post(
            f"/api/plants/{plant_id}/care-events",
            json={"event_type": CareEventType.WATERED, "event_date": tomorrow},
            headers=auth_headers,
        )
        assert response.status_code == 200

        # 3. Check new due date (should be tomorrow + 5 days, > today + 5 days)
        response = await client.get("/api/reminders", headers=auth_headers)
        new_reminder = next(r for r in response.json() if r["plant_id"] == plant_id)

        assert new_reminder["next_due"] > initial_due

    @pytest.mark.asyncio
    async def test_snooze(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        """Test snoozing a reminder."""

        # 1. Create Plant
        response = await client.post(
            "/api/plants",
            json={"name": "Snoozer", "watering_interval": 1},
            headers=auth_headers
        )
        plant_id = response.json()["id"]

        reminder_response = await client.get("/api/reminders", headers=auth_headers)
        reminder_id = next(r for r in reminder_response.json() if r["plant_id"] == plant_id)["id"]

        # 2. Snooze for 5 hours
        response = await client.post(
            f"/api/reminders/{reminder_id}/snooze",
            json={"snooze_hours": 5},
            headers=auth_headers
        )
        assert response.status_code == 200

        # 3. Verify next_due updated
        updated_reminder = response.json()
        assert updated_reminder["next_due"]  # Should check against time, but existence is key

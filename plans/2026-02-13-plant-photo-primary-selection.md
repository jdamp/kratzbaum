# Implementation Plan: Persist Plant Gallery Primary Photo Selection (`#15`)

Date: 2026-02-13  
Branch: `fix/issue-15-primary-photo`

## Goal
When a user selects a photo thumbnail in plant detail, that photo becomes the persisted primary/default photo for the plant.

## Scope
- Backend: add a route to set `PlantPhoto.is_primary` on an existing photo.
- Frontend: call the new route from plant detail thumbnail selection.
- Specs/docs: reflect the new endpoint and expected behavior.

## Plan
1. Add `POST /api/plants/{plant_id}/photos/{photo_id}/primary` endpoint.
2. Ensure primary uniqueness by unsetting any existing primary photo on the same plant.
3. Add backend tests for happy path and 404 behavior.
4. Add `plantService.setPrimaryPhoto(...)` client method.
5. Update thumbnail click handling in `frontend/src/routes/plants/[id]/+page.svelte` to persist selection.
6. Keep selected image in sync after refresh by defaulting to the current primary photo.
7. Update docs in feature spec and API contracts.

## Validation
- `cd backend && uv run pytest -q`
- `cd frontend && npm run check`
- Manual flow:
  - Open a plant with at least 2 photos
  - Click a non-primary thumbnail
  - Reload the page
  - Confirm selected photo remains marked and displayed as primary

# Implementation Plan: Existing Plant Identification Flow (`#14`)

Date: 2026-02-13  
Branch: `feat/issue-14-existing-plant-identify`

## Goal
Enable species identification from the existing-plant edit flow (`/plants/{id}`), using a selected existing photo (including newly uploaded photos) and applying a suggestion into the species field.

## Scope
- Frontend-only behavior change on `frontend/src/routes/plants/[id]/+page.svelte`
- Documentation updates for feature and contract coverage
- No backend API contract changes

## Plan
1. Add identify state/actions to plant edit modal.
2. Allow selecting an existing plant photo as identify source.
3. Call `POST /api/identify` with selected photo.
4. Render suggestions and apply chosen species to edit form.
5. Handle missing PlantNet key via `error_code: "MISSING_API_KEY"` path.
6. Update specs/docs to reflect current behavior.
7. Run frontend checks.

## Validation
- Manual flow:
  - Open existing plant
  - Enter edit modal
  - Select a photo
  - Click Identify
  - Apply a suggestion
  - Save
- Command:
  - `cd frontend && npm run check`

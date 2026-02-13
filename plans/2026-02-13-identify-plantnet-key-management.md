# Implementation Plan: PlantNet API Key Management and Missing-Key UX

## Goal
Add end-to-end support for PlantNet API key configuration in the app and ensure identify failures due to missing key are clearly surfaced in the frontend.

## Scope
- In scope:
  - Backend settings model/API updates for PlantNet API key storage
  - Identify response contract updates for machine-readable missing-key errors
  - Frontend settings UI for key create/update
  - Frontend identify UX for explicit missing-key error handling
  - Tests and docs updates for the new behavior
- Out of scope:
  - Multi-user key management
  - Secret manager/KMS integration
  - Plant identification history persistence

## Current State (2026-02-13)
- `POST /api/identify` exists and returns `200` with `error` when service-level issues occur.
- PlantNet key is read from backend runtime config/env (`settings.plantnet_api_key` in app config), not from DB-backed app settings.
- Frontend identify page only shows generic error text and has no key configuration workflow.

## Target Behavior
1. Users can save/update a PlantNet API key from the app UI.
2. Key is persisted in the single-user settings record and used by identify requests.
3. Missing-key identify failures return explicit machine-readable signal (`error_code = "MISSING_API_KEY"`).
4. Frontend identify page detects missing-key failures and renders dedicated guidance with a settings CTA.

## Backend Plan
1. Data model and persistence
- Extend `Settings` model with nullable `plantnet_api_key` field.
- Ensure startup table creation path includes the new column for fresh DBs.
- Add migration strategy note for existing DBs (manual SQL or migration tool step).

2. Settings API
- Add `GET /api/settings/plantnet` returning configuration status and masked key.
- Add `PUT /api/settings/plantnet` to set/update key.
- Never return raw API key in any response.

3. Identify service + API contract
- Resolve PlantNet key from DB settings (fallback behavior documented if needed).
- On missing key, return structured payload:
  - `results: []`
  - `error: "PlantNet API key not configured"`
  - `error_code: "MISSING_API_KEY"`
- Keep existing validation errors (`400`) unchanged.

4. Backend tests
- Add tests for settings PlantNet endpoints (auth, save, read, masking).
- Add identify test covering missing-key `error_code`.
- Keep existing identify success/validation tests passing.

## Frontend Plan
1. API typings/client
- Update identify response type to include optional `error_code`.
- Add typed API methods for `/settings/plantnet` get/put.

2. Settings UX
- Add PlantNet key section on settings screen.
- Implement input, save action, success/error feedback.
- Show configured/not-configured state and masked key only.

3. Identify UX
- Detect `error_code === "MISSING_API_KEY"` and show explicit message.
- Provide a clear CTA to navigate to settings.
- Preserve current behavior for other identify failures.

## Validation Plan
1. Backend
- `cd backend && uv run ruff check`
- `cd backend && uv run pytest -q`

2. Frontend
- `cd frontend && npm run check`
- `cd frontend && npm run build`

3. Manual checks
- Save a PlantNet key via settings and verify identify succeeds.
- Clear key and verify identify shows missing-key guidance.
- Trigger non-key identify error and verify generic/contextual error remains.

## Risks and Mitigations
1. Risk: exposing secrets accidentally in API responses/logs.
- Mitigation: strict response schema with masking, avoid logging raw key.

2. Risk: existing deployments lack DB migration for new field.
- Mitigation: include explicit migration step in rollout notes and verify startup behavior.

3. Risk: frontend/backend contract drift on `error_code`.
- Mitigation: add contract tests and align TypeScript types with backend response models.

## Delivery Breakdown
1. Backend schema + settings endpoints.
2. Identify missing-key error code wiring.
3. Frontend settings + identify UX updates.
4. Tests, checks, and docs alignment.

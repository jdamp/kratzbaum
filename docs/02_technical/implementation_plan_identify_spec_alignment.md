# Implementation Plan: Add `/api/identify` and Align Specs

Date: 2026-02-13  
Branch: `docs/spec-identify-route-alignment`

## Objective
Implement missing `POST /api/identify` and update documentation to match actual backend behavior.

## Plan
1. Add authenticated identify endpoint in backend API.
2. Validate multipart request fields (`image`, `organ`) and error cases.
3. Reuse existing PlantNet service for upstream call + result transformation.
4. Add endpoint tests for auth, success, validation, and service-error payload.
5. Update technical/feature/project docs to reflect implemented contract and current limitations.

## Implementation Status
- Completed: `backend/app/api/identify.py` with `POST /api/identify`
- Completed: Router wiring in `backend/app/main.py`
- Completed: Tests in `backend/tests/test_identify_api.py`
- Completed: Specs updated in:
  - `docs/02_technical/api_contracts.md`
  - `docs/01_features/F04_plant_recognition.md`
  - `docs/00_project_context.md`

## Notes
- Endpoint currently returns service-level failures as `200` with `{ error, results: [] }`, matching frontend expectations.
- Identification history persistence endpoints are not planned.

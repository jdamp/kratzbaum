## Why

Kratzbaum already integrates with Pl@ntNet, but identification requires an existing plant and a newly selected file. Users should be able to identify a plant while adding it and reuse an existing plant's gallery photos without downloading and selecting them again.

## What Changes

- Offer an explicit Identify species action on the selected photo in Add Plant, before the plant is saved. Confirming a suggestion fills draft species information; saving remains a separate action.
- Allow existing plants to be identified from either a saved gallery photo or a newly selected file, using the same ranked candidate review and explicit confirmation.
- Reuse backend JPEG normalization, optional server-side credentials, and durable one-shot attempts across all identification entry points. Identification alone creates no plant, catalogue photo, or photo activity.
- Clear stale candidates when the source changes and preserve form input and saved species on cancellation or failure. Show unavailable configuration and offline states before submission.
- Preserve ordinary photo upload and its existing saved-plant recovery behavior. Update the creation-photo specification to permit an explicitly requested identification upload before saving.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plant-identification`: Support unsaved plants and saved gallery sources, with shared candidate confirmation and one-shot failure behavior.
- `mobile-frontend`: Add identification during creation, expose saved-photo identification on plant detail, and distinguish identification-only uploads from catalogue photo uploads.

## Impact

- Backend: extend `internal/httpapi/server.go` with draft and saved-photo identification routes and shared attempt execution; reuse `internal/identification`, `internal/media`, and existing storage attempts and photo lookups.
- Frontend: share identification controls and typed API results across `web/src/PlantDialog.tsx`, `web/src/main.tsx`, and `web/src/api.ts`; update styles and embedded production assets.
- Validation: extend backend/provider tests and browser creation/detail flows, including cancellation, stale results, no-key/offline states, duplicate attempts, and photo-upload recovery.
- Keep the existing saved-plant upload identification route compatible. No new external dependency, database migration, automatic care advice, multi-image identification, or deployment key provisioning is planned.

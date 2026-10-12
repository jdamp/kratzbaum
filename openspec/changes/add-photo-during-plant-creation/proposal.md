## Why

The Add a plant dialog currently requires saving a plant and reopening its details before attaching a photograph. Letting users select an optional photo during creation makes the new plant recognizable immediately, while preserving their saved details if the upload fails.

## What Changes

- Add a single optional photo picker to plant creation, with a preview when supported, filename feedback, and replace/remove controls.
- Accept the existing JPG, PNG, WebP, and HEIC formats and upload the selection after the plant is saved; the first attached photo becomes the cover and creates a dated photo activity.
- If photo upload fails after plant creation succeeds, retain the plant and selected file and offer Retry photo or Continue without photo. Retrying uploads to the saved plant rather than creating it again.
- Show distinct save/upload/error states, prevent concurrent submission, and retain existing creation without a photo.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plant-catalogue`: Define optional creation photos, first-photo cover behavior, and recovery after a photo-upload failure without duplicating a confirmed saved plant.
- `mobile-frontend`: Define the creation photo picker, preview fallback, progress, cancellation, and recovery controls.

## Impact

- Frontend changes target the creation dialog and submit flow in `web/src/main.tsx`, relevant styles in `web/src/styles.css`, and typed use of the existing create/upload helpers in `web/src/api.ts` if needed.
- Reuse `POST /api/plants` and `POST /api/plants/{id}/photos`; the backend already returns the created plant ID, normalizes photographs, and sets the first photo as cover.
- Extend the existing Playwright flows in `web/e2e` and rebuild embedded frontend assets under `cmd/kratzbaum/web/dist`.
- No database migration or dependency change is expected.

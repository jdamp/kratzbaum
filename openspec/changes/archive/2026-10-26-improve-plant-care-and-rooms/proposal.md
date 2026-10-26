## Why

Adding a plant currently forces a care start date and schedules reminders before any actual care may have happened. Photo previews and room-based browsing will make it easier to recognize plants and work through the plants in one room.

## What Changes

- Make the editable care start date optional and blank by default. Without a start date or recorded care, retain the configured intervals but do not calculate a deadline.
- Start watering and fertilizing independently from their own recorded activities, preserving backdating, corrections, seasonal settings, and explicit fallback start dates.
- Add a separate Not started yet section on Today with individual Watered/Fertilized actions for configured, currently enabled schedules lacking an anchor.
- Show plant cover-photo thumbnails on due and upcoming reminders, with a useful fallback when a photo is missing or unavailable.
- Introduce shared named rooms, optional assignment of each plant to one room, and All rooms / specific room / Unassigned filters on Plants and Today. Keep care recording individual.
- Preserve existing care dates and history during upgrade, and extend the existing offline read-only experience to room data and filtering.

## Capabilities

### New Capabilities

- `plant-rooms`: Shared room management, optional plant assignment, and room-scoped care browsing.

### Modified Capabilities

- `care-tracking`: Optional fallback care anchors and independent not-started schedules without fabricated due dates.
- `mobile-frontend`: Optional-date plant forms, reminder photo previews, and a Not started yet section with individual care entry.
- `plant-catalogue`: Room-aware plant search and browsing.
- `offline-pwa`: Cached room browsing and disabled room mutations while offline.

## Impact

- Backend: `internal/care/due.go`, plant/room storage, versioned SQLite and PostgreSQL migrations, and HTTP plant, room, Today, and calendar responses. The existing migration runner handles only version 1 and must support forward migrations.
- Frontend: `web/src/api.ts`, `PlantDialog.tsx`, `main.tsx`, styles, and the service-worker read allowlist. Reuse existing normalized thumbnails and cache-aware image loading.
- API: Allow an omitted or empty `care_start_date`; add optional room metadata, room endpoints, and a separate undated `not_started` collection to Today. Existing dated reminder fields remain intact.
- Validation: Extend existing care, repository, HTTP, and browser coverage, including upgrades from populated version-1 databases on both supported database engines.
- No new external services or dependencies are expected. Bulk care actions, room hierarchies, and calendar room filters are outside this change.

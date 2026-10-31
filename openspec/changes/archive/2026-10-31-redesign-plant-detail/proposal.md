## Why

Plant detail currently mixes room assignment, photo management, always-open care forms, notes, and history in one confusing stack. The reviewed Penpot layout gives everyday care a clear starting point and lets users correct a Wikipedia reference when automatic lookup chooses the wrong article.

## What Changes

- Adopt the approved Penpot layout for `/plants/:plantId`: a photo-led identity header and the German sections **Übersicht**, **Fotos**, and **Verlauf**, with responsive desktop and phone layouts.
- Put watering and fertilizing status beside their recording actions; open date/time and optional-note entry on demand, with confirmation and refreshed next-care information after saving.
- Show a compact seasonal care plan, saved plant notes, and recent activity in Übersicht. Keep photo upload/cover/identification controls in Fotos and dated notes, filters, and activity corrections in Verlauf.
- Consolidate name, species, room, plant notes, and schedule editing behind **Bearbeiten**; use a full-screen phone editor and an equivalent desktop dialog. Replace the always-visible detail room-assignment form with the editor's room selector.
- Add an optional editable **Wikipedia-Link** below the scientific name. A saved override takes precedence over automatic lookup; **Automatisch ermitteln** returns the draft to automatic lookup. Save and cancellation apply to the complete plant-edit draft.
- Preserve German copy, keyboard access, 320px support, offline read-only behavior, existing care calculations, and explicit photo identification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-frontend`: Define the detail sections, care-entry presentation, grouped editor, and automatic/manual Wikipedia reference behavior.
- `plant-catalogue`: Persist and validate an optional Wikipedia override without losing it during unrelated plant updates.
- `plant-rooms`: Move existing-plant room reassignment into Bearbeiten while preserving assignment, filtering, and failure guarantees.

## Impact

- Frontend: `web/src/main.tsx`, `styles.css`, `PlantDialog.tsx`, `PlantRoom.tsx`, `PlantPhotos.tsx`, `CareOverview.tsx`, `WikipediaReference.tsx`, `wikipedia.ts`, and API types; focused component extraction is expected.
- Backend: additive plant API field and SQLite/PostgreSQL migrations, storage reads/writes, and server-side Wikipedia URL validation. Existing records retain automatic lookup, and omitted fields on older update payloads preserve stored overrides.
- Verification: storage/migration and HTTP API contracts; Wikipedia resolver tests; browser coverage for responsive layout, care entry, room editing, photo identification, and override save/reset/cancel behavior.
- Design source: Penpot **Kratzbaum → Plant detail · Layout review**, including boards 01–07 and the updated Wikipedia field on board 07. No new runtime dependency is expected.

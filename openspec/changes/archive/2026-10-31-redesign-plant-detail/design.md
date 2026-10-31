## Context

See `proposal.md` for motivation and the delta specs for behavior. The current React app renders detail as a single block in `web/src/main.tsx`; `PlantRoom` adds a separate assignment form, `PlantPhotos` owns gallery/identification state, and `PlantDialog` already edits plant fields and supports inline room management. `CareEntryDialog` in `CareOverview.tsx` already supplies timestamp entry, submission locking, and focus management, but does not expose an optional care note.

Wikipedia references are currently resolved entirely in the browser by `wikipedia.ts` and rendered by `WikipediaReference.tsx`. No reference URL is persisted. `storage.Plant`, the list/detail queries and upsert in `internal/storage/plants.go`, and the presence-aware `plantInput`/`decodePlant` in `internal/httpapi/rooms.go` must gain the optional override. SQLite and PostgreSQL have paired numbered migrations. The current room input already distinguishes omission from an explicit clear.

The reviewed visual source is Penpot file **Kratzbaum** (`9c72c01a-ed94-81f2-8008-c5d26b7e9bfd`), page **Plant detail · Layout review** (`03a318c7-debb-8073-8008-e004d2d1836f`). Boards 01–07 cover desktop Übersicht, mobile Übersicht/Fotos/Verlauf, care entry and confirmation, and mobile editing. Board 07 (`03a318c7-debb-8073-8008-e006464feec2`) includes the final Wikipedia-Link addition. Desktop editing uses an equivalent dialog; there is no separately approved desktop-editor drawing. Sample plant content, dates, care advice, and the sample Unsplash image are illustrative and must not ship as household data or generated advice.

## Goals / Non-Goals

**Goals:**

- Implement the reviewed hierarchy with reusable detail sections and one plant-edit draft.
- Preserve the existing care calculator, explicit identification flow, room-management guarantees, and offline read model.
- Add a backward-compatible, shared manual Wikipedia override with explicit reset semantics.

**Non-Goals:**

- Redesign Today, Calendar, Rooms, login, or the plant-creation photo/identification workflow.
- Add care recommendations, arbitrary external reference sites, new Wikipedia scraping, or offline article storage.
- Add general real-time collaborative conflict resolution or new nested page routes for each detail section.

## Decisions

### 1. Extract a detail container and keep section selection local

Extract a focused plant-detail container from `main.tsx` with an identity header, accessible tab navigation, an overview, and activity history. Reuse `PlantPhotos` within Fotos and existing activity/note controls within Verlauf. Fresh visits and opening a different plant select Übersicht; saves and refreshes retain the current section. Keep `/plants/:plantId` as the canonical route. Use tab roles, selected state, associated panels, and keyboard navigation without URL changes.

Keep pending photo identification/review state in the detail container or a mounted gallery panel so switching tabs does not reset an in-flight attempt or permit conflicting saves. Clear unconfirmed results on a plant/source change as today. Extracting UI boundaries is preferable to adding more conditionals to the existing long JSX block; introducing an additional routing hierarchy would add URL behavior that was not part of the review.

### 2. Follow the approved responsive hierarchy and visual language

Use the warm background `#F6F5EF`, paper `#FFFEFA`, ink `#23352B`, green `#33694B`, and pale green `#E8EFE5`, rounded cards, restrained dividers, and the Penpot typography/spacing hierarchy. Keep watering blue, fertilizing ochre, photos green, and notes purple with icons and labels. The phone layout is one column; desktop uses the care/recent-activity column with plan/plant notes alongside it. Cover imagery uses the actual saved photo with preserved proportions and a safe fallback.

Retain four primary navigation destinations and German locale behavior. At 320px, allow names, URLs, status labels, and action labels to wrap; do not introduce page-level horizontal scrolling. Tab and filter controls must remain operable. The desktop edit dialog should have a bounded height and scrollable body; the phone editor fills the viewport. Save/cancel controls remain reachable with a phone keyboard and do not cover fields. This uses the approved content groups rather than shrinking the tall phone drawing into a desktop modal.

### 3. Reuse server-derived care state and on-demand entry

For the current plant, combine confirmed plant settings with its entries in the existing `/api/today` due, next, and not_started collections, independently of the currently selected room filter. Use explicit seasonal pause/unconfigured states from saved settings; do not infer a dated state from a failed or missing reminder read. Retain cached refresh-time feedback offline and expose unavailable state when the relevant snapshot is missing.

Replace always-open `QuickEntry` forms with the existing care-entry dialog adapted to a phone sheet and optional note. Extend its focus traversal to include the textarea. Pass the note into the existing `record` callback/activity request rather than create a second note activity. Keep duplicate-submission protection and activity idempotency. A confirmed creation closes the form and announces success; refresh history, Today, and calendar invalidation. Only display a next date from a confirmed refreshed schedule; a failed refresh must not cause a second write. No new care-calculation endpoint or client-side date arithmetic is needed.

### 4. One editor owns details, room, plant notes, and schedule

Reuse/refactor `PlantDialog` for editing, separating its editing presentation from the unchanged creation flow. Group controls as in board 07, including independently editable summer/winter intervals and pause states even though the mockup's winter example is paused. Plan Ändern and plant-notes editing launch the same draft and focus the relevant group. Remove the standalone detail `PlantRoom` UI; retain its data-preservation and submission-locking guarantees in the editor.

Track changed fields against the initial draft. Before an existing-plant save, read the latest plant and overlay deliberate draft changes so a room-only edit does not resend stale unrelated fields. Abort the write if the read fails, access is lost, or the user has left the plant. Preserve common name/family, cover metadata, and Wikipedia override unless explicitly edited; omit an unavailable room input. This extends the current `PlantRoom` read-before-write pattern. It does not promise atomic resolution of concurrent edits made after that read.

Persistent `plant.notes` are edited here and summarized in Übersicht. Dated notes are created from Verlauf through a text-only entry form using server submission time, and remain correctable through history controls. They are different data and must not be conflated.

### 5. Persist only the manual Wikipedia override

Add `wikipedia_url TEXT NOT NULL DEFAULT ''` with the next paired SQLite/PostgreSQL migration and add it to `storage.Plant`, all plant reads/upserts, and frontend `Plant`/`PlantInput` types. Empty means automatic; no derived URL or separate mode flag is persisted. Existing rows therefore keep automatic lookup without backfill requests.

Use presence-aware decoding alongside the existing optional care-start/room handling: omitted `wikipedia_url` preserves the previous value, an explicit empty string clears it, and a nonempty string is validated/normalized before any plant write. Creation defaults to empty and does not gain a new required field. Update species-confirmation and remaining plant-update callers to omit an unchanged reference rather than replay a stale override. A separate reference endpoint or storing automatically resolved results would introduce unnecessary coordination and stale derived data.

### 6. Separate editor display value from reference intent

The edit draft tracks automatic/manual mode, the displayed URL, and whether the user deliberately changed reference intent. In automatic mode, the existing resolver can prefill the display without making the field dirty. In manual mode, preserve the saved URL even if the scientific name changes. Manually replacing the URL changes only the draft; clearing it or choosing Automatisch ermitteln sets automatic mode and resolves the draft's current name. Submitting an unchanged automatic value must not persist it as an override. Resetting and cancelling must not mutate the server.

Use abort/generation guards for name, plant, and reference-intent changes. A late automatic response cannot overwrite manual typing or a newer result. An automatic lookup error leaves reference intent automatic and does not block unrelated valid edits. Detail renders a saved override directly without a lookup and derives the accessible language indicator from its host. Without a scientific name, render a separate Wikipedia label beside the species fallback. Saved override strings can use existing authorized plant caching; third-party responses/articles remain excluded.

### 7. Validate URL shape consistently without a third-party save dependency

Use standard URL parsing in both frontend feedback and the authoritative Go validation. Accept HTTPS `de.wikipedia.org` and `en.wikipedia.org`; normalize `de.m.wikipedia.org` and `en.m.wikipedia.org` to desktop equivalents, trim outer whitespace, allow only absent/default HTTPS ports, require a nonempty `/wiki/` title, reject credentials and queries, and preserve valid encoded section fragments. Reconstruct the allowed host/path/fragment rather than trust a host suffix match. Cover encoding and malicious-host cases with fixtures shared conceptually across Go and TypeScript tests.

Return the existing German validation-error envelope and retain the draft for correction. Links use `target="_blank"` and `rel="noopener noreferrer"`. URL-shape validation does not assert article existence, species equivalence, or availability, and server-side saving does not fetch a user-supplied URL. Restricting to the existing German/English hosts retains the current reference contract; expanding supported languages/sites is outside this change.

## Risks / Trade-offs

- [Existing tests assume inline room forms and visible gallery controls] → Update the flows to open Bearbeiten/Fotos while retaining their data-preservation, identification, failure, and service-worker assertions.
- [Automatic prefill accidentally becomes a persistent override] → Track reference intent separately; test unrelated saves, name changes, typing during lookup, reset, cancellation, and reload.
- [Hidden panels lose pending state or allow competing writes] → Keep identification state scoped to the plant and retain shared busy coordination across sections and dialogs.
- [Refresh failure looks like a failed mutation] → Separate confirmed writes from follow-up reads and never retry a confirmed write as a refresh recovery mechanism.
- [Read-before-write has a remaining concurrency window] → Preserve existing guarantees for unrelated changes confirmed before the latest read; defer general optimistic concurrency control.
- [The mobile drawing is longer than a physical viewport] → Implement scrolling, keyboard-safe action placement, visible focus, and test at 320px as well as the 390px reference.
- [Manual links can be taxonomically wrong or point to a missing article] → Treat them as explicit user choices and provide a preview action and automatic-reset control without claiming verification.

## Migration Plan

1. Add and test the next numbered migration for both database dialects; existing plants receive an empty override and all existing rows/media/history are retained. Extend the shared storage upgrade contract rather than alter prior migrations.
2. Deploy the additive storage/API support with the frontend that can display and edit the new field. No credential/configuration changes or background lookup jobs are needed.
3. Exercise the migration and create/read/update/reset contracts against SQLite and the repository's isolated PostgreSQL test setup, then run focused browser checks with the normal service worker enabled where relevant.
4. Recheck the implementation against Penpot boards 01–07, German localization, direct plant URLs, and 320px/desktop layouts. Existing plant-creation and identification flows remain regression checks.
5. If rollback is required, retain the additive column while running the older app; its existing upsert does not reference that column, so saved overrides remain stored for a later upgrade even though old clients cannot display them. Do not drop the column to roll back the UI.

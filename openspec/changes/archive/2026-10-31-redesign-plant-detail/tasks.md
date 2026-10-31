## 1. Persist and validate Wikipedia overrides

- [x] 1.1 Add the next paired SQLite/PostgreSQL migration for `plants.wikipedia_url` with an empty default and extend `storage.Plant`, list/detail scans, and upserts; verify storage round trips and repeatable upgrades preserve existing records, photos, activities, and care anchors on both dialects.
- [x] 1.2 Add presence-aware `wikipedia_url` decoding to `internal/httpapi/rooms.go` and authoritative URL validation/normalization with German errors; verify HTTP contracts for omitted-field preservation, explicit-empty reset, valid URLs/mobile hosts/fragments, invalid schemes/hosts/credentials/ports/queries/paths, and atomic rejection of invalid plant saves.
- [x] 1.3 Extend frontend `Plant`/`PlantInput` types and audit plant-update callers, including gallery species confirmation and room-related saves, to omit unchanged override intent; verify identifying a plant, editing unrelated fields, and changing photos/cover preserve a previously saved override and `npm run typecheck` passes.

## 2. Build the automatic/manual Wikipedia draft flow

- [x] 2.1 Extend `WikipediaReference` to render a saved override without automatic requests, retain German/English new-tab labels, and show a separate Wikipedia link when the scientific name is absent; verify automatic resolver regressions plus override precedence, absent-name rendering, and cached offline display in focused tests.
- [x] 2.2 Add the optional Wikipedia-Link field below the scientific name in the existing-plant edit draft, with automatic prefill, Automatisch ermitteln, clearing/reset behavior, URL feedback, and an accessible preview action; verify automatic prefill alone does not create an override, save persists a deliberate change/reset, and cancellation preserves the saved value.
- [x] 2.3 Guard lookup results by plant, draft name, and reference intent, and keep failed automatic lookups independent of plant saving; verify delayed lookups cannot overwrite manual typing or a newer plant/name and that valid unrelated edits can save after lookup failure.

## 3. Structure plant detail around the approved layout

- [x] 3.1 Extract the plant-detail container/header from `main.tsx` and build accessible Übersicht/Fotos/Verlauf tabs while retaining `/plants/:plantId`; verify a direct visit defaults to Übersicht, a different plant resets the section, refreshes retain it, and keyboard tab navigation works without writes.
- [x] 3.2 Build Übersicht with current care states/actions, a seasonal plan summary, persistent plant notes, and recent activities linking to Verlauf; verify overdue/today/upcoming/not-started/paused/unconfigured states from confirmed data, independence from the selected room filter, and explicit unavailable feedback on failed reminder reads.
- [x] 3.3 Place the existing gallery in Fotos with upload, cover selection, deletion, and one-shot saved-photo identification; verify tab changes retain pending review state and shared busy locks, while plant/source changes invalidate stale candidates and no upload/render triggers identification.
- [x] 3.4 Place history, type filters, text-only new-note entry, and activity edit/delete actions in Verlauf; verify saved plant notes remain separate from dated activities, new notes use server submission time, and correcting or deleting activities refreshes affected views.

## 4. Consolidate plant editing and care entry

- [x] 4.1 Group the existing-plant editor into Pflanzendetails and Pflegeplan, including room assignment, plant notes, both seasonal intervals/pause controls, and optional care start; connect Bearbeiten, plan Ändern, and plant-notes editing, remove the standalone detail room form, and verify the complete draft saves/cancels as one operation while the creation-photo flow remains intact.
- [x] 4.2 Carry forward read-before-write room safeguards using changed-field tracking and latest-plant merging, with aborts on failed reads, navigation, or access loss; verify room-only saves preserve newer unrelated fields/common name/family/reference, unavailable rooms do not clear assignments, and confirmed room edits update Plants/Today filters.
- [x] 4.3 Replace always-open detail care forms with the shared date/time dialog and optional care note, using a mobile bottom sheet and desktop dialog; verify timezone-aware/backdated saves create one care activity containing the note, cancellation creates none, and keyboard focus includes all fields and returns to the launcher.
- [x] 4.4 Separate successful mutations from follow-up refresh outcomes and announce confirmed care saves with a next date only when available; verify duplicate clicks create one activity, failed saves retain timestamp/note, and a failed post-save refresh never resubmits the confirmed event or fabricates a deadline.

## 5. Match Penpot across devices and states

- [x] 5.1 Apply the approved palette, activity colors/icons, card hierarchy, typography, image cropping/fallbacks, and desktop columns; compare populated and empty detail states against Penpot boards 01–04 and verify phone layouts at 320px and 390px plus a 1440px desktop without horizontal page scrolling.
- [x] 5.2 Implement the full-screen phone editor, bounded desktop dialog, keyboard-safe action placement, and mobile care sheet using boards 05–07; verify fields and save/cancel actions remain reachable on small screens, labels and targets meet accessibility requirements, and focus is contained/restored.
- [x] 5.3 Preserve German loading/error/validation feedback, offline read-only controls, cached refresh timestamps, and unavailable-offline states across the three sections; verify reconnect refreshes content without replaying writes and the service worker caches no Wikipedia/Wikidata responses or articles.

## 6. Regression and acceptance verification

- [x] 6.1 Update affected Playwright flows in `plant-room.spec.ts`, `identification.spec.ts`, `german-localization.spec.ts`, `care-rooms.spec.ts`, and `flows.spec.ts` to use the new sections/editor; verify the existing preservation, failure, focus, and service-worker assertions continue to pass rather than removing them to accommodate the layout.
- [x] 6.2 Add end-to-end coverage for Wikipedia override save/reload, unchanged automatic prefill, reset/save, reset/cancel, invalid input, late lookup, and unrelated species/room updates; verify saved overrides work across authorized reads and no automatic lookup replaces them.
- [x] 6.3 Run frontend unit tests, type checking/build, the Go suite with SQLite and the repository's isolated PostgreSQL test configuration, and the affected browser suites; record results and any environment limitation in the change artifacts, and confirm no unrelated screens or creation workflows regressed.
- [x] 6.4 Complete a final comparison with Penpot boards 01–07 and verify the proposal's acceptance scenarios at phone and desktop widths, including empty/offline/error states; record the review outcome and run `openspec validate redesign-plant-detail --strict`.

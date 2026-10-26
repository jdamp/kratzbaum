## 1. Database upgrades and room storage

- [x] 1.1 Extend `internal/storage/store.go` to apply ordered, dialect-specific, ledger-backed forward migrations without changing migration 1; verify fresh startup, populated version-1 upgrade, repeated startup, and rollback of a failed migration in repository tests.
- [x] 1.2 Add version-2 SQLite and PostgreSQL migrations for shared rooms, unique normalized names, and indexed nullable plant membership with `ON DELETE SET NULL`; verify existing plants, care dates, photos, activities, and sessions survive the upgrade and foreign-key integrity is retained.
- [x] 1.3 Add room storage operations and normalized name validation, and extend plant reads/writes for optional membership; verify room creation/rename, duplicate-name rejection, assign/move/unassign, invalid references, and deletion preserving plants/history in the shared repository contract on both database engines.

## 2. Optional care anchors and schedule evaluation

- [x] 2.1 Make the fallback care anchor optional in `internal/care/due.go` and return separate dated and not-started schedule results; verify independent first watering/fertilizing, absent anchors, explicit fallback dates, paused/unconfigured seasons, and season switches in care tests while preserving calendar-day/DST behavior.
- [x] 2.2 Update HTTP plant validation and presence-aware input handling to accept omitted/empty care dates on creation, validate nonempty dates, preserve an omitted date or room on update, and allow explicit date clearing/room unassignment; verify create/edit round trips and invalid-input errors in API tests.
- [x] 2.3 Adapt the shared HTTP schedule calculation to emit Today `not_started` items with interval, room, and photo metadata while retaining dated `due`/`next` fields and limiting Calendar to dated results; verify empty arrays, no zero-date leakage, independent care starts, backdating, duplicate submissions, event correction/deletion, and note/photo noninterference in API tests.

## 3. Room API

- [x] 3.1 Add authenticated room list/create/update/delete endpoints under `/api/rooms` using existing UUID, CSRF, and error conventions; verify valid operations, blank/oversized/case-insensitive duplicate names, malformed/missing IDs, access denial, and CSRF rejection in HTTP tests.
- [x] 3.2 Integrate plant membership validation and useful conflict errors for a deleted or nonexistent room; verify invalid assignment is recoverable and species confirmation/photo changes preserve room membership and optional-date state in API regression tests.

## 4. Plant forms and room controls

- [x] 4.1 Extend `web/src/api.ts` with room, membership, and not-started response types and backward-compatible handling of cached Today payloads; verify frontend type checking and any changed request/cache behavior with existing unit tests.
- [x] 4.2 Update `PlantDialog.tsx` with a blank-by-default optional Care started field, explanatory text, an optional room selector, and accurate saved-plant summaries; verify a plant can be saved without an anchor or room, dates can be cleared, and identification/photo-recovery flows retain input in browser tests.
- [x] 4.3 Add Manage rooms controls in Settings with entry from the plant form, recoverable create/rename errors, and deletion confirmation explaining unassignment; verify the complete create/rename/delete flow and that room management does not discard an open plant form unexpectedly.

## 5. Room browsing and Today care

- [x] 5.1 Separate the complete plant snapshot from local catalogue search results and share room selection across Plants and Today; verify combined room/search filtering, All rooms, Unassigned, room labels on cards/detail, accurate empty states, and selection retention across tab navigation.
- [x] 5.2 Apply room selection to every Today care section, collection preview, and displayed count; verify care actions remain usable after a catalogue search excludes their plants and deleting the selected room resets to All rooms only after a confirmed refresh.
- [x] 5.3 Add the Not started yet section and a shared individual dated care-entry flow for due/not-started items; verify first-care transitions affect only the chosen care type, selected completion dates are honored, errors retain input, repeated clicks cannot duplicate care, and correction/deletion refreshes Today and Calendar.
- [x] 5.4 Add cover-photo previews to due, upcoming, and not-started reminder rows using existing cached media loading, stable fallbacks, and activity labels/icons; verify correct covers, missing/failed images, cover changes, keyboard use, and 320 CSS-pixel layout in browser tests.

## 6. Offline and identity integration

- [x] 6.1 Add room-list reads to the service-worker allowlist and independently handle unavailable room metadata while retaining other readable collection snapshots; verify cached Plants/Today can change room filters offline and uncached rooms show unavailable feedback rather than false empty/unassigned data.
- [x] 6.2 Disable new room mutations and Today care actions while offline, keep snapshot refresh times visible, and refresh confirmed room/plant/Today reads on reconnect and successful mutation; verify disconnected saves are not queued and missing cached images do not block browsing.
- [x] 6.3 Include rooms, selected room, and new editing state in identity/access-loss clearing; verify logout/401/403 remove visible and cached room information and existing authentication routing remains intact.

## 7. Integration verification and documentation

- [x] 7.1 Add end-to-end coverage for creating an unstarted plant with a photo in Arbeitszimmer, recording individual care, filtering rooms, moving the plant, renaming/deleting a room, and offline reading; verify the new scenarios and existing creation, identification, and calendar flows pass with `npm run test:ui` against the test server.
- [x] 7.2 Run `go test ./...` with SQLite and the existing PostgreSQL integration harness using a project-specific disposable database ending in `_test`, without logging credentials; verify migration and shared repository/API cases execute on both engines rather than silently skipping PostgreSQL coverage.
- [x] 7.3 Run frontend `npm test`, `npm run typecheck`, and `npm run build`, checking the rebuilt embedded frontend output; verify all checks pass and inspect the feature at 320 CSS pixels. If using a container test target, build it with `/builder/bin/buildctl`.
- [x] 7.4 Update README guidance for optional care anchors, Not started yet, room management/filtering, and preserving existing dates during upgrade; verify the documented flow matches the implemented behavior and validate this OpenSpec change with `openspec validate improve-plant-care-and-rooms --strict`.

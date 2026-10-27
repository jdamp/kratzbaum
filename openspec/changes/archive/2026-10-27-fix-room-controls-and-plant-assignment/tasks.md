## 1. Room button feedback

- [x] 1.1 Correct disabled versus pending cursor styling and use exactly `Room “<name>” saved.` for successful create/rename; verify computed cursor, accessible pending feedback, exact confirmation text, and consecutive creation before/after successful and rejected writes in browser tests, including normal service-worker operation and the existing stalled-read regression.

## 2. Existing-plant assignment

- [x] 2.1 Add a labelled room selector and explicit Save room action beside the current room on plant detail, retaining the full editor selector; verify assignment from Unassigned, movement to another room, unassignment, unchanged-state disabling, keyboard operation, and 320px layout with adequate touch targets.
- [x] 2.2 Save through the existing plant API using latest fetched editable data; apply confirmed membership across detail, Plants, and Today without blocking on full refresh, and guard pending writes, stale reads, identity/navigation changes, and conflicting edits. Verify duplicate prevention, failed-read/no-write and failed-write/retry behavior, unavailable/offline disabling, delayed responses after navigation, and preservation of unrelated fields, schedules, photos, and history.

## 3. Integration and delivery

- [x] 3.1 Update README for direct plant-detail assignment, run frontend unit tests and type checking, rebuild embedded assets, and run the full browser suite; verify room and care regressions pass and inspect the assignment form at phone and desktop widths.
- [x] 3.2 Run `openspec validate fix-room-controls-and-plant-assignment --strict` and `git diff --check`; verify the change contains only the scoped implementation, tests, documentation, generated assets, and OpenSpec artifacts.

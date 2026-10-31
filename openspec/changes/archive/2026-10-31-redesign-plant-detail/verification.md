## Implementation outcome

Completed the approved plant-detail redesign and Wikipedia override behavior on 2026-10-31. Synced the three delta specifications into the main specs and archived the completed change on the same date.

- Detail now uses an identity header and accessible Übersicht/Fotos/Verlauf tabs. The overview prioritizes confirmed care status, with a plan, persistent plant notes, and recent activity; the gallery retains identification state across tab switches.
- Bearbeiten groups plant details and care settings in a full-screen phone editor or desktop dialog. Room-only saves merge deliberate changes onto the latest plant, preserving unrelated values. Seasonal pause controls have independent labels and editor focus is trapped/restored.
- Care entry opens on demand with a chosen timestamp and optional activity note. Confirmed writes are distinguished from failed follow-up reads, and failures retain the draft without creating duplicate activities.
- `wikipedia_url` is stored through paired additive SQLite/PostgreSQL migrations. Omission preserves a saved override; an empty string resets it. Manual URLs are normalized and validated without a network dependency. Automatic prefill does not become an override, late lookups cannot overwrite typing, and cancellation does not save a reset.

## Automated verification

| Check | Result |
| --- | --- |
| `go test ./...` with `KRATZBAUM_TEST_POSTGRES_URL` set to the isolated `kratzbaum_redesign_test` database | Passed, including SQLite/PostgreSQL repository and API contracts, repeatable migrations, and PostgreSQL backup/restore |
| `cd web && npm test` | Passed: 25 tests in 5 files |
| `cd web && npm run typecheck` | Passed |
| `cd web && npm run build` | Passed; rebuilt the tracked embedded assets and PWA worker |
| `cd web && npx playwright test --workers=1` against the final isolated application | Passed: 67 tests, including all existing browser suites |
| `openspec validate redesign-plant-detail --strict` | Passed |
| `git diff --check` | Passed |

Browser coverage includes keyboard tab navigation; phone/desktop fit; care backdating, notes, cancellation, duplicates and failed refreshes; editor focus loops and return focus; independent seasonal settings; room moves, deleted rooms, unavailable rooms and late responses; gallery identification and cancellation; note correction; creation-photo recovery; German reference fallback; manual reference save/reload/reset/cancel and invalid input; delayed lookups; cached override access offline; and explicit history-read failure states.

## Visual acceptance

Compared populated desktop/phone detail, the grouped editor, gallery/history, and care sheet with Penpot **Kratzbaum → Plant detail · Layout review**, boards 01–07. Verified all three sections at 320px, 390px, and 1440px without horizontal page scrolling. The app retains its existing topbar/navigation and uses an Arial fallback where Inter is unavailable, preserving the approved weight hierarchy. Sample imagery and household content were seeded only in a separate temporary visual database.

Local review captures:

- `/tmp/kratzbaum-redesign-desktop-final.png`
- `/tmp/kratzbaum-redesign-mobile-final.png`
- `/tmp/kratzbaum-redesign-editor-final.png`
- `/tmp/kratzbaum-redesign-care-final.png`

## Test environment notes

- The first CI run passed frontend, Go/database, and container smoke checks; 66 browser tests passed and one failed because its timestamp expectation assumed Berlin while the container used UTC. The care-entry test now explicitly supplies both UTC and Europe/Berlin deployment timezones and asserts the corresponding saved timestamps. All 12 plant-detail browser tests passed against an isolated UTC application after the correction.

- PostgreSQL 18 client binaries were extracted into a temporary directory to match the shared PostgreSQL 18 server; the system client was PostgreSQL 15. Connection credentials were kept outside the repository and were not printed.
- Chromium used the existing browser cache via `PLAYWRIGHT_BROWSERS_PATH`. Browser servers used isolated temporary data directories and JPEG fixtures. Because this workspace has no HEIC decoder, their decoder executable was `/bin/false`; browser HEIC selection/fallback scenarios and the Go media suite passed, but no production-container HEIC conversion smoke test was run for this change.
- The frontend build retains the pre-existing Vite/Workbox `inlineDynamicImports` deprecation warning; it does not fail the build.

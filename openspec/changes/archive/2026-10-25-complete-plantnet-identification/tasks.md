## 1. Backend identification sources

- [x] 1.1 Extract shared durable-attempt/provider execution from `internal/httpapi/server.go` while preserving the existing saved-plant upload route and response contract; verify existing one-shot identification tests pass and concurrent duplicate requests cause at most one upstream call.
- [x] 1.2 Add `POST /api/identifications` for normalized draft-photo identification through the existing auth/CSRF and upload validation paths; verify a fake-provider test returns candidates without creating plants, photos, cover assignments, or photo activities, and invalid uploads never reach the provider.
- [x] 1.3 Add `POST /api/plants/{id}/photos/{photoID}/identify` using ownership-checked, bounded full JPEG reads; verify a valid saved photo is identified without photo/activity duplication, an original larger than the compressed-upload limit is handled correctly, and missing, mismatched, or corrupt sources cause no upstream request.
- [x] 1.4 Ensure all identification source routes preserve duplicate-attempt semantics, unavailable/no-match/quota/timeout states, JPEG part MIME, and credential redaction; verify fake-provider tests cover completed/pending duplicates, no key, HTTP-client and context timeouts, and supported-format normalization without live API calls.

## 2. Shared frontend identification

- [x] 2.1 Add typed candidate/result/error contracts and separate draft-upload, saved-plant-upload, and saved-photo identification helpers in `web/src/api.ts`, taking a caller-owned attempt key; verify API tests assert the correct routes, request bodies, keys, CSRF handling, and absence of automatic retries.
- [x] 2.2 Extract shared identification state and review controls from `web/src/main.tsx`, including explicit submission, current-candidate selection, independent confirmation progress, source/plant generation guards, and immediate in-flight protection; verify focused frontend tests exercise stale/delayed responses, cleared selection, duplicate actions, and candidate-save retry without provider resubmission.
- [x] 2.3 Pass bootstrap availability and live connection state to both identification flows, display accessible unavailable/error/progress states, and preserve the service-worker POST exclusion; verify no-key/offline controls submit nothing and identification responses are not cached or replayed.

## 3. New plant flow

- [x] 3.1 Add Identify species beside the draft photo in `web/src/PlantDialog.tsx`, with confirmation updating draft scientific/common names only and manual scientific-name edits clearing candidate-derived common metadata; verify browser tests show no plant creation before Add plant and retain names, notes, schedules, file selection, and simplified species fields across review/cancel.
- [x] 3.2 Integrate identification progress and dismissal with the creation phases and focus trap, without changing save-then-upload recovery; verify cancellation/reopen ignores late results, HEIC preview fallback still permits identification, and photo-upload retry/continuation reuse the confirmed saved plant without repeating identification.

## 4. Existing plant flow

- [x] 4.1 Add gallery-photo Identify species actions and retain identification from a newly selected file, both using the shared review; verify browser tests assert selection alone sends no provider request, saved-photo identification uses its ID, and neither source adds a catalogue photo or activity.
- [x] 4.2 Save confirmed existing-plant species using refreshed plant details and the existing update API, preserving family, unrelated fields, and the current common-name fallback; verify cancel, target switch, save rejection/retry, and successful refresh/Wikipedia-link behavior without another identification call.

## 5. Integration validation and documentation

- [x] 5.1 Update README to explain optional server-side configuration, identification before saving, saved-photo reuse, explicit source uploads, and independent candidate confirmation; verify the documented actions match the implemented new/existing flows and no key appears in frontend assets or responses.
- [x] 5.2 Extend and run the browser creation/detail regressions for no automatic identification, stale candidates, manual creation, unavailable/offline/error states, and partial photo success; verify keyboard/focus operation and no horizontal scrolling at 320 CSS pixels, using `/builder/bin/buildctl` for the production `browser-tests-result` target.
- [x] 5.3 Run the backend suite, frontend unit/type/build checks, and relevant container checks, then regenerate embedded production assets; verify checks pass, existing SQLite/PostgreSQL repository coverage remains intact, and generated assets under `cmd/kratzbaum/web/dist` match the source build. Use the existing disposable PostgreSQL test procedure where required and never print or commit connection credentials.

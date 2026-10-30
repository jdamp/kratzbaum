## 1. Provider request and failure handling

- [x] 1.1 Remove the injected project query parameter in `internal/identification/plantnet.go`, strip legacy project query parameters from configured endpoints, and retain supported query values and multipart JPEG handling; verify with a strict fake provider that rejects project and asserts API-key placement, image content type, endpoint path, and one request per attempt.
- [x] 1.2 Add typed safe status/transport metadata and classify 404 no-match, 401/403 account rejection, 400/422 request rejection, 429 quota, malformed responses, service errors, and timeouts; verify table-driven client tests and fake transport cases, preserving no automatic retry.
- [x] 1.3 Unify fresh/replayed failure messages and add one structured sanitized log per failed upstream attempt in the HTTP layer; verify API tests capture attempt ID, code, status/transport category, identical fresh/replayed messages, no replayed provider call or duplicate log, and absence of injected secrets, URLs, provider bodies, and image data from logs and responses.

## 2. Direct gallery identification

- [x] 2.1 Extract a shared identification controller with explicit start(source), preserving pending guards, generation invalidation, candidate confirmation, and busy callbacks; verify Add Plant still requires its explicit Identify species action, retains draft input, and never saves species before confirmation or saves a plant before Add plant.
- [x] 2.2 Remove the identification-only picker and standalone Identify species control from `PlantPhotos.tsx`, wire each Identify this photo action to start immediately, and retain source-associated accessible review, unavailable explanations, and ordinary Add photo; verify browser tests show one request for the clicked photo ID and zero requests from opening detail or uploading a photo.
- [x] 2.3 Update existing-gallery and former existing-file browser cases to cover same-photo retries after failure/cancellation, rapid duplicate activation, switching source, navigation with a pending result, candidate-save retry without re-identification, unchanged photos/activities and unrelated fields, offline/no-key states, keyboard focus, and a 320px viewport; verify the targeted identification browser suite passes while retaining backend file-identification API coverage.

## 3. Documentation and integrated validation

- [x] 3.1 Update README identification instructions for direct gallery actions and Add photo before identifying a new image on an existing plant, retain Add Plant guidance, and document endpoint-path project selection plus safe pod-log failure categories; verify no obsolete two-step detail instructions remain and examples contain no credentials.
- [x] 3.2 Run `go test ./internal/identification ./internal/httpapi`, frontend typechecking/unit tests/build, and relevant Playwright identification and plant-flow tests with fake providers; verify the request fix and both frontend entry points pass together without a live API key. Use `/builder/bin/buildctl` if container-based checks are needed, and record actual check results and any environment limitations.

## Validation results

- Passed: `go test ./internal/identification ./internal/httpapi`, including strict provider-query validation, HTTP failure categories, DNS/connection/TLS/timeout classification, sanitized failure logging, and stored-attempt replay.
- Passed: `npm --prefix web run typecheck`, `npm --prefix web test` (11 tests), and `npm --prefix web run build`. Regenerated tracked embedded frontend assets and normalized file permissions.
- Passed: `PLAYWRIGHT_BROWSERS_PATH=/home/paseo/.cache/ms-playwright KRATZBAUM_BASE_URL=http://127.0.0.1:18083 npm --prefix web run test:ui -- identification.spec.ts flows.spec.ts` (15 tests), using an isolated local SQLite server and intercepted identification responses. The default browser-cache path was absent; the installed cache worked. An offline test initially raced its upload; waiting for the gallery photo resolved it.
- Passed: `git diff --check` and `openspec validate simplify-photo-identification --strict`.
- No live PlantNet requests, container builds, or deployment changes were needed for implementation validation.

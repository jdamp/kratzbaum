## 1. Application foundations

- [x] 1.1 Create the Go module and small handler/service/storage package structure described in the design; verify the executable builds and `go test ./...` runs.
- [x] 1.2 Create the React/TypeScript/Vite frontend with client routing and a typed API boundary; verify type checking and a production build succeed.
- [x] 1.3 Implement validated configuration for database, media path, timezone, auth, PlantNet, and upload/decoder limits; verify invalid modes, invalid timezone, and incomplete OIDC settings produce explicit startup failures.
- [x] 1.4 Serve built frontend assets and the Go API from one origin with correct frontend navigation fallback; verify a detail-route reload works while unknown API/media routes do not return HTML.

## 2. Dual-database persistence

- [x] 2.1 Add SQLite and PostgreSQL storage initialization, parameter binding, and connection settings; verify temporary SQLite and a disposable PostgreSQL database both connect, and selected-backend failure does not fall back to SQLite.
- [x] 2.2 Add versioned migrations for plants, schedules, activities, media metadata, OIDC sessions/identities, and identification attempts in both dialects; verify clean initialization, repeated startup, and migration failure behavior on both engines.
- [x] 2.3 Implement catalogue, activity, media, and session/attempt repositories; verify a shared integration suite covers transactions, foreign keys, timestamps, deletion, and persisted retrieval on both engines.
- [x] 2.4 Establish a disposable PostgreSQL test setup and repeatable SQLite test mode; verify documented commands execute the same behavioral repository/API cases against each backend without touching an operator's homelab data.

## 3. Catalogue, notes, and care behavior

- [x] 3.1 Implement plant create/read/update/delete and searchable catalogue endpoints with optional species information; verify API scenarios include creation without identification, validation failures, search, and dependent-entry deletion.
- [x] 3.2 Implement dated note and completed watering/fertilizing entry, correction/deletion, and submission idempotency; verify backdating, repeated submission, and deleting the latest completed event preserve correct history.
- [x] 3.3 Implement per-plant interval validation and deterministic due-date calculation using the deployment timezone, care start date, active summer/winter interval, and seasonal pause; verify tests cover independent plants, late completion, invalid intervals, both season boundaries, unpausing, and daylight-saving transitions.
- [x] 3.4 Provide Today, plant timeline, and calendar read data with calculation/refresh metadata; verify mixed activity types, one outstanding task per enabled schedule, overdue ordering, and absence of fabricated completed care.

## 4. Media and PlantNet

- [x] 4.1 Build the image-normalization boundary for JPG/PNG/WebP and the bounded libheif decoder subprocess; verify supported fixtures become correctly oriented JPEGs, transparency is flattened, and invalid/oversized inputs and decoder timeouts fail without publishing output.
- [x] 4.2 Integrate staged persistent photos, thumbnails, cover selection/removal, photo activities, and cleanup; verify failed uploads do not change covers or add events and successful persisted media remain readable after a process restart.
- [x] 4.3 Implement the server-side PlantNet client and durable explicit-attempt idempotency; verify a fake upstream receives JPEG only, no ordinary photo upload triggers identification, duplicate attempts call upstream at most once, and timeouts are not automatically retried.
- [x] 4.4 Return ranked candidates and distinct missing-key/no-match/quota/timeout errors, with species changes requiring explicit confirmation; verify those errors/cancellation preserve plant data and no responses/logs expose the API key.

## 5. Shared-collection authentication

- [x] 5.1 Implement open mode and backend OIDC authorization-code login with PKCE/state/nonce validation and verified identity tokens; verify valid login and rejection of forged callback state/nonce, wrong issuer/audience, and expired/invalid tokens using a controlled provider.
- [x] 5.2 Add opaque application sessions, protected collection/media routes, write anti-forgery/origin checks, and online logout; verify anonymous media/API access and cross-site writes are rejected in OIDC mode and a logged-out session cannot be reused.
- [x] 5.3 Record actor attribution and expose identity/auth/cache-context bootstrap data without secrets; verify two authenticated users see/edit the same collection and open mode permits anonymous collection operations.

## 6. Frontend screens and visual system

- [x] 6.1 Implement warm surface/green action design tokens, reusable cards/forms/status indicators, phone bottom navigation, and desktop navigation; verify the three destinations and settings access at 320 CSS pixels and desktop widths, including keyboard focus and touch-target sizing.
- [x] 6.2 Implement searchable plant photo cards and Add/Edit Plant forms with species entry, care start date, individual watering interval, seasonal fertilizer settings, and pause controls; verify a plant can be created manually and validation errors retain form input.
- [x] 6.3 Implement Today care lists and compact activity-entry sheets with editable completed date/time and pending/error feedback; verify a successful save refreshes affected views, failed saves retain input, and duplicate clicks cannot record duplicate care.
- [x] 6.4 Implement plant detail, gallery/cover controls, note entry, and filterable activity history with correction/deletion; verify all four activity types are visible and adding a note/photo does not advance care schedules.
- [x] 6.5 Implement the month overview, selected-day agenda, and activity filters using shared type colours/icons/labels; verify busy-day information is readable on phones and completed/due status remains understandable without colour.
- [x] 6.6 Implement explicit upload/identify/review/confirm species entry; verify candidate cancellation preserves the form, missing PlantNet configuration still permits manual entry, and HEIC selection works without native browser preview.
- [x] 6.7 Implement loading/empty/error states, accessible dialog focus and feedback, and Settings/account information; verify keyboard operation through a create-plant and record-care flow and check the implemented palette's contrast.

## 7. Installation and offline caching

- [x] 7.1 Add the manifest/icons and a custom Workbox service worker through Vite's injectManifest strategy with an update prompt; verify the production app shell reloads offline and the manifest is recognized in a compatible browser.
- [x] 7.2 Add allowlisted successful-read caching, immutable photo caches with storage bounds, and refresh timestamps; verify cached catalogue/detail/calendar/photos load offline while uncached content shows its unavailable state.
- [x] 7.3 Add identity/context-scoped collection caches and cleanup across tabs on logout, observed 401/403, identity changes, and auth-mode changes; verify rejected online access never falls back to cached collection data and auth requests/tokens are absent from caches.
- [x] 7.4 Disable offline mutations/identification/fresh login, handle local offline logout, and revalidate identity/refresh reads on reconnection; verify a disconnected save is not queued and data remains cleared after offline logout until online session termination/revalidation.
- [x] 7.5 Invalidate affected retained reads after confirmed mutations and preserve forms during app updates; verify edited/deleted events and photos are not shown as current cached data and accepting an update is an explicit action.

## 8. Self-hosting and end-to-end validation

- [x] 8.1 Build the application image with frontend assets, Go runtime, and a working HEIC decoder; verify startup decoder checks and real-phone HEIC orientation/normalization in the final image.
- [x] 8.2 Provide SQLite and external-PostgreSQL deployment examples plus configuration, HTTPS/PWA, OIDC callback, PlantNet, and consistent database/media backup/restore documentation; verify both examples use one application origin and the PostgreSQL example can target a disposable external server.
- [x] 8.3 Verify persistence and backup restoration against each database backend by creating a plant with photos, notes, and care events, restarting/restoring the application, and confirming the same data and due states remain available.
- [x] 8.4 Run integrated browser/API checks on the production build for plant creation, per-plant seasonal care, notes/photos/calendar, explicit identification, OIDC shared access/logout, and cached offline reads; verify the critical failure cases from the specs and record the results.

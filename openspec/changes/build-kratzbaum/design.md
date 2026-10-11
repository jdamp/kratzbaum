## Context

See `proposal.md` for motivation and the capability inventory. The workspace contains OpenSpec setup but no application source, tests, or established frontend conventions.

Confirmed decisions are a shared collection, user-written care notes, per-plant watering intervals, per-plant summer/winter fertilizing intervals, schedules anchored to completed care, a northern hemisphere scope, a Go backend, and support for SQLite and PostgreSQL. The frontend layout, visual tokens, season boundaries, and deployment defaults below are proposed implementation defaults.

## Goals / Non-Goals

**Goals:**

- Keep the backend approachable for practising idiomatic Go: small HTTP handlers, explicit services, and a storage boundary.
- Serve the frontend and API from one origin and one application container.
- Make recording care convenient on phones while keeping history and catalogue views useful on desktop.
- Define consistent date, cache, and persistence behavior before implementation.

**Non-Goals:**

- Offline writes, synchronization queues, push reminders, multiple private collections, or application roles.
- Automatically generated care advice or background plant identification.
- Automatic transfer of existing data between SQLite and PostgreSQL, or multiple application replicas.

## Decisions

### 1. React/TypeScript frontend with Vite

Use React, TypeScript, Vite, and client-side routing. Build static assets and serve them from the Go application, with navigation fallback to the application shell for frontend routes. Keep `/api/`, `/auth/`, and `/media/` outside that fallback. Use a typed API client and feature-level hooks; local component state is sufficient for forms, filters, and dialogs.

This fits a same-origin PWA without adding another server runtime. Alternatives include Vue/Svelte, Go templates with HTMX, and a React server-rendering framework. The chosen frontend keeps interactive calendar and cached-data rendering straightforward; server rendering is not required for this collection-management scope. React documents the Vite/TypeScript setup at https://react.dev/learn/build-a-react-app-from-scratch.

### 2. Mobile navigation and screen hierarchy

Primary phone navigation has three labelled destinations: **Today**, **Plants**, and **Calendar**. Keep navigation at the bottom, respect device safe areas, and place Settings/account access in the header. Desktop uses the same destinations in a compact sidebar, with content using the available width.

| Screen | Content and primary actions |
| --- | --- |
| Today | Overdue care first, then due today and upcoming care; plant thumbnail, activity label, due date, and Water/Fertilize action. Successful recording updates the list after the server confirms it. |
| Plants | Searchable photo grid with plant name, species, and care-status badges. Two columns where phone width allows; one at narrow widths; more on desktop. Add Plant is a visible action. |
| Plant detail | Cover photo, name/species, photo gallery, watering/fertilizing status, edit actions, schedule settings, and a filterable activity timeline containing photos and user-written care notes. |
| Calendar | Month overview with activity markers; selecting a day opens its agenda. Phones show a readable agenda below the month rather than squeezing event text into cells. Distinguish completed activities from outstanding due care. |
| Add/Edit Plant | Name, optional species information, photos, care start date, watering interval, and summer/winter fertilizing intervals with an explicit paused option. Identification is an optional action within species entry. |
| Settings | Connection/cache status and refresh time, install/update guidance, deployment timezone/season information, and account/logout controls when OIDC is enabled. Server/database credentials are deployment configuration, not editable client settings. |

Example Today layout, with illustrative plant names and counts:

```text
+--------------------------------------+
| kratzbaum                  [Settings] |
| Today                                |
| 2 plants need care                   |
|                                      |
| Overdue                              |
| [photo] Window fern                  |
|         Watering - 2 days overdue     |
|         [Water]                       |
|                                      |
| Due today                            |
| [photo] Living room plant            |
|         Fertilizing                   |
|         [Fertilize]                   |
|                                      |
| [Today]    [Plants]    [Calendar]     |
+--------------------------------------+
```

Care buttons open a compact activity-entry sheet with the date/time defaulted to now and a save action; users can backdate completed care. Disable duplicate submissions while saving, retain form input on errors, and only report a completed activity after server acknowledgement. Plant detail supports editing/deleting an incorrectly logged activity. Schedule edits and corrections refresh Today, plant detail, and calendar data.

An identification flow is: choose an upload, explicitly request identification, review ranked names and scores, confirm a species, and save the plant. Canceling keeps the existing form and species unchanged. HEIC selection cannot depend on browser preview support: show filename/progress until a normalized preview is returned by the backend.

### 3. Visual language and accessibility

Use warm off-white surfaces, forest-green primary actions, prominent plant photography, restrained rounded cards, and readable typography. Define spacing, colour, radius, and typography tokens with CSS custom properties and component styles. This keeps the theme understandable; a full UI kit or utility framework remains unnecessary for the initial screen set.

Use consistent activity colours throughout Today, timelines, and calendars: watering blue, fertilizing amber, photos violet, and notes green. Every colour is accompanied by an icon and text label. Distinguish a scheduled item from a completed event with explicit text/status styling. Verify contrast in the implemented palette rather than relying on colour names.

Forms have persistent labels, field-level errors, keyboard operation, and visible focus states. Touch targets are at least 44 CSS pixels. Dialogs/sheets manage focus and announce saving/error states. Empty, loading, error, offline, and uncached-content states are part of each screen. The smallest supported viewport is 320 CSS pixels; horizontal page scrolling is not required.

### 4. Go application and persistence boundary

Use `net/http`, small request/response DTOs, services for catalogue/care/identification, and repository interfaces backed by `database/sql`. Use `modernc.org/sqlite` for SQLite and `pgx`'s SQL adapter for PostgreSQL. Keep queries parameterized and contain placeholder and type differences in storage adapters. Maintain versioned migrations for both dialects and run the same repository/API integration scenarios against both.

Proposed structure is `cmd/kratzbaum`, `internal/{config,httpapi,auth,plants,care,media,identification,storage}`, and `web/`. This is a future source layout; the current change contains planning artifacts only. A large web framework or ORM would reduce some setup, but explicit layers make Go and SQL practice more useful here.

Generate IDs in the application and store activity timestamps as UTC instants with equivalent serialization across engines. Records include plants, photos, care schedules, activities, OIDC identities/sessions, and explicit identification attempts. A note is an activity with text; a photo activity refers to stored media. There is no separate care-advice subsystem. For watering/fertilizing, corrections derive the latest completed date from the surviving activity records.

SQLite is the default, with a configurable local file, foreign keys enabled on connections, WAL where supported, and conservative write concurrency. PostgreSQL uses a configured connection URL, including the operator's chosen TLS options. A configured database failure stops startup; it never silently creates a substitute SQLite collection. Images use generated filenames on a persistent volume, with metadata in the selected database. Uploading a photo, changing the cover, and deleting media maintain consistent database/file references; incomplete temporary files are cleaned up.

Driver references: https://pkg.go.dev/modernc.org/sqlite and https://github.com/jackc/pgx.

### 5. Date semantics and seasonal schedules

Configure one deployment timezone (`APP_TIMEZONE`, default UTC). Intervals count local calendar days, preserving the expected date across daylight-saving changes. The server calculates authoritative due states and returns their calculation timestamp and active season.

Use a fixed northern hemisphere preset: April 1 through September 30 is summer; October 1 through March 31 is winter. These boundaries are an implementation default rather than a claim about every plant's growing season. Watering has one positive day interval per plant. Fertilizing has separate positive intervals for each season, with either season optionally paused. Reject zero/negative intervals; paused is an explicit state.

For an enabled activity, the next due date is the latest completed activity's local date plus its applicable interval. Before any completed activity exists, use the plant's editable care start date, defaulting to its creation date. Do not manufacture a completed event for this anchor. Fertilizing uses the season active on the evaluation date; switching seasons or editing intervals recalculates outstanding due dates from the same anchor without changing history. Unpausing resumes that calculation and can make care immediately overdue.

The calendar shows recorded events plus one outstanding due date per enabled plant/activity schedule. Future repeated completions are not projected as facts. Completing, backdating, editing, or deleting an activity recomputes due states; adding a note or photo does not reset either schedule.

### 6. Upload normalization and explicit identification

Use Go's JPG/PNG codecs and `golang.org/x/image/webp` for those formats. For HEIC, bundle libheif's decoder tool and required HEVC decoding libraries in the application image, invoke it directly from Go with generated paths and a deadline, then process its decoded image in Go. Keep normalization behind a small media boundary. Direct native Go bindings are an alternative, but a subprocess keeps native build integration out of the application and makes decode failure easier to contain. See https://github.com/strukturag/libheif.

Validate actual file content rather than the extension alone, limit upload size and decoded dimensions, bound decode concurrency and temporary storage, apply orientation once, flatten transparency onto a consistent background, resize with aspect ratio preserved, and encode a metadata-stripped JPEG. Generate smaller catalogue thumbnails. The initial limits are deployment configuration with documented defaults. HEIC support is required in the supported container image; a missing decoder is a startup configuration error, not a late surprise at upload time.

Identification sends the normalized JPEG to PlantNet only after an explicit user action. Keep the API key and requests server-side; redact it from logs. Use the `all` project and automatic organ detection for the initial flow, store a bounded list of candidates and scores, and apply species data only after user confirmation. Missing API configuration disables identification while preserving manual entry and all catalogue/care operations. Display no-match, timeout, invalid-image, and quota failures without changing the plant.

Persist an attempt ID/idempotency key to suppress duplicate submissions for the same explicit attempt; do not automatically replay an upstream request after a timeout or uncertain result. A retry is a new user action. Keep PlantNet suggestions limited to species data, not care-note generation. API reference: https://my.plantnet.org/doc/api/identify.

### 7. Workbox caches and read-only offline views

Use `vite-plugin-pwa` with `injectManifest` to author the Workbox service worker. Precache the versioned application shell and locally served install icons/fonts. Use `NetworkFirst` with a short timeout for explicitly allowlisted read endpoints, and `CacheFirst` with storage bounds for immutable normalized photo/thumbnail URLs. Authentication/config bootstrap, login callbacks, mutations, identification requests, and third-party requests are network-only. References: https://vite-pwa-org.netlify.app/guide/inject-manifest and https://developer.chrome.com/docs/workbox/modules/workbox-strategies.

Cache successful application JSON/media responses only, with saved refresh timestamps. In OIDC mode enable data caching only after a successful online identity bootstrap and namespace it by identity and deployment/auth context. An HTTP 401/403 triggers local-data cleanup rather than a cached fallback. Logout, identity changes, and observed auth-mode changes clear collection/media caches and in-memory application state across open tabs. Keep the public application shell separate from collection data.

Offline routes render whichever catalogue, detail, timeline, calendar, and photo data have actually been cached. Unvisited or evicted content shows an explicit unavailable-offline state. Today/calendar display a cached snapshot and its refresh time; they do not imply that an old server calculation is current. Offline editing, activity recording, uploads, identification, and fresh login are disabled with a clear explanation. A failed request leaves edits unsaved and does not queue them. On reconnection the app revalidates identity and refreshes visible data; successful mutations invalidate affected read caches before refresh.

Offline reads intentionally access information previously saved to that browser. Remote session revocation cannot erase an offline device immediately. Local logout always removes cached collection data; if the network is unavailable, mark the local session signed out and require online session termination/revalidation before resuming. Service-worker updates use an update prompt so an active form is not unexpectedly discarded.

### 8. Shared-collection authentication

Configure `AUTH_MODE=no|oidc`. Open mode permits view/edit access without login. OIDC uses backend authorization-code flow, PKCE, state and nonce checks, issuer/audience/signature/expiry validation, and an opaque application session in an HttpOnly, Secure, SameSite cookie. Use `coreos/go-oidc` and `golang.org/x/oauth2` rather than implementing token verification. Tokens/secrets never enter browser storage or caches.

All users successfully authenticated through the configured provider can view/edit the same collection; record issuer/subject and display-name attribution on their activities. Access admission is managed by the external IdP. Protect media and all collection API routes, validate CSRF/origin on writes, and use 401/403 JSON responses for API failures instead of caching redirects to login. Serving the public shell is compatible with protecting collection data. Incorrect OIDC configuration fails startup without falling back to open mode. Client reference: https://github.com/coreos/go-oidc.

## Risks / Trade-offs

- Native HEIC packaging and device-specific images -> Validate real phone fixtures, orientation, and decoder availability in the final container before declaring format support complete.
- SQL dialect differences -> Maintain engine-specific migrations and run behavioral integration tests on both engines, including timestamps, foreign keys, and activity corrections.
- Seasonal boundaries can move due dates -> Show the active season and interval on the plant screen and cover transitions with deterministic clock/timezone tests.
- Browser storage can be evicted -> Promise cached data only, show unavailable states, and bound photo caches separately from the application shell.
- API/media caching can outlive an online session -> Scope caches to identity, purge on observed access failures/logout, and make offline access a deliberate saved-data behavior.
- Files and SQL transactions cannot commit atomically together -> Stage uploads, commit metadata only for successfully written media, and clean failed/orphaned files with deterministic recovery behavior.

## Migration Plan

1. Supply an application container with the compiled frontend, Go executable, and working HEIC decoder. Document the externally configured HTTPS origin needed for phone installation/service workers.
2. Configure a writable media volume and either a SQLite database file or an existing PostgreSQL connection. Run versioned migrations before serving collection traffic.
3. Provide a default SQLite Compose example and a separate example pointing at external PostgreSQL; neither requires operating a second application runtime.
4. Document OIDC callback URLs and optional PlantNet configuration, including keeping secrets in deployment environment/configuration.
5. Verify restart persistence, backup/restore of the database plus media, and the complete online/offline care flow in the built image.
6. Before an incompatible database upgrade, take a consistent database/media backup. Roll back by restoring that backup together with the prior application image rather than claiming arbitrary schema downgrades are safe.

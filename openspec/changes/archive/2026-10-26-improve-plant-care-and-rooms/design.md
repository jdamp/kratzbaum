## Context

See `proposal.md` for motivation and the capability deltas for acceptance behavior. This design is needed because the change spans persistence, schedule evaluation, HTTP responses, React views, and offline caching.

Current implementation findings:

- `internal/care/due.go` takes a mandatory `time.Time` care start and calculates one outstanding date per enabled schedule, preferring the latest matching completion.
- `internal/httpapi/server.go` requires a valid `care_start_date`; its schedule adapter ignores date parse errors. Today only has dated `due` and `next` arrays; Calendar uses the same dated calculation.
- `PlantDialog.tsx` requires and prepopulates the care start input. Plant detail already has separate, backdateable watering and fertilizing actions.
- Plants store a cover photo and expose a normalized thumbnail URL. Today omits that URL. `CachedImage` and `fetchMedia` already provide identity-scoped image reads.
- The storage layer supports SQLite and PostgreSQL, but `Store.Migrate` only reads and records migration 1. The initial schema has no room data and has a non-null text care date.
- `main.tsx` shares a server-search-filtered plant list between catalogue and Today. Today looks up care-action targets in that list, so catalogue search can currently disable unrelated care actions.
- `sw.ts` caches an explicit list of successful collection reads; `api.ts` invalidates retained reads after successful mutations and clears identity-scoped data on access loss.

## Goals / Non-Goals

**Goals:**

- Derive schedule state once and reuse it in Today and Calendar without persisting another state that can drift from activity history.
- Support upgrades of populated databases on both engines while retaining saved dates, activities, media references, and identity/session data.
- Keep current dated API consumers usable and reuse the existing authentication, CSRF, mutation, media, and offline mechanisms.

**Non-Goals:**

- Bulk completion, multiple rooms per plant, nested rooms, room-specific care intervals, or moving historical activities between rooms.
- Room filtering in Calendar, pagination, new image processing, external notifications, or a general frontend rewrite.

## Decisions

### 1. Represent an absent fallback date explicitly

Keep `care_start_date` as a string in persisted plants and JSON. Use the empty string to represent no fallback date, retaining the existing non-null text column. Creation accepts an omitted or empty date and never fills it from `created_at`. Nonempty values must parse as a real `YYYY-MM-DD` date. Editing sends the field explicitly, including an empty string when clearing it; preserve a saved date if an older update client omits the field.

At the care boundary, parse a present date and pass an optional time value into `PlantSchedule`. Do not pass a zero date or ignore a parsing failure. For each care type: determine current enabled interval, choose latest matching activity or fallback start, then classify as dated or not started. A paused or unconfigured seasonal fertilizing schedule produces neither kind of item. Keep the existing calendar-day and season rules unchanged.

Alternative: making the SQL date nullable and returning JSON null would also work, but requires a SQLite table rebuild and changes an established field type without a benefit for this scope. Using the creation date or an artificial due-today value would reproduce the user's problem.

### 2. Keep dated reminders and not-started items separate

Add an evaluated schedule result that exposes dated care and not-started care from the same eligibility/anchor rules. Calendar consumes only dated results. Today retains `due` and `next` and adds `not_started`, always returning arrays even when empty.

All Today items carry `plant_id`, `plant_name`, optional `photo_url`, and `room_id` (null when unassigned). Dated items retain `type`, `due_date`, `days_overdue`, and `days_until`. Not-started items have `type` and `interval_days` without date/overdue fields. Use deterministic plant-name/type ordering for not-started items and retain chronological ordering of dated reminders.

Do not store a started flag or a separate last-care field. Deleting or editing activities, clearing a fallback date, and changing seasonal settings must automatically recalculate state. After a confirmed activity correction or deletion, refresh Today and Calendar as well as plant history. Notes and photos never supply an anchor.

Alternative: a single item type with nullable dates spreads date guards into calendar code and encourages undated items to acquire misleading calendar positions.

### 3. Store rooms as shared entities with optional membership

Add a `rooms` table with UUID-style IDs matching current storage conventions, display name, a unique normalized name key, and creation/update timestamps. Trim display names, require 1-120 Unicode characters, and derive the key with Unicode lowercase in application code so PostgreSQL and SQLite enforce the same uniqueness. This is case-insensitive matching, not locale-specific collation or accent equivalence.

Add nullable `plants.room_id` referencing `rooms(id) ON DELETE SET NULL` and index it. Do not derive membership from free-text room names. A rename updates one room; a deletion unassigns plants without deleting them or altering their history. Foreign keys protect concurrent deletion/assignment; translate these conflicts into useful client errors.

Plant JSON adds `room_id` as an ID or null. On create, omission/null means unassigned. On update, omission preserves current membership and explicit null clears it; use presence-aware decoding rather than conflating those inputs. Keep species-confirmation and photo update paths from dropping room membership or optional-date state.

Alternative: a free-text plant field avoids a table but makes rename, duplicate naming, empty-room management, and deletion inconsistent. A join table adds unnecessary many-room semantics.

### 4. Add room management to the existing application

Add authenticated `GET/POST /api/rooms` and `PUT/DELETE /api/rooms/{id}` endpoints using current middleware, UUID validation, JSON errors, and CSRF handling. Listing returns `{rooms: [...]}` sorted by display name; writes return confirmed room state, and successful deletion returns 204. Reject blank/oversized/duplicate names with 400, malformed IDs with 400, missing room resources with 404, and invalid assignment with an actionable 400.

Add a Manage rooms area in Settings and a link from the optional add/edit room selector. Create/rename retain input on errors; deletion asks for confirmation that plants will become unassigned. Refresh rooms, plants, and Today after confirmed room changes.

Use one shared selected-room state for Plants and Today: All rooms by default, Unassigned, or a room ID. Retain it across tab navigation during the session. Reset to All rooms only after a successful room-list refresh confirms deletion, not after a failed or offline room fetch. Reload persistence is not required.

Load the complete plant list and room list after authentication; keep catalogue text search as a local predicate combined with membership. Preserve the server's existing `q` search API for other clients. Use the complete plant list for action targets and the room-filtered Today arrays for sections/counts; catalogue text search does not filter Today. This also lets cached unfiltered snapshots support every room selection without new server-side filter endpoints or cache variants.

Alternative: independent server requests per room/search would require caching every query combination and would retain the current coupling between catalogue results and care actions.

### 5. Reuse care entry and cover media

Use a shared reminder row for due, upcoming, and not-started content. Load the supplied cover thumbnail through `CachedImage` and keep activity labels/icons visible. Missing or failed images use a stable fallback; rows and controls fit 320 CSS pixels with existing accessible target sizing.

Offer the same individual activity-entry flow from due and not-started rows, defaulting the date/time to now and allowing changes before submission. Reuse the activity endpoint and duplicate-submission protection. Only confirmed saves update the schedule; failures preserve input. Plant detail remains a way to record care early or independently of current reminder state, including fertilizing while its schedule is paused.

Make Care started optional and blank for new plants, with helper text explaining the first actual care record. Keep date/room values through identification and photo-recovery flows and avoid rendering an empty date as a completed-care statement.

### 6. Extend existing offline reads

Add only successful `GET /api/rooms` to the service-worker collection-read allowlist. Keep identity scoping, bounded caching, auth-route exclusions, and mutation invalidation unchanged. Fetch rooms independently enough that unavailable room data does not discard otherwise readable plants or Today data.

Filter successfully cached snapshots locally. Missing room metadata must display an unavailable-offline state rather than treating assigned plants as unassigned; membership is determined by `room_id`, not by whether a room name was loaded. Disable all room mutations and due/not-started recording while disconnected. Cover-image failures remain local to the image. On reconnect or successful mutation, refresh room and collection reads with the existing access checks.

Older cached Today payloads can lack `not_started`; normalize the missing array to empty for rendering without fabricating state. Keep cached snapshot timestamps visible. Do not infer that an older payload proves that no unstarted schedules currently exist; refresh on reconnect.

## Risks / Trade-offs

- Existing care dates may have been accepted from the old default rather than intentionally chosen -> Preserve them because the system cannot distinguish intent; users can clear them in Edit plant. Do not bulk rewrite existing deadlines.
- Migration 1 is currently hardcoded -> Add ordered, ledger-backed forward migration execution before introducing migration 2; test fresh, populated-version-1, repeated-startup, and failed-migration cases on both engines.
- New room reads can be absent offline -> Isolate that unavailable state and preserve other cached reading; never invent membership from missing names.
- Shared collection snapshots cost more than filtered requests -> The app already loads complete Today care and has no pagination; reuse one plant snapshot, leaving scaling changes out of scope.
- Concurrent room deletion can race an edit -> Enforce the foreign key and return a recoverable error, then refresh the selector.
- Existing authenticated data-clear logic covers plant state only -> Clear rooms, room selection, and any new editing state on identity loss/change as well.

## Migration Plan

1. Extend `Store.Migrate` to enumerate dialect-specific numbered scripts in ascending numeric order, apply each unapplied migration in its own transaction, and insert its ledger entry only after successful SQL execution. Preserve migration 1 and fail startup on upgrade failure.
2. Add migration 2 for both engines creating rooms and adding nullable indexed plant membership with `ON DELETE SET NULL`. Existing plants stay unassigned. The text date column needs no schema change; preserve all old values.
3. Verify upgrade fixtures with plants, photos, activities, and sessions; rerunning startup must not duplicate or lose data. Run the shared repository/API contract against SQLite and a dedicated disposable PostgreSQL test database ending in `_test` without printing credentials.
4. Deploy backend and rebuilt embedded frontend together. Existing dated response fields and valid care-date inputs remain supported; refresh cached reads and offer the usual service-worker update.
5. For rollback, restore the pre-upgrade database backup and matching application/media backup. An application-only rollback is not a supported way to retain new room or blank-date data: the old UI may invent a date when editing and the old calculator does not understand absent anchors. Do not add an automatic destructive down migration.

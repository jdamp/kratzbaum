## Context

See proposal.md for motivation. `internal/httpapi/server.go` currently exposes only `POST /api/plants/{id}/photos/identify`; it validates a saved plant, normalizes a multipart image, records an attempt, and calls the existing provider client. `identification_attempts` has no plant foreign key, so draft identification can reuse it without a migration. Saved photos already have normalized JPEG originals accessible through `GetPhoto` and `MediaFile`.

`web/src/main.tsx` has an inline identification control, while `PlantDialog.tsx` owns the creation file and the save-then-upload recovery state. `uploadPhoto(..., true)` currently generates a fresh attempt key internally. Bootstrap already reports `plantnet_available`. Service-worker reads are allowlisted; identification POSTs are outside those caches.

The current mobile spec forbids any photo upload before creation. Its delta makes a narrow exception for an explicit identification request, while keeping selection local and catalogue attachment after plant creation.

## Goals / Non-Goals

**Goals:** Share provider execution and candidate review across draft uploads, existing-plant uploads, and saved gallery photos without coupling identification to catalogue writes. Preserve ordinary photo recovery and the existing saved-plant identification API.

**Non-Goals:** Draft plant records, temporary media persistence, new database tables, multi-image requests, remote image URLs, automatic identification, additional taxonomy enrichment, generated care advice, or durable form recovery across reloads. Identification does not automatically save newly selected files to the gallery.

## Decisions

### Add two source-specific routes and share attempt execution

| Route | Input | Purpose |
| --- | --- | --- |
| `POST /api/identifications` | Multipart `image` | Identify a draft photo without a plant |
| `POST /api/plants/{id}/photos/identify` | Multipart `image` | Preserve existing saved-plant file identification |
| `POST /api/plants/{id}/photos/{photoID}/identify` | No image body | Identify a photo already attached to that plant |

All routes require `Idempotency-Key` and use the normal authentication and CSRF middleware. Upload routes reuse content validation, limits, orientation handling, and JPEG normalization. The saved-photo route validates IDs, plant existence, photo ownership, and readable valid JPEG content; it reads the normalized original rather than the thumbnail and rejects bad sources before contacting Pl@ntNet. Use bounded reads consistent with normalized output sizes; a normalized JPEG can be larger than the original compressed upload. Accept only server-resolved photo IDs, never client file paths or arbitrary URLs.

Factor the durable-attempt and provider-call logic into a shared backend path. Preserve the response contract (`attempt_id`, `status`, `candidates`, optional `error_code` and `error`) and existing failure categories. Send the JPEG with an image/jpeg multipart content type to the configured endpoint, defaulting to `/v2/identify/all`, and retain the top five ranked candidates. Do not call photo storage or plant saving from identification handlers.

A generic endpoint accepting both uploads and saved IDs was considered; separate input routes simplify validation and retain the current API. Creating a placeholder plant would make cancellation create orphan records and defeat the before-save requirement.

### Keep attempts explicit and independent of species saving

Reuse durable `BeginIdentification` and `CompleteIdentification`. Generate one UUID when the user starts an attempt and pass it explicitly from the shared frontend controller to the API helper. Repeated submissions of that attempt reuse its key; another explicit Identify/Retry action creates a new key and clears previous results. Pending duplicates return the existing in-progress response, completed duplicates return recorded results, and neither sends another provider request. Do not add automatic retries, polling, or offline replay. Use an immediate in-flight guard in addition to disabled controls.

Identification source validation precedes provider execution. A disconnect or process failure may leave an attempt pending; that attempt must not be replayed upstream. Explain uncertain outcomes and permit only an explicit new attempt. Ensure provider HTTP-client timeouts as well as context deadlines map to the timeout failure state. Do not expose provider response bodies or credential-bearing URLs in errors or logs.

Candidate saving is a separate mutation with its own busy/error state; retrying a failed species save never invokes identification again. A successful provider response is not a saved species change.

### Share a review component with caller-owned confirmation

Extract a typed candidate/result API and shared identification state/review UI from the inline control. Keep a source generation/token alongside the active attempt; ignore late results when the source, target plant, or mounted flow changes. Starting another attempt, replacing/removing a file, or switching plants clears all unconfirmed results and radio selection. A confirmed species becomes ordinary draft data and is not erased merely by removing its photo.

The shared component presents scientific names, common names when supplied, confidence percentages, and explicit Cancel and Confirm species actions. Confirmation is disabled until a current candidate is selected, and both identification and confirmation have duplicate-submission guards. Use labelled buttons, accessible status/error messages, keyboard-operable radio groups, and the existing dialog focus handling. Avoid a nested form inside PlantDialog and include any new controls in its focus trap.

Pass integration availability and connection state from the app to both flows. Show a clear disabled/unavailable state without a key or offline, while keeping manual entry available online. No request starts merely because a file or gallery source was selected; existing-plant file identification also has an explicit Identify species button.

Separate caller-owned confirmation keeps one review UI while respecting different persistence rules: Add Plant updates local fields, whereas plant detail saves immediately after confirmation. Duplicating review logic would make cancellation and stale-result handling diverge.

### Apply draft candidates without crossing creation phases

Place Identify species beside the creation photo picker, enabled for a selected file when integration and connectivity permit. Confirmation sets draft scientific name and the first returned common name (or blank if none); family remains blank for a new plant because the provider mapping does not return it. Keep Common name and Family inputs absent. If a user subsequently changes the identified scientific name manually, clear its candidate-derived common name to avoid saving mismatched hidden metadata.

Keep name, schedules, notes, and other fields intact across identification renders. Identification is available only in the draft phase; while pending, prevent conflicting plant submission and source changes, and announce progress. Preserve dismissal behavior during pending work; any response arriving after dismissal cannot apply data or trigger a save.

After identification settles, Add plant still performs the existing sequence: create once, then upload the selected file through the ordinary photo endpoint. Confirming a candidate does not submit the form. Plant-create rejection retains draft species and file; photo failure after confirmed creation retains the saved ID and offers Retry photo or Continue without photo. That recovery state does not offer draft identification because the plant is already saved. There is no saved draft/media token: the local file is submitted once for explicit identification and again later for catalogue attachment.

### Reuse gallery sources and preserve existing metadata

Add an Identify species action to each gallery photo and retain the new-file option on plant detail. Both open the shared review scoped to that plant and source. A saved source is sent as a photo ID through the new route, avoiding a browser download/reupload and duplicate photo activities.

On existing-plant confirmation, retain the current API behavior: set scientific name, use the first candidate common name when provided (otherwise preserve the saved common name), and preserve family and unrelated fields. Fetch the latest plant before constructing its existing PUT payload so a long-open review does not send an old snapshot. This retains the repository's current update semantics; atomic conflict detection across simultaneous editors is outside this change. Disable duplicate confirmation, retain results if saving fails, and refresh affected views after a confirmed save. Do not add Common name or Family inputs to the manual edit dialog.

## Risks / Trade-offs

- Identification before saving sends the source file twice if the user later attaches it. -> Reuse the local File and existing upload flow; temporary server uploads would introduce cleanup and retention complexity.
- A late result or stale chosen candidate could affect a different source or plant. -> Scope state to plant/source generations, clear selection on transitions, and test delayed responses and reopen flows.
- A normalized stored JPEG can exceed the compressed source upload size. -> Bound stored-image reads using normalized output dimensions/encoding constraints rather than blindly applying the original file-byte limit.
- Identification can succeed while saving species or uploading the catalogue photo fails. -> Keep these operations and recovery states distinct; never repeat identification as a save/upload retry side effect.
- A lost identification response leaves uncertainty about quota consumption. -> Preserve one-shot keys and require a deliberate new attempt; never automatically replay uncertain attempts.
- The current PUT API has no atomic edit conflict detection. -> Refresh before confirmation and preserve unrelated fields; broader concurrent editing changes are outside this scope.

## Migration Plan

No schema migration or new configuration is needed. Keep `PLANTNET_API_KEY` optional and server-side, preserve `PLANTNET_API_URL`, and keep the existing route and response shape compatible. Update README with the new flows and explicit upload behavior. Build the frontend into the embedded production assets. Existing service-worker GET allowlists require no expansion for the POST routes; verify that identification responses are never cached.

Rollback restores the prior backend/frontend together. Plants and photographs saved through the new flows remain ordinary compatible records; completed attempts retain the existing schema.

## Verification

Use a local fake provider for request counts, image MIME/bytes, candidate ranking, duplicate/concurrent attempts, timeout/no-match/quota cases, and credential redaction. Add backend tests for draft identification without catalogue writes and saved-photo ownership/missing/corrupt source handling. Exercise supported normalization paths without spending live API quota.

Extend browser tests for identification before any plant creation, draft confirmation/cancel, form preservation, subsequent manual species edits, stale responses, gallery-source identification without another photo activity, existing species confirmation/save retry, unavailable/offline states, keyboard interaction, and 320px layouts. Retain creation without identification and the existing upload-recovery regressions. Run backend tests, frontend unit/type/build checks, and the production browser-test target; use `/builder/bin/buildctl` for container builds.

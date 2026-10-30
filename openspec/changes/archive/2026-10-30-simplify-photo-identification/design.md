## Context

See proposal.md for motivation. `PlantPhotos.tsx` currently owns a file-or-photo source and a shared `Identification` component. Its gallery action only sets the source and moves focus; the shared component supplies a second start button. The shared component also owns pending guards, candidate selection, generation checks, and species-save progress, and is used during Add Plant.

The Go client adds `project=all` even though the default URL already ends in `/v2/identify/all`. A live diagnostic from the user's k3s pod returned HTTP 400 with `"project" is not allowed`; repeating without that parameter worked. A separate quota check returned HTTP 200 and 500 remaining identifications. These findings establish a request-construction defect rather than a missing key or basic pod connectivity issue.

The client currently maps most non-2xx responses to service unavailability and drops the HTTP status. The HTTP handler stores terminal attempt codes but logs no provider failure. Replayed attempts use a separate message mapper, which must stay consistent with fresh results.

## Goals / Non-Goals

**Goals:** Preserve the shared review state machine while allowing explicit gallery actions to supply the source and start an attempt atomically. Keep provider diagnostics useful in ordinary pod logs and safe even when transport errors or response bodies contain secrets.

**Non-Goals:** Change authentication, deploy to k3s, alter storage schemas, remove backend routes, identify on upload, change Add Plant interaction, generate care advice, or add automatic retries. No live API calls are required for automated validation.

## Decisions

### 1. Start requests from explicit UI events

Extract the shared identification controller into a hook with an explicit start(source) action and shared review rendering. Add Plant retains its current Identify species button, while gallery buttons call start with the saved photo ID. Remove the existing-plant identification-only picker and standalone start button. Keep the review area conditional on an attempt or relevant unavailable feedback, visibly identify its selected source, and focus/scroll to progress or review after activation. Keep disabled reasons visible even when there are no photos.

Preserve synchronous pending guards, per-attempt generation checks, source/plant invalidation, busy propagation, duplicate prevention, and separate save retries. Starting the same image again after an idle failure or cancellation must create a fresh attempt; it must not depend on a change in source identity. Clear obsolete results before starting. Gallery render, mount, upload, and connectivity changes never invoke start. This event-driven controller is preferable to triggering requests from source-changing effects, which can miss same-image retries or repeat requests during remounts.

Keep all gallery identification and conflicting photo actions disabled while identifying or saving. Preserve Add photo and ordinary photo management independently of integration availability. Do not remove the existing-file backend route: the main identification capability still permits file-based API identification, while the mobile frontend delta explicitly removes its detail-page entry point.

### 2. Put the project only in the endpoint path

Delete the injected project query parameter, and remove any legacy project query parameter from a configured endpoint before sending. Retain supported custom parameters, API-key injection, multipart JPEG construction, redirect restrictions, timeout limits, and idempotency behavior. Removing the parameter addresses the confirmed provider rejection; adding organs or changing image processing is unnecessary. Add a strict fake provider that rejects any project query parameter so tests reflect the real API contract.

### 3. Classify upstream failures and keep fresh/replayed messages consistent

Extend the typed failure with safe diagnostic metadata, including upstream status and a bounded transport category. Map 404 to `plantnet_no_match`, 401/403 to a new `plantnet_auth`, 400/422 to `plantnet_request_rejected`, 429 to `plantnet_quota`, and timeouts to `plantnet_timeout`. Retain `plantnet_unavailable` for other upstream/service failures and `plantnet_invalid_response` for malformed successful responses. Empty successful candidate lists remain no-match.

Persist the existing error-code field, adding mappings for new codes without a migration. Use a common public-message mapping for fresh and replayed attempts; preserve mappings for existing stored codes. Never send provider bodies or raw network error text to the frontend. This provides actionable failure categories without exposing provider internals or credential-bearing URLs.

### 4. Log one sanitized failure event per upstream attempt

At the HTTP attempt boundary, log the attempt ID, failure code, upstream status when present, and a safe transport category. The client classifies wrapped DNS, TLS, connection, and timeout errors without serializing raw errors. Unknown errors use a bounded fallback. Logging occurs after an upstream attempt, not on replay of a stored result. Use normal structured application logging visible in pod logs; no debug flag is required. No-match can be informational; operational failures are warnings.

Exclude API keys, full URLs or queries, idempotency headers, image bytes, and upstream response bodies entirely rather than attempting to redact arbitrary strings. Keep diagnostic metadata server-side. Tests deliberately place the test key in provider bodies and transport URLs and verify it appears in neither logs nor responses.

## Risks / Trade-offs

- Shared-controller refactoring could regress creation or permit duplicate gallery attempts -> retain creation tests and cover rapid repeated activation, same-image retries, source switching, navigation, and late responses.
- Removing the detail file picker requires saving a gallery image before identifying a new image on an existing plant -> retain Add photo and document that workflow; Add Plant continues identifying before save.
- A custom endpoint may return 404 for a missing route -> logs retain HTTP status, and documentation identifies the expected endpoint path; the default provider's documented 404 is classified as no-match.
- Transport errors can embed the secret-bearing URL -> log only typed, allowlisted categories and verify redaction with failing fake transports.
- A 401/403 previously persisted as quota cannot be reconstructed -> retain its historical code meaning; new attempts distinguish account rejection correctly.

## Migration Plan

No schema or credential migration. Run local fake-provider and browser regression checks, then build and release through the existing workflow when separately authorized. Deploy frontend and backend together. Rollback uses the preceding application image, with existing attempt records remaining readable; rollback also restores the known provider request defect. Operational verification after deployment can use an explicit gallery request and sanitized pod logs, but deployment and live verification are outside this planning change.

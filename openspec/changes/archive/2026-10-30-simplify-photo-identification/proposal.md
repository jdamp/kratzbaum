## Why

Existing plant detail offers redundant identification controls and requires two clicks to identify a gallery photo. Identification also fails with a valid API key because the client sends an unsupported `project` query parameter; the resulting generic error and silent pod logs hide the cause.

## What Changes

- Remove Choose identification photo and the standalone Identify species button from existing plant detail. Identify this photo on each saved gallery image starts a request immediately.
- Retain ranked candidate review, explicit species confirmation, cancellation, explicit retries, and Add Plant identification.
- Remove the unsupported `project` query parameter; select the project through the endpoint path.
- Classify upstream no-match, authentication, quota, request rejection, and service failures accurately and log safe diagnostic details for failed provider attempts.
- Update documentation and regression coverage for the streamlined flow and provider request contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-frontend`: Make gallery-photo actions the identification entry point on existing plant detail, preserving accessible review and creation behavior.
- `plant-identification`: Define accepted provider request construction, distinguish failure categories, and provide credential-safe operational diagnostics.

## Impact

Affects `web/src/PlantPhotos.tsx`, shared `Identification.tsx`, the Go identification client and HTTP failure mapping, identification tests, browser flows, and README instructions. Existing API routes, including existing-plant identification from a file, remain compatible; only its frontend entry point is removed. No database migration, new dependency, deployment change, automatic retry, or live provider call is required for implementation tests.

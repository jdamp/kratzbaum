## Why

CI run 14 fails because the plant-room browser test still locates Choose identification photo after that control was intentionally removed. This prevents the verified identification fix from reaching the image-publishing job.

## What Changes

- Update the existing room-assignment test to locate Identify this photo on the saved gallery image.
- Preserve enabled, pending-disabled, and restored-enabled assertions around the room save.
- Run the full browser suite used by CI, then push the test correction and verify the resulting workflow and image publication.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This corrects test selectors to match existing specified behavior; specs are deliberately skipped.

## Impact

Only browser test assertions and this maintenance change record. No product, API, deployment, or workflow behavior changes.

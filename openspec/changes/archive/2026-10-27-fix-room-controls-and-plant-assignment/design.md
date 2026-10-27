## Context

See proposal.md for motivation. `RoomManager` already has a pending ref, busy state, and immediate confirmed-result callbacks. Browser inspection reproduces `cursor: wait` on an idle disabled Add room button because `.primary:disabled` outranks the general disabled-button rule. The user confirmed the same symptom: the greyed-out button shows a loading wheel on hover. `PlantDialog` already supports assigning and moving existing plants; the room information on plant detail is read-only. Existing browser tests cover movement through the full editor and stalled collection reads, but do not check computed cursor states.

The shared API request helper also awaits CacheStorage invalidation after successful HTTP writes. Browser verification must exercise a service-worker-enabled context, in addition to the existing service-worker-blocked room regression, so a write-completion problem is not mistaken for the idle cursor problem.

## Goals / Non-Goals

**Goals:** Make idle versus pending feedback accurate and make existing-plant room assignment visible beside its current room. Preserve confirmed state and all other plant data across saves and failures.

**Non-Goals:** Bulk room operations, a room-membership dashboard, database migrations, and changing care scheduling behavior.

## Decisions

1. Remove the waiting cursor from the generic disabled-primary rule. Use an explicit pending state for wait feedback on room mutation controls; empty names, offline state, and unavailable room data are idle disabled states. Keep room-creation validation, pending locks, and immediate confirmed callbacks. Shorten both create and rename success text to `Room “<confirmed name>” saved.`. Merely changing the message would leave the reproduced CSS defect intact.
2. Add a small room-assignment form on plant detail near the existing room label. It has a labelled selector, Unassigned, and Save room action; disable unchanged, pending, offline, and unavailable submissions. Retain the full editor's selector for existing workflows. Requiring users to discover the full editor does not address the reported usability problem.
3. Reuse GET and PUT `/api/plants/<id>`. On explicit save, fetch the latest plant and construct the existing editable-field payload, replacing only `room_id`; do not send a room-only body, because the existing PUT requires a name and watering interval. Preserve species metadata, notes, care start, intervals, and pause flags explicitly. This avoids a new endpoint and reduces stale overwrites. Concurrent writes during the GET/PUT gap retain the application's existing last-writer behavior; this change does not introduce general versioning.
4. Apply the confirmed assignment immediately to current plant detail, collection plants, and Today items by plant ID; invalidate older collection reads and guard results against navigation and identity changes. Do not wait for a full collection refresh to end saving. Keep selected input on rejected writes, show an accessible error, and allow explicit retry. A read failure before PUT must not produce a write. Serialize this save with conflicting plant editing/identification controls and prevent duplicate submissions.

## Risks / Trade-offs

- Disabled and pending feedback could regress independently → Verify the confirmed hover symptom with computed cursor assertions and retain coverage for pending states, consecutive creation, rejected writes, stale reads, and normal service-worker operation.
- Full plant PUT can accidentally clear unrelated fields → Build from the latest fetched plant and verify saved metadata, schedules, photographs, and history in the assignment regression.
- Delayed callbacks can overwrite another detail page or a newer room selection → Guard identity and plant identity, ignore obsolete reads, and test delayed responses with navigation.
- A room can disappear while a selection is being saved → Keep the server's room validation and recoverable error; handle the existing room-deletion flow without assigning an invalid room locally.

## Migration Plan

No data migration. Rebuild frontend assets embedded in the Go application and deploy together. Rollback restores the previous UI with existing room data unchanged.

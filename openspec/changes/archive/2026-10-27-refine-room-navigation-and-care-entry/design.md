## Context

`RoomManager.mutate` currently awaits the parent's full `refresh`, which fetches bootstrap, plants, Today, and rooms before resolving. Thus a confirmed room creation can remain busy behind an unrelated read. Room management lives in Settings and is also reused inline in `PlantDialog`. Navigation is a three-item desktop sidebar/mobile bottom bar; initial route selection does not recognize `/rooms`.

Reminder photo containers are spans. Plant detail already has an `openPlant` action. New-note entry captures a date when mounted; the activity endpoint already supplies `time.Now()` when `occurred_at` is absent.

## Goals / Non-Goals

**Goals:** Keep room mutation progress tied to confirmed writes, reuse existing room controls and APIs, and preserve offline/identity protections and plant drafts.

**Non-Goals:** New room data models, server migrations, bulk care actions, changing water/fertilizer date entry, or removing correction of saved note timestamps.

## Decisions

- Add `rooms` to navigation and initial-route selection, after Calendar. Render the existing room manager in a dedicated page, retaining the inline manager and keeping Settings focused on collection/account information. Fit four phone targets by removing the old three-item horizontal gaps on phones.
- Replace the room manager's awaited whole-collection refresh callback with a synchronous confirmed-change callback carrying either the saved room or deleted room ID. Apply it to shared rooms immediately. On deletion, also unassign matching plants and care items locally and reset a deleted active filter. Existing successful-write cache invalidation remains in use. Invalidate older in-flight collection refresh results so stale reads cannot overwrite a confirmed room change. This avoids tying room completion to another network request; merely adding a spinner timeout would hide the coupling.
- Keep failed room writes in the form, release its in-flight lock in `finally`, and announce confirmed success. Add room remains disabled for an empty name after saving, and enables when another valid name is entered. Do not automatically retry mutations.
- Render reminder thumbnails/fallbacks as native plant-detail anchors with meaningful accessible labels. Intercept ordinary clicks for existing in-app navigation when a plant is available, preserving modified-click/new-tab behavior via the real URL.
- Remove new-note date state and controls. Submit note text without `occurred_at` so the existing server default supplies the actual save time, even after a long-open page or an explicit retry. Continue using existing activity editing for corrections.

## Risks / Trade-offs

- A refresh begun before a room mutation could restore old names or memberships -> Discard its state updates after a confirmed room change and update only the affected room/membership fields locally.
- Four navigation items can overflow 320 pixels with the existing gaps -> Use evenly sized mobile controls and verify both phone and desktop layouts.
- The same room UI is used inside a plant dialog -> Keep draft inputs mounted and update only the callback contract; exercise inline creation alongside the new page.
- Saved-note timestamp editing could be removed accidentally -> Limit the simplification to new-note entry and retain activity editing regression coverage.

## Migration Plan

Rebuild the embedded frontend and deploy with the current server APIs. There are no persistence changes. The previous frontend remains compatible with the server.

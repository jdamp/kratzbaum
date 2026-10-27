## Why

Room management is buried in Settings, and a confirmed room save remains busy while unrelated collection reads refresh. Upcoming photos should lead directly to the plant, and writing a new note should not require a timestamp field.

## What Changes

- Add a dedicated Rooms destination after Calendar in desktop and mobile navigation, with direct `/rooms` access; remove room management from Settings while retaining inline management in the plant form.
- Finish room save progress as soon as the mutation is confirmed, apply confirmed room changes immediately, and update dependent views without blocking the form or repeating the mutation.
- Make reminder preview images accessible links to their plant details, including upcoming care and missing-photo fallbacks.
- Remove Written at from new plant notes and use the server's current time at submission. Keep correction of existing activity timestamps available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-frontend`: Four navigation destinations, a dedicated Rooms page, clickable reminder previews, and date-free new-note entry.
- `plant-rooms`: Confirmed room saves settle independently of unrelated collection reads and permit another room to be added.
- `plant-catalogue`: New notes use current time automatically while existing note correction remains available.

## Impact

- Frontend: application navigation, room mutation/refresh lifecycle, reminder rows, new-note entry, and responsive styles.
- Reuse current room endpoints and the activity endpoint's existing server-time default; no database migration or dependency changes.
- Browser regressions will cover slow/failed post-save reads, consecutive room creation, direct navigation, preview links, note timestamps, and 320-pixel layouts. Rebuild embedded frontend assets and update README usage.

## 1. Rooms workflow

- [x] 1.1 Decouple room mutation completion from full collection refresh, apply confirmed room/membership changes directly, announce success, and guard against older in-flight reads; verify consecutive creation, duplicate-submit prevention, slow/failed unrelated reads, failed writes, delete/unassign, and inline draft preservation in browser regressions.
- [x] 1.2 Add the dedicated `/rooms` destination after Calendar on desktop and mobile, remove room management from Settings, and adjust four-item phone navigation; verify direct visits/reloads, selected navigation, offline availability, and layout/touch targets at 320 and desktop widths.

## 2. Plant detail access and note entry

- [x] 2.1 Make reminder thumbnails and fallbacks labelled native plant links with normal in-app and modified-click behavior; verify clicking and keyboard activation open the correct detail without recording care, including upcoming reminders and unavailable photos.
- [x] 2.2 Remove new-note timestamp state/input and omit its timestamp in the activity request to use the current server time; verify a delayed submission, failed-save text retention/retry, duplicate prevention, and retained editing of saved note timestamps.

## 3. Integration and documentation

- [x] 3.1 Update affected room browser flows and run frontend unit tests, type checking, the production build, and the full browser suite against rebuilt embedded assets; verify new regressions and existing care, photo, identification, authentication, and offline flows pass.
- [x] 3.2 Update README for the Rooms destination, linked previews, and automatic new-note time, validate the change with `openspec validate refine-room-navigation-and-care-entry --strict`, and verify the final diff contains only the scoped follow-up changes.

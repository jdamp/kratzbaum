## MODIFIED Requirements

### Requirement: Offline reading of cached data
After successful caching, users SHALL be able to launch the application shell offline and read saved catalogue, room, plant-detail, activity, calendar, and photo data. Plants and Today SHALL support room filtering against successfully cached room and collection data, including cached not-started schedules. Views SHALL display an offline indicator and the data's refresh time. Uncached or evicted content SHALL show an explicit unavailable-offline state rather than fabricated or empty-as-current data.

#### Scenario: Read a cached plant offline
- **WHEN** a plant's details and photos have been cached and connectivity is lost
- **THEN** the plant remains readable with its saved content and a refresh timestamp

#### Scenario: Open an uncached plant
- **WHEN** a user opens a plant detail route that has no cached data while offline
- **THEN** the application shell remains usable and explains that this content is unavailable offline

#### Scenario: Filter cached room care offline
- **WHEN** room, plant, and Today data were cached successfully and the user selects a room while offline
- **THEN** the saved matching plants and care items are readable with offline feedback and no recording action can be submitted

#### Scenario: Room data was not cached
- **WHEN** plant data is cached but the room list is unavailable offline
- **THEN** the application explains that room information is unavailable instead of treating assigned plants as unassigned or reporting an empty current room list

### Requirement: Offline operations are read-only
The system SHALL disable plant edits, care recording, note/photo changes, identification, room creation/renaming/deletion, room reassignment, and fresh login while offline. A disconnected or failed mutation SHALL NOT be queued, treated as completed, or silently replayed later.

#### Scenario: Connectivity disappears during a save
- **WHEN** a mutation fails because connectivity is lost
- **THEN** the user is told the change was not confirmed, input remains recoverable, and the client does not enqueue an automatic retry

#### Scenario: Room management while offline
- **WHEN** the app is offline and room data is readable from cache
- **THEN** room browsing remains available and room mutation controls are disabled with an explanation

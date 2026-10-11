## Purpose

Make kratzbaum installable and preserve read access to successfully cached collection data while clearly communicating offline limitations.

## ADDED Requirements

### Requirement: Installable application
The system SHALL provide a kratzbaum web app manifest, application icons, standalone display configuration, and an offline-capable application shell. It SHALL support installation on compatible phone and desktop browsers when served from an appropriate secure origin and provide installation guidance where automatic prompts are unavailable.

#### Scenario: Launch the installed app
- **WHEN** a user installs kratzbaum in a compatible browser and launches it
- **THEN** it opens with the configured name/icons and standalone presentation

### Requirement: Offline reading of cached data
After successful caching, users SHALL be able to launch the application shell offline and read saved catalogue, plant-detail, activity, calendar, and photo data. Views SHALL display an offline indicator and the data's refresh time. Uncached or evicted content SHALL show an explicit unavailable-offline state rather than fabricated or empty-as-current data.

#### Scenario: Read a cached plant offline
- **WHEN** a plant's details and photos have been cached and connectivity is lost
- **THEN** the plant remains readable with its saved content and a refresh timestamp

#### Scenario: Open an uncached plant
- **WHEN** a user opens a plant detail route that has no cached data while offline
- **THEN** the application shell remains usable and explains that this content is unavailable offline

### Requirement: Offline operations are read-only
The system SHALL disable plant edits, care recording, note/photo changes, identification, and fresh login while offline. A disconnected or failed mutation SHALL NOT be queued, treated as completed, or silently replayed later.

#### Scenario: Connectivity disappears during a save
- **WHEN** a mutation fails because connectivity is lost
- **THEN** the user is told the change was not confirmed, input remains recoverable, and the client does not enqueue an automatic retry

### Requirement: Cache only authorized successful reads
The system SHALL cache only allowlisted successful collection/media reads and the public application shell. Authentication callbacks, tokens, secrets, mutations, identification requests, and third-party responses SHALL NOT be cached. Authenticated collection caches SHALL be scoped to the last successfully verified identity/context. An observed 401/403, logout, identity change, or auth-mode change SHALL remove locally retained collection data across open application tabs.

#### Scenario: Session access is rejected
- **WHEN** an online collection request receives HTTP 401 or 403
- **THEN** the client clears retained collection data and presents the access failure instead of serving a cached fallback for that response

#### Scenario: Logout clears offline data
- **WHEN** a user logs out, including a local logout performed offline
- **THEN** collection/media caches and visible collection state are removed, and online session termination or revalidation is required before access resumes

### Requirement: Refresh and update lifecycle
After connectivity returns, the system SHALL revalidate access and refresh visible reads. Successful mutations SHALL invalidate affected retained reads so deleted or edited entries do not persist as current data. Application updates SHALL be offered without unexpectedly discarding an active form, and media caches SHALL have bounded storage.

#### Scenario: Reconnect after an offline read
- **WHEN** connectivity returns to a view displaying a cached snapshot
- **THEN** access is revalidated and the view is refreshed with current server data or the appropriate access/error state

#### Scenario: App update during editing
- **WHEN** a new application version is available while a user has unsaved input
- **THEN** the user is offered an update without an automatic reload that discards the input

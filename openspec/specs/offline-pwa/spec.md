# Offline PWA Specification

## Purpose

Make kratzbaum installable and preserve read access to successfully cached collection data while clearly communicating offline limitations.

## Requirements

### Requirement: Installable application
The system SHALL provide a kratzbaum web app manifest, application icons, standalone display configuration, and an offline-capable application shell. It SHALL support installation on compatible phone and desktop browsers when served from an appropriate secure origin and provide installation guidance where automatic prompts are unavailable.

#### Scenario: Launch the installed app
- **WHEN** a user installs kratzbaum in a compatible browser and launches it
- **THEN** it opens with the configured name/icons and standalone presentation

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

### Requirement: Cache only authorized successful reads
The system SHALL cache only allowlisted successful collection/media reads and the public application shell. Authentication callbacks, tokens, secrets, mutations, identification requests, and third-party responses SHALL NOT be cached. Navigations to every `/auth/` route, including login and callback URLs with query parameters, SHALL bypass the application-shell fallback and reach the server while online. Authentication responses and redirects SHALL NOT be stored in service-worker caches. Offline authentication navigations SHALL fail through the network rather than return the cached application shell. Authenticated collection caches SHALL be scoped to the last successfully verified identity/context. An observed 401/403, logout, identity change, or auth-mode change SHALL remove locally retained collection data across open application tabs.

#### Scenario: Session access is rejected
- **WHEN** an online collection request receives HTTP 401 or 403
- **THEN** the client clears retained collection data and presents the access failure instead of serving a cached fallback for that response

#### Scenario: Logout clears offline data
- **WHEN** a user logs out, including a local logout performed offline
- **THEN** collection/media caches and visible collection state are removed, and online session termination or revalidation is required before access resumes

#### Scenario: Login under service-worker control
- **WHEN** an online signed-out user clicks the login link while the application is controlled by its service worker
- **THEN** the login request reaches the server, its state cookie is set, and the browser follows the server's identity-provider redirect

#### Scenario: Callback under service-worker control
- **WHEN** a browser controlled by the service worker navigates to `/auth/callback` with authorization-code and state query parameters
- **THEN** the server receives the callback and its response is delivered without substituting the cached application shell
- **AND** neither the callback URL nor its response is retained in service-worker caches

#### Scenario: Authentication while offline
- **WHEN** a browser controlled by the service worker navigates to an `/auth/` route while offline
- **THEN** authentication fails through the unavailable network and the worker does not serve the cached application shell for that route

### Requirement: Refresh and update lifecycle
After connectivity returns, the system SHALL revalidate access and refresh visible reads. Successful mutations SHALL invalidate affected retained reads so deleted or edited entries do not persist as current data. Application updates SHALL be offered without unexpectedly discarding an active form, and media caches SHALL have bounded storage.

#### Scenario: Reconnect after an offline read
- **WHEN** connectivity returns to a view displaying a cached snapshot
- **THEN** access is revalidated and the view is refreshed with current server data or the appropriate access/error state

#### Scenario: App update during editing
- **WHEN** a new application version is available while a user has unsaved input
- **THEN** the user is offered an update without an automatic reload that discards the input

#### Scenario: Existing client activates corrected authentication routing
- **WHEN** an existing client controlled by the previous worker accepts the offered update containing the authentication-routing correction
- **THEN** the corrected worker activates and subsequent authentication navigations reach the server

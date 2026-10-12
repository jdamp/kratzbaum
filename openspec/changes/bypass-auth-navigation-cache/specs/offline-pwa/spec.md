## MODIFIED Requirements

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

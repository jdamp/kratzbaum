## ADDED Requirements

### Requirement: Dedicated login page
Signed-out OIDC visitors SHALL see a standalone branded `/login` page with a clear identity-provider sign-in action instead of collection navigation, empty collection content, or editing controls. Collection requests SHALL wait until authentication is confirmed. The page SHALL work at 320 CSS pixels and support keyboard operation and touch targets of at least 44 CSS pixels. Sign-in SHALL use the existing server authentication route.

#### Scenario: Signed-out collection visit
- **WHEN** a signed-out OIDC visitor opens a collection destination or plant detail
- **THEN** the application replaces the URL with `/login`, displays the login page, and does not request protected collection data

#### Scenario: Start provider sign-in
- **WHEN** an online visitor activates the login action
- **THEN** the browser navigates to the server login route and follows the provider redirect

#### Scenario: Login is unnecessary
- **WHEN** an authenticated visitor or an open-access deployment visitor opens `/login`
- **THEN** the application replaces the URL with `/` and displays the collection

#### Scenario: Session expires
- **WHEN** the application learns that collection access has been denied
- **THEN** it closes collection editing, clears visible collection content, and displays `/login`

#### Scenario: Offline and unavailable bootstrap
- **WHEN** the visitor is signed out offline or bootstrap cannot be loaded
- **THEN** the page provides accessible connection or error feedback, offers retry for a failed bootstrap, and does not offer an active offline sign-in action

#### Scenario: Authenticated offline collection
- **WHEN** a previously authenticated visitor opens cached collection content offline
- **THEN** the existing offline collection experience remains available

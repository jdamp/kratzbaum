# Authentication Specification

## Purpose

Control access to the deployment's shared plant collection through open access or an external OIDC identity provider.

## Requirements

### Requirement: Configurable authentication modes
The deployment SHALL support `no` and `oidc` authentication modes. Open mode SHALL permit viewing and editing the shared collection without login. Invalid authentication modes or incomplete OIDC configuration SHALL fail startup rather than silently enabling open access.

#### Scenario: Open deployment
- **WHEN** authentication mode is `no`
- **THEN** collection views and editing operations are available without a login flow

#### Scenario: Invalid OIDC configuration
- **WHEN** authentication mode is `oidc` but required provider/client configuration is missing or invalid
- **THEN** startup reports the configuration failure and does not serve the collection in open mode

### Requirement: External OIDC login
In OIDC mode, the system SHALL authenticate through the configured external provider using a verified authorization-code flow and an application session. It SHALL reject invalid callback state, nonce, issuer, audience, signature, or expired identity tokens. Provider credentials and tokens SHALL remain outside browser-readable storage.

#### Scenario: Valid login
- **WHEN** a user completes a valid login through the configured provider
- **THEN** an application session grants access to the shared collection

#### Scenario: Invalid callback
- **WHEN** the callback fails state/nonce or identity-token verification
- **THEN** no authenticated application session is created

### Requirement: Shared access and activity attribution
All users admitted through the configured OIDC provider SHALL view and edit the same collection. Activities created while authenticated SHALL retain the actor's issuer/subject identity and available display name without creating a private plant collection.

#### Scenario: Two users share a plant
- **WHEN** one authenticated user adds a plant or care activity and a second authenticated user reads the collection
- **THEN** both see the same data and the activity retains its author's attribution

### Requirement: Protect collection and media operations
OIDC mode SHALL require a valid session for online collection API and media reads/writes. Unauthenticated API access SHALL return an access failure without collection data. The system SHALL reject cross-site forged writes and invalidate the application session on online logout.

#### Scenario: Anonymous media access
- **WHEN** an unauthenticated request accesses a plant photo in OIDC mode
- **THEN** the photograph is not returned

#### Scenario: Cross-site write attempt
- **WHEN** a request attempts to mutate the collection without required same-origin/anti-forgery validation
- **THEN** the mutation is rejected without changing data

#### Scenario: Reuse a logged-out session
- **WHEN** a user logs out online and subsequently reuses the former application session
- **THEN** collection access requires a new valid login

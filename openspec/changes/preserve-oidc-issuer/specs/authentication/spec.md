## MODIFIED Requirements

### Requirement: Configurable authentication modes
The deployment SHALL support `no` and `oidc` authentication modes. Open mode SHALL permit viewing and editing the shared collection without login. Invalid authentication modes or incomplete OIDC configuration SHALL fail startup rather than silently enabling open access. The system SHALL preserve the configured OIDC issuer identifier exactly, including its path and trailing slashes, for discovery, identity-token verification, and authenticated identity attribution.

#### Scenario: Open deployment
- **WHEN** authentication mode is `no`
- **THEN** collection views and editing operations are available without a login flow

#### Scenario: Invalid OIDC configuration
- **WHEN** authentication mode is `oidc` but required provider/client configuration is missing or invalid
- **THEN** startup reports the configuration failure and does not serve the collection in open mode

#### Scenario: Preserve configured issuer identifier
- **WHEN** a valid OIDC issuer is configured with or without a trailing slash
- **THEN** the configured identifier is used without adding or removing slashes or otherwise normalizing the identifier

#### Scenario: Discovery issuer mismatch
- **WHEN** the discovery document advertises an issuer different from the configured identifier, including a difference consisting only of a trailing slash
- **THEN** OIDC initialization fails and startup does not serve the collection in open mode

### Requirement: External OIDC login
In OIDC mode, the system SHALL authenticate through the configured external provider using a verified authorization-code flow and an application session. It SHALL reject invalid callback state, nonce, issuer, audience, signature, or expired identity tokens. Identity-token issuer verification SHALL require an exact match to the configured issuer identifier, including trailing slashes. Provider credentials and tokens SHALL remain outside browser-readable storage.

#### Scenario: Valid login
- **WHEN** a user completes a valid login through the configured provider
- **THEN** an application session grants access to the shared collection

#### Scenario: Invalid callback
- **WHEN** the callback fails state/nonce or identity-token verification
- **THEN** no authenticated application session is created

#### Scenario: Provider issuer with a trailing slash
- **WHEN** the configured issuer is `https://auth.example.com/application/o/kratzbaum/`, discovery advertises that exact issuer, and the user completes a valid login with a signed identity token containing that exact issuer
- **THEN** discovery and login succeed and the session retains the exact issuer for identity attribution

#### Scenario: Token issuer differs only by trailing slash
- **WHEN** discovery matches the configured issuer but the identity-token issuer differs only by the presence or absence of a trailing slash
- **THEN** the callback is rejected and no authenticated application session is created

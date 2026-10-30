## MODIFIED Requirements

### Requirement: Optional integration and failure states
The system SHALL allow manual species entry and all catalogue/care operations when no PlantNet key is configured. It SHALL distinguish unavailable configuration, no match, invalid input, rejected provider requests, rejected credentials, upstream timeout, connectivity failure, service failure, and quota failure, preserving the plant and offering only explicit user retries.

#### Scenario: Missing configuration
- **WHEN** the deployment has no PlantNet key
- **THEN** identification is shown as unavailable and users can still save plants with manually entered or absent species information

#### Scenario: Upstream failure
- **WHEN** PlantNet times out or reports quota exhaustion
- **THEN** the user receives the applicable failure state without species changes or automatic replay of the request

#### Scenario: Provider returns no match
- **WHEN** PlantNet returns its documented HTTP 404 no-match response or a successful response without usable candidates
- **THEN** the attempt reports no match rather than service unavailability and preserves saved species

#### Scenario: Provider rejects credentials
- **WHEN** PlantNet returns HTTP 401 or 403
- **THEN** the user receives an account or credential rejection message distinct from quota exhaustion

#### Scenario: Provider rejects request parameters
- **WHEN** PlantNet returns HTTP 400 or 422
- **THEN** the attempt reports provider request rejection rather than service unavailability without exposing raw provider response content

## ADDED Requirements

### Requirement: Provider-compatible identification requests
The system SHALL select the identification project through the configured endpoint path and SHALL NOT add a project query parameter. It SHALL send the API key as the provider-required query credential and normalized JPEG bytes as a multipart images file. It SHALL preserve supported custom endpoint query parameters other than the disallowed project parameter. Fixing request construction SHALL preserve one-shot attempt semantics and SHALL NOT introduce automatic retries.

#### Scenario: Default provider request
- **WHEN** the system identifies a photo using the default endpoint
- **THEN** the POST targets /v2/identify/all, contains no project query parameter, and supplies the API key and JPEG in their required locations

#### Scenario: Configured endpoint query
- **WHEN** the configured endpoint includes supported query parameters and a legacy project query parameter
- **THEN** supported parameters are retained and project is removed before making the request

### Requirement: Safe identification failure diagnostics
Each failed upstream identification attempt SHALL produce a structured server log with its attempt identifier, failure category, and upstream HTTP status when available. Transport failures SHALL distinguish DNS, connection, TLS, and timeout categories when identifiable, using a bounded fallback category otherwise. Logs and user responses SHALL NOT expose API keys, credential-bearing URLs, raw transport errors containing such URLs, provider response bodies, or image bytes. Replaying a stored terminal attempt SHALL NOT contact the provider or duplicate its upstream-failure log.

#### Scenario: Diagnose rejected requests from pod logs
- **WHEN** PlantNet rejects an identification request with HTTP 400
- **THEN** server logs identify the attempt, request-rejection category, and HTTP 400 without including the API key or provider response body

#### Scenario: Diagnose transport failures
- **WHEN** a DNS, connection, TLS, or timeout failure prevents an upstream response
- **THEN** server logs identify the attempt and sanitized transport category without recording the credential-bearing request URL

#### Scenario: Replay an unsuccessful attempt
- **WHEN** a completed failed attempt is requested again with the same idempotency key
- **THEN** the stored failure category and corresponding user message are returned without another provider request or upstream-failure log

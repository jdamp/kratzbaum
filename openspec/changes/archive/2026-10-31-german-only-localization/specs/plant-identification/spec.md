## MODIFIED Requirements

### Requirement: Provider-compatible identification requests
The system SHALL select the identification project through the configured endpoint path and SHALL NOT add a project query parameter. It SHALL send the API key as the provider-required query credential and normalized JPEG bytes as a multipart images file. It SHALL request German contextualized common names using `lang=de`, overriding any conflicting configured `lang` parameter, and SHALL preserve other supported custom endpoint query parameters. Request construction SHALL preserve one-shot attempt semantics and SHALL NOT introduce automatic retries.

#### Scenario: Default provider request
- **WHEN** the system identifies a photo using the default endpoint
- **THEN** the POST targets /v2/identify/all, contains no project query parameter, requests `lang=de`, and supplies the API key and JPEG in their required locations

#### Scenario: Configured endpoint query
- **WHEN** the configured endpoint includes supported query parameters and a legacy project query parameter
- **THEN** supported parameters other than `lang` are retained, `lang=de` is used, and project is removed before making the request

#### Scenario: Conflicting configured language
- **WHEN** the configured endpoint explicitly requests a non-German `lang`
- **THEN** the outgoing identification request uses `lang=de` without changing other supported custom query parameters

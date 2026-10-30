# Plant Identification Specification

## Purpose

Identify a plant species through an explicit PlantNet request using a backend-normalized photograph and user-confirmed results.

## Requirements

### Requirement: Explicit one-shot identification
The system SHALL contact PlantNet only when a user explicitly requests identification. Uploading a catalogue photo SHALL NOT automatically identify it. The backend SHALL hold the API key, and credentials SHALL NOT appear in frontend assets, responses, caches, or logs. Duplicate submissions of one attempt SHALL NOT cause multiple upstream requests, and uncertain failures SHALL NOT trigger automatic retries.

#### Scenario: Upload without identification
- **WHEN** a user adds a catalogue photo without requesting identification
- **THEN** no PlantNet request occurs

#### Scenario: Explicit and duplicate identification
- **WHEN** a user requests identification and the same attempt is submitted again while processing or after completion
- **THEN** at most one upstream identification request occurs for that attempt

### Requirement: Supported formats and JPEG normalization
The system SHALL accept JPG, PNG, WebP, and HEIC inputs, validate actual image content and configured size/dimension limits, preserve intended orientation and aspect ratio, and forward a JPEG image to PlantNet. A supported-format failure SHALL be reported before an upstream request is made.

#### Scenario: Identify a HEIC photograph
- **WHEN** a user requests identification with a valid HEIC image within configured limits
- **THEN** the backend decodes it and forwards a correctly oriented JPEG image to PlantNet

#### Scenario: Transparent WebP or PNG
- **WHEN** a supported image contains transparency
- **THEN** the normalized JPEG preserves visible content using a consistent background and valid JPEG encoding

#### Scenario: Invalid or oversized image
- **WHEN** input is not a decodable supported image or exceeds configured limits
- **THEN** identification fails with a useful error and no PlantNet request is sent

### Requirement: Confirm candidate species
The system SHALL present ranked candidate species with confidence scores for new and existing plants. It SHALL apply candidate species information only after the user selects and explicitly confirms a candidate. Confirmation for a new plant SHALL update only its draft; confirmation for an existing plant SHALL save species information and report success only after server confirmation. The system SHALL preserve existing species information if the user cancels or no usable candidate is returned. Candidate confirmation SHALL preserve unrelated plant details and care settings and SHALL NOT generate care advice. Changing the identification source, opening a different plant, or starting a new attempt SHALL clear unconfirmed candidate selection and prevent obsolete responses from being confirmed.

#### Scenario: Accept a suggestion
- **WHEN** a user selects and confirms a returned candidate
- **THEN** the selected species information is available to save on the plant without generating care advice

#### Scenario: Cancel identification
- **WHEN** a user closes the results without confirming a candidate
- **THEN** the existing species information and other plant form input remain unchanged

#### Scenario: Confirm an existing plant candidate
- **WHEN** a user confirms a candidate for a saved plant and the save succeeds
- **THEN** its species information is updated while its name, notes, care settings, cover, and photographs are preserved

#### Scenario: Species save fails
- **WHEN** saving a confirmed candidate for an existing plant fails
- **THEN** the interface reports that the save was not confirmed, retains the candidate for an explicit save retry, and does not repeat identification

#### Scenario: Source changes before confirmation
- **WHEN** the user replaces or removes the source photo or opens another plant before confirming a result
- **THEN** the previous unconfirmed candidates cannot be applied and any late result from the previous source is ignored

#### Scenario: A new attempt replaces previous results
- **WHEN** the user explicitly starts a new identification attempt
- **THEN** previous results and selection are cleared before new results become confirmable

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

### Requirement: Identify before plant creation
The system SHALL allow an explicit identification request for one selected photograph without requiring a saved plant. Identification and candidate confirmation SHALL NOT create a plant, catalogue photograph, cover, or photo activity. A confirmed candidate SHALL be applied only to the local draft until the user saves the plant. Cancelling creation SHALL discard the draft without creating catalogue records. Saving the draft and attaching its optional photo SHALL remain independent of identification success.

#### Scenario: Identify an unsaved plant
- **WHEN** a user selects a photograph in Add Plant and explicitly requests identification
- **THEN** ranked candidates are returned without creating a plant or attaching a catalogue photo

#### Scenario: Confirm a draft candidate and save
- **WHEN** a user confirms a candidate in Add Plant
- **THEN** its species information fills the draft without saving the plant
- **AND** a later successful Add plant action persists the confirmed or subsequently edited draft information

#### Scenario: Cancel after identification
- **WHEN** a user identifies a selected photo and then cancels Add Plant
- **THEN** no plant, catalogue photo, cover, or photo activity is created

#### Scenario: Identification fails during creation
- **WHEN** identification fails or produces no usable candidate
- **THEN** entered details and the selected photo remain available and the user can save with manually entered or absent species information

### Requirement: Identify from an existing gallery photo
The system SHALL allow a user to explicitly identify an existing plant using one of its saved photographs or a newly selected supported file. A saved-photo request SHALL verify that the photograph belongs to the target plant and use its stored full image. Identification alone SHALL NOT add a photograph, change the cover, create a photo activity, or change saved species information. Missing photographs, mismatched plant/photo references, and unreadable stored images SHALL fail before an upstream request.

#### Scenario: Use a saved photograph
- **WHEN** a user requests identification from a photograph in a plant's gallery
- **THEN** the stored image is used to return ranked candidates without requiring the user to select the file again or adding another catalogue photo

#### Scenario: Invalid saved-photo reference
- **WHEN** an identification request names a missing photo, a photo belonging to a different plant, or an unreadable stored image
- **THEN** the request fails with a useful error and no PlantNet request occurs

#### Scenario: Identify from a fresh file
- **WHEN** a user identifies an existing plant from a newly selected supported file
- **THEN** ranked candidates are returned without automatically attaching that file to the gallery

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

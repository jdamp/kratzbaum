## Purpose

Identify a plant species through an explicit PlantNet request using a backend-normalized photograph and user-confirmed results.

## ADDED Requirements

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
The system SHALL present ranked candidate species with confidence scores. It SHALL update a plant's species information only after the user confirms a candidate, and SHALL preserve existing species information if the user cancels or no usable candidate is returned.

#### Scenario: Accept a suggestion
- **WHEN** a user selects and confirms a returned candidate
- **THEN** the selected species information is available to save on the plant without generating care advice

#### Scenario: Cancel identification
- **WHEN** a user closes the results without confirming a candidate
- **THEN** the existing species information and other plant form input remain unchanged

### Requirement: Optional integration and failure states
The system SHALL allow manual species entry and all catalogue/care operations when no PlantNet key is configured. It SHALL distinguish unavailable configuration, no match, invalid input, upstream timeout, and quota failure, preserving the plant and offering only explicit user retries.

#### Scenario: Missing configuration
- **WHEN** the deployment has no PlantNet key
- **THEN** identification is shown as unavailable and users can still save plants with manually entered or absent species information

#### Scenario: Upstream failure
- **WHEN** PlantNet times out or reports quota exhaustion
- **THEN** the user receives the applicable failure state without species changes or automatic replay of the request

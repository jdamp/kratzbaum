## Purpose

Maintain one shared collection of plants with photos, editable species information, and care notes written by users.

## ADDED Requirements

### Requirement: Manage shared plant records
The system SHALL allow users with collection access to create, browse, edit, and delete plants. A plant SHALL have a required name, optional species information, photos, and care settings. Creating a plant SHALL NOT require successful identification.

#### Scenario: Create a plant without identification
- **WHEN** a user supplies a plant name and saves without identifying a photo
- **THEN** the plant is added to the shared collection with species information optional

#### Scenario: Edit and delete a plant
- **WHEN** a user edits a saved plant and later confirms its deletion
- **THEN** edits are visible in the shared collection until deletion, after which the plant and its dependent collection entries are unavailable

### Requirement: Browse and search the catalogue
The system SHALL display plant names, species information when present, representative photos when present, and care-status information. Users SHALL be able to search by plant name or saved species name.

#### Scenario: Find a saved plant
- **WHEN** a user searches for text appearing in a saved plant's name or species
- **THEN** the catalogue displays matching plants and an explicit empty state if none match

### Requirement: Manage plant photographs
The system SHALL accept JPG, PNG, WebP, and HEIC photographs, associate successfully normalized images with a plant, and allow selecting a cover image and removing photos. A successful photo addition SHALL create one dated photo activity; a failed upload SHALL NOT create a photo activity or replace the existing cover.

#### Scenario: Add and select a cover photo
- **WHEN** a user uploads a supported photograph successfully and selects it as the cover
- **THEN** it appears in the plant gallery, its dated photo activity appears in history, and catalogue/detail views use it as the cover

#### Scenario: Reject an invalid photo
- **WHEN** an upload cannot be decoded or exceeds configured limits
- **THEN** the system reports the failure without creating a photo entry or changing the existing cover

### Requirement: User-written care notes
The system SHALL allow users to add, edit, and delete dated text care notes attached to a plant. Notes SHALL appear as note activities in its timeline and the collection calendar and SHALL NOT reset watering or fertilizing schedules.

#### Scenario: Record a care note
- **WHEN** a user saves a text note for a plant at a chosen date/time
- **THEN** the text and date/time appear in the plant history and calendar, while its care due dates remain unchanged

#### Scenario: Correct a care note
- **WHEN** a user edits or deletes a previously saved note
- **THEN** subsequent plant and calendar views show the corrected text/date or omit the deleted note

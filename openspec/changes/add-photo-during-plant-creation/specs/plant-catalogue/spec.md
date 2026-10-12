## MODIFIED Requirements

### Requirement: Manage shared plant records
The system SHALL allow users with collection access to create, browse, edit, and delete plants. A plant SHALL have a required name, optional species information, photos, and care settings. Creating a plant SHALL NOT require successful identification. Users SHALL be able to select one optional photograph during creation and save a plant without a photograph. Once plant creation is confirmed, a subsequent photo-upload failure SHALL preserve the saved plant and allow explicit retry against that same plant or continuation without another upload. A photo retry SHALL NOT create another plant.

#### Scenario: Create a plant without identification
- **WHEN** a user supplies a plant name and saves without identifying a photo
- **THEN** the plant is added to the shared collection with species information optional

#### Scenario: Edit and delete a plant
- **WHEN** a user edits a saved plant and later confirms its deletion
- **THEN** edits are visible in the shared collection until deletion, after which the plant and its dependent collection entries are unavailable

#### Scenario: Create without a photo
- **WHEN** a user submits valid plant details without selecting a photo
- **THEN** the plant is saved successfully without a photo upload

#### Scenario: Photo upload fails after plant creation
- **WHEN** plant creation is confirmed but uploading its selected photo fails or cannot be confirmed
- **THEN** the saved plant remains in the shared collection and the photo selection is retained in the open creation flow
- **AND** the user is told the plant was saved and is offered Retry photo or Continue without photo

#### Scenario: Retry the photo for a saved plant
- **WHEN** the user chooses Retry photo after a photo-upload failure
- **THEN** only the selected photo is submitted to the already saved plant and no additional plant is created

#### Scenario: Continue after photo failure
- **WHEN** the user chooses Continue without photo after a photo-upload failure
- **THEN** the creation flow closes, the saved plant is visible in the collection, and no additional upload is attempted

### Requirement: Manage plant photographs
The system SHALL accept JPG, PNG, WebP, and HEIC photographs, associate successfully normalized images with a plant, and allow selecting a cover image and removing photos. A successful photo addition SHALL create one dated photo activity; a failed upload SHALL NOT create a photo activity or replace the existing cover. A photo selected during plant creation SHALL use the same format support and normalization as a gallery upload. The first successfully attached photo SHALL become the cover when the plant has no cover. Photo selection and upload SHALL NOT automatically request species identification.

#### Scenario: Add and select a cover photo
- **WHEN** a user uploads a supported photograph successfully and selects it as the cover
- **THEN** it appears in the plant gallery, its dated photo activity appears in history, and catalogue/detail views use it as the cover

#### Scenario: Reject an invalid photo
- **WHEN** an upload cannot be decoded or exceeds configured limits
- **THEN** the system reports the failure without creating a photo entry or changing the existing cover

#### Scenario: Create with a photo
- **WHEN** a user selects a supported photo during creation and the plant save and photo upload both succeed
- **THEN** the photo appears in the gallery, is used as the plant's first cover, and has one dated photo activity
- **AND** no species-identification request is made merely because the photo was selected or uploaded

## ADDED Requirements

### Requirement: Photo selection during plant creation
The Add Plant interface SHALL offer a labelled optional photo picker for one JPG, PNG, WebP, or HEIC file, show the selected filename, and show a local preview when the browser can render it. Users SHALL be able to replace or remove the selection before saving without losing other form input. Preview failure SHALL NOT prevent submission of a supported file. Selecting a file SHALL NOT create a plant or upload it before submission. Cancelling before submission SHALL discard the local selection without creating a plant or uploading a photo.

#### Scenario: Preview and replace a selected photo
- **WHEN** the user chooses a browser-previewable photo and then replaces it
- **THEN** the displayed preview and filename reflect the latest selection and existing plant form input is retained

#### Scenario: Remove a selected photo
- **WHEN** the user removes the selection before saving
- **THEN** the preview and filename are cleared and the form can be saved without a photo

#### Scenario: HEIC preview is unavailable
- **WHEN** the user selects a HEIC file that the browser cannot render
- **THEN** filename feedback explains the selection without a broken preview and the supported file remains available to submit

#### Scenario: Cancel an unsaved plant
- **WHEN** the user cancels creation after selecting a photo but before submitting
- **THEN** no plant or photo is sent to the server and the next new-plant form starts without that selection

### Requirement: Creation photo progress and recovery
The creation interface SHALL distinguish plant saving from photo uploading and prevent concurrent or repeated submission while either operation is pending. Plant-creation rejection SHALL retain the entered details and selected photo without uploading it. After confirmed creation, photo-upload failure SHALL present an accessible error with Retry photo and Continue without photo actions. The selected file SHALL remain available for retry or replacement. Retrying SHALL reuse the confirmed saved plant. Closing the flow after a confirmed save SHALL preserve that plant. Failed operations SHALL NOT be queued or retried automatically while offline.

#### Scenario: Save and upload progress
- **WHEN** a user saves a new plant with a selected photo
- **THEN** the interface announces the saving and uploading phases and prevents another create or upload submission while either phase is pending

#### Scenario: Plant creation is rejected
- **WHEN** the server rejects plant creation
- **THEN** the form retains its input and photo selection, reports the error, and does not upload the photo

#### Scenario: Recover from a photo failure
- **WHEN** the photo upload fails after the plant was saved
- **THEN** the interface explains the saved-plant state, retains the selection, and allows retry, replacement, or continuation without another upload

#### Scenario: Connection is lost during photo upload
- **WHEN** connectivity is lost after plant creation is confirmed and photo upload cannot be confirmed
- **THEN** the interface reports the upload uncertainty, retains the saved-plant context and selected file in the open flow, and requires an explicit action before another upload attempt

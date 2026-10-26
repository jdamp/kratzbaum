## MODIFIED Requirements

### Requirement: Photo selection during plant creation
The Add Plant interface SHALL offer a labelled optional photo picker for one JPG, PNG, WebP, or HEIC file, show the selected filename, and show a local preview when the browser can render it. Users SHALL be able to replace or remove the selection before saving without losing other form input. Preview failure SHALL NOT prevent submission of a supported file. Selecting a file SHALL NOT create a plant or upload it before submission. An explicit Identify species action SHALL allow sending that photo for identification before plant submission without attaching a catalogue photo. Cancelling before plant submission SHALL discard the local selection without creating a plant or attaching a catalogue photo; any previously requested identification SHALL NOT cause a subsequent catalogue save or upload.

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
- **WHEN** the user cancels creation after selecting a photo but before submitting and without requesting identification
- **THEN** no plant or photo is sent to the server and the next new-plant form starts without that selection

#### Scenario: Explicitly identify before saving
- **WHEN** the user activates Identify species for the selected creation photo
- **THEN** only an identification request is made and the form remains open for candidate confirmation and a separate plant save

#### Scenario: Cancel after an identification-only upload
- **WHEN** the user cancels creation after requesting identification but before saving the plant
- **THEN** no plant or catalogue photo is created and the next creation form has no previous selection or candidates

## ADDED Requirements

### Requirement: Shared identification review controls
Add Plant and existing plant detail SHALL expose explicit Identify species controls and a consistent review of ranked scientific names, available common names, and confidence scores. Existing plant detail SHALL offer identification from a saved gallery photo or a newly selected file. Confirmation SHALL require a current candidate selection. Identification progress and species-save progress SHALL be announced accessibly and SHALL prevent duplicate submissions and conflicting save actions. The interface SHALL explain unavailable configuration, no match, invalid input, timeout, quota exhaustion, and connectivity failure while retaining recoverable input. Identification SHALL be visibly unavailable without a configured integration or while offline, with manual species entry remaining available online. No failed request SHALL be queued or automatically retried. Controls SHALL support keyboard use and fit a 320 CSS-pixel viewport.

#### Scenario: No photo selected during creation
- **WHEN** a user opens Add Plant without selecting a photograph
- **THEN** Identify species is unavailable until a source is selected and manual plant creation remains available

#### Scenario: Review and confirm
- **WHEN** candidates are displayed in either flow
- **THEN** the user sees ranked names and confidence scores and Confirm species remains disabled until a current candidate is selected

#### Scenario: Identification is unavailable
- **WHEN** no PlantNet key is configured or the app is offline
- **THEN** the identification controls explain why they are unavailable and do not submit a request

#### Scenario: Failure and explicit retry
- **WHEN** an identification attempt fails
- **THEN** an accessible failure message is shown, input remains recoverable, and another identification requires an explicit user action

#### Scenario: Prevent concurrent actions
- **WHEN** identification or candidate saving is pending
- **THEN** duplicate identification, duplicate confirmation, and conflicting plant submission are prevented until the operation settles

#### Scenario: Keyboard and mobile review
- **WHEN** a user reviews suggestions with a keyboard or at a 320 CSS-pixel viewport
- **THEN** source selection, candidate selection, confirmation, cancellation, and feedback remain accessible without horizontal page scrolling

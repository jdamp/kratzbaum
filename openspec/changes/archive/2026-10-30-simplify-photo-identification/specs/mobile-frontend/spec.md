## MODIFIED Requirements

### Requirement: Shared identification review controls
Add Plant SHALL retain its explicit Identify species action for the selected creation photo. Existing plant detail SHALL start identification directly when the user activates Identify this photo on a saved gallery image, without a second start action. Existing plant detail SHALL NOT display Choose identification photo, an identification-only file picker, or a standalone Identify species button. Both flows SHALL provide a consistent review of ranked scientific names, available common names, and confidence scores. Merely opening plant detail, rendering a gallery, or uploading a photo SHALL NOT start identification. Confirmation SHALL require a current candidate selection. Identification progress and species-save progress SHALL be announced accessibly and SHALL prevent duplicate submissions and conflicting save actions. The interface SHALL explain unavailable configuration, no match, invalid input, timeout, quota exhaustion, rejected credentials, rejected provider requests, and connectivity failure while retaining recoverable input. Identification SHALL be visibly unavailable without a configured integration or while offline, with manual species entry remaining available online. No failed request SHALL be queued or automatically retried. Controls SHALL support keyboard use and fit a 320 CSS-pixel viewport.

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

#### Scenario: Identify a gallery image directly
- **WHEN** a user activates Identify this photo on a saved gallery image
- **THEN** one identification attempt starts for that image without requiring Identify species
- **AND** progress and results are associated visibly with the selected image and review is reachable by keyboard
- **AND** saved species information changes only after candidate selection and confirmation

#### Scenario: Existing detail has no redundant identification controls
- **WHEN** a user opens existing plant detail with or without gallery photos
- **THEN** Choose identification photo, the identification-only file picker, and the standalone Identify species action are absent
- **AND** Add photo remains available online and no identification starts without a gallery action

#### Scenario: Retry the same gallery image
- **WHEN** an attempt has failed or its results were cancelled and the user activates Identify this photo on the same image again
- **THEN** a new explicit attempt starts and previous unconfirmed results cannot be applied

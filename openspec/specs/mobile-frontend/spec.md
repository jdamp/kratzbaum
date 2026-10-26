# Mobile Frontend Specification

## Purpose

Provide a responsive, accessible interface for browsing a photo-led plant collection, recording care, and reviewing calendar activity.

## Requirements

### Requirement: Responsive primary navigation
The interface SHALL provide Today, Plants, and Calendar destinations, persistent labelled bottom navigation on phones, and an equivalent desktop navigation layout. Settings/account controls SHALL be reachable from the application shell. Primary screens SHALL work at 320 CSS pixels without horizontal page scrolling.

#### Scenario: Navigate on a phone
- **WHEN** a user opens the application at a 320 CSS-pixel viewport width
- **THEN** the three destinations and settings access remain usable and their primary content fits the viewport

#### Scenario: Navigate on desktop
- **WHEN** a user opens the application at a desktop viewport
- **THEN** the same destinations are accessible and the catalogue/content layout uses the available width

### Requirement: Today care overview
Today SHALL show overdue care before due-today and upcoming care, including the plant, activity type, and due information. It SHALL show a separate Not started yet section for configured, currently enabled schedules without an anchor, including plant name, care type, interval, and an individual Watered or Fertilized action without a due or overdue label. Users SHALL be able to open an activity-entry form from a due or not-started item, change the completed date/time, and save. Saving SHALL disable duplicate submission and update affected views only after server confirmation. Care recording SHALL remain available from plant detail independently of reminder eligibility.

#### Scenario: Record care from Today
- **WHEN** a user selects Water on an outstanding item and successfully saves the completed activity
- **THEN** Today, the plant's history, and calendar reflect the confirmed event and recalculated due date

#### Scenario: Failed save
- **WHEN** saving care fails
- **THEN** the interface retains the input, shows an actionable error, and does not mark the activity completed

#### Scenario: First watering from Not started yet
- **WHEN** a user saves the first watering for a plant without a care start date through its Not started yet action
- **THEN** only that plant's watering item leaves the section and a dated watering reminder appears based on the selected completion date
- **AND** its eligible, unstarted fertilizing item remains in Not started yet

#### Scenario: Nothing due with schedules not started
- **WHEN** no care is due and at least one eligible schedule is not started
- **THEN** Today shows the Not started yet section alongside an accurate no-due-care message

### Requirement: Photo-led catalogue and plant detail
Plants SHALL provide search and a responsive photo-card collection with an Add Plant action. Plant detail SHALL expose photos, species information, schedules, care notes, activity history, and actions to record or correct activities.

#### Scenario: Open plant detail
- **WHEN** a user selects a plant card
- **THEN** its detail view exposes saved information, due care, gallery, and timeline, with applicable editing actions available online

### Requirement: Readable mobile calendar
Calendar SHALL provide a month overview and a selected-day agenda that is readable on phones. Users SHALL be able to distinguish completed activities from scheduled due care and filter activity types.

#### Scenario: Review a busy day
- **WHEN** the selected day contains several activity types and due-care items
- **THEN** the agenda presents their readable labels and plant names without requiring text to fit inside the month cells

### Requirement: Consistent activity colour coding
Watering, fertilizing, photos, and notes SHALL each have a consistent distinct colour across relevant views, accompanied by an icon and text label. Colour alone SHALL NOT convey type, overdue status, or completed status.

#### Scenario: Recognize an activity without colour
- **WHEN** a user views a timeline or calendar without being able to distinguish its colours
- **THEN** the activity type and its completed/due status remain understandable from labels and other indicators

### Requirement: Accessible controls and states
Controls SHALL support keyboard operation, visible focus, labelled form inputs, accessible error/loading feedback, and phone touch targets of at least 44 CSS pixels. Dialogs SHALL manage focus. Screens SHALL expose distinct empty, loading, error, offline, and unavailable-offline states.

#### Scenario: Operate a care-entry dialog with a keyboard
- **WHEN** a keyboard user opens, edits, submits, or closes a care-entry dialog
- **THEN** focus remains usable and returns to an appropriate control, and saving/errors are conveyed accessibly

#### Scenario: Select HEIC without native browser preview
- **WHEN** a user selects a HEIC file in a browser that cannot preview it
- **THEN** filename/progress feedback remains available until a backend-normalized preview or a useful error is shown

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

### Requirement: Simplified plant species fields
The add/edit plant form SHALL offer an optional Scientific name input without Common name or Family inputs. Saving edits through this form SHALL preserve any previously saved common name and family. Creating a plant without identification SHALL NOT require either omitted field.

#### Scenario: Create with simplified species input
- **WHEN** a user opens Add Plant
- **THEN** Scientific name is optional, Common name and Family inputs are absent, and the plant can be saved with its required details

#### Scenario: Edit without losing saved species metadata
- **WHEN** a user updates a plant through the simplified edit form
- **THEN** the requested editable details are saved and the plant's existing common name and family are preserved

### Requirement: Scientific name Wikipedia reference
When a plant has a nonblank scientific name, plant detail SHALL display that name as a keyboard-accessible link to the corresponding English Wikipedia title, opening in a new tab. The link SHALL identify Wikipedia and the new-tab behavior accessibly. The destination SHALL be generated from the trimmed scientific name with whitespace converted to underscores and the title safely URL-encoded. Plants without a scientific name SHALL retain the existing species fallback without a Wikipedia link. No additional reference form input or automatic Wikipedia network lookup SHALL be required.

#### Scenario: Open a species reference
- **WHEN** a user opens a plant with scientific name Monstera deliciosa
- **THEN** its scientific name links to the Monstera_deliciosa title on English Wikipedia in a new tab

#### Scenario: Scientific name is absent
- **WHEN** a plant has no nonblank scientific name
- **THEN** the existing species fallback is shown without a Wikipedia link

#### Scenario: Encode a scientific name
- **WHEN** a scientific name includes repeated whitespace, Unicode, or URL-reserved characters
- **THEN** the link remains on English Wikipedia and represents the complete normalized title without injecting a query or fragment

### Requirement: Dedicated login page
Signed-out OIDC visitors SHALL see a standalone branded `/login` page with a clear identity-provider sign-in action instead of collection navigation, empty collection content, or editing controls. Collection requests SHALL wait until authentication is confirmed. The page SHALL work at 320 CSS pixels and support keyboard operation and touch targets of at least 44 CSS pixels. Sign-in SHALL use the existing server authentication route.

#### Scenario: Signed-out collection visit
- **WHEN** a signed-out OIDC visitor opens a collection destination or plant detail
- **THEN** the application replaces the URL with `/login`, displays the login page, and does not request protected collection data

#### Scenario: Start provider sign-in
- **WHEN** an online visitor activates the login action
- **THEN** the browser navigates to the server login route and follows the provider redirect

#### Scenario: Login is unnecessary
- **WHEN** an authenticated visitor or an open-access deployment visitor opens `/login`
- **THEN** the application replaces the URL with `/` and displays the collection

#### Scenario: Session expires
- **WHEN** the application learns that collection access has been denied
- **THEN** it closes collection editing, clears visible collection content, and displays `/login`

#### Scenario: Offline and unavailable bootstrap
- **WHEN** the visitor is signed out offline or bootstrap cannot be loaded
- **THEN** the page provides accessible connection or error feedback, offers retry for a failed bootstrap, and does not offer an active offline sign-in action

#### Scenario: Authenticated offline collection
- **WHEN** a previously authenticated visitor opens cached collection content offline
- **THEN** the existing offline collection experience remains available

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

### Requirement: Optional care start input
The add/edit plant form SHALL allow a blank care start date while retaining valid care intervals. New-plant forms SHALL default this date to blank and explain that schedules start when actual watering or fertilizing is recorded unless an optional fallback date is supplied. Editing SHALL show the saved value and allow clearing it without deleting activities. Creation recovery and plant detail SHALL represent absent care dates without displaying an invalid or fabricated date.

#### Scenario: Add a plant before doing care
- **WHEN** the user supplies a plant name and valid intervals and leaves Care started blank
- **THEN** the plant saves successfully without any completed care or dated reminders being invented

#### Scenario: Edit an existing fallback date
- **WHEN** the user edits a plant with a saved care start date
- **THEN** the saved date is shown and can be retained, changed, or cleared

### Requirement: Reminder photo previews
Today due, upcoming, and not-started items SHALL display the plant's current cover-photo thumbnail when available. Missing or unavailable photos SHALL use a nonbroken fallback while retaining the plant name, activity icon and text, status, and applicable care action. Photo previews SHALL fit the mobile layout and SHALL NOT be required to understand or operate a reminder.

#### Scenario: Upcoming plant with a photo
- **WHEN** an upcoming reminder belongs to a plant with an available cover photo
- **THEN** the reminder shows that cover-photo preview alongside its plant name and care information

#### Scenario: Photo is absent or fails to load
- **WHEN** a reminder's plant has no photo or its thumbnail cannot be loaded
- **THEN** a fallback appears and the reminder remains readable and usable

#### Scenario: Cover selection changes
- **WHEN** a user changes or removes a cover photo and the collection is refreshed
- **THEN** affected reminders show the current cover thumbnail or fallback

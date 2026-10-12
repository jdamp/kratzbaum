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
Today SHALL show overdue care before due-today and upcoming care, including the plant, activity type, and due information. Users SHALL be able to open an activity-entry form from a due item, change the completed date/time, and save. Saving SHALL disable duplicate submission and update affected views only after server confirmation.

#### Scenario: Record care from Today
- **WHEN** a user selects Water on an outstanding item and successfully saves the completed activity
- **THEN** Today, the plant's history, and calendar reflect the confirmed event and recalculated due date

#### Scenario: Failed save
- **WHEN** saving care fails
- **THEN** the interface retains the input, shows an actionable error, and does not mark the activity completed

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

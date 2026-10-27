## MODIFIED Requirements

### Requirement: Responsive primary navigation
The interface SHALL provide Today, Plants, Calendar, and Rooms destinations in that order, persistent labelled bottom navigation on phones, and an equivalent desktop navigation layout with Rooms below Calendar. Settings/account controls SHALL be reachable from the application shell. Rooms SHALL expose room management at `/rooms` instead of embedding it in Settings, and direct visits or reloads SHALL open that destination. Primary screens SHALL work at 320 CSS pixels without horizontal page scrolling.

#### Scenario: Navigate on a phone
- **WHEN** a user opens the application at a 320 CSS-pixel viewport width
- **THEN** the four destinations and settings access remain usable and their primary content fits the viewport

#### Scenario: Navigate on desktop
- **WHEN** a user opens the application at a desktop viewport
- **THEN** the same destinations are accessible and the catalogue/content layout uses the available width
- **AND** Rooms appears below Calendar in the sidebar

#### Scenario: Open Rooms directly
- **WHEN** an authorized user visits or reloads `/rooms`
- **THEN** the Rooms destination is selected and its room-management controls are displayed

### Requirement: Reminder photo previews
Today due, upcoming, and not-started items SHALL display the plant's current cover-photo thumbnail when available. Missing or unavailable photos SHALL use a nonbroken fallback while retaining the plant name, activity icon and text, status, and applicable care action. Photo previews SHALL fit the mobile layout and SHALL NOT be required to understand or operate a reminder. Each thumbnail or fallback SHALL be a labelled, keyboard-accessible link to its plant detail, independent of the care-completion action.

#### Scenario: Upcoming plant with a photo
- **WHEN** an upcoming reminder belongs to a plant with an available cover photo
- **THEN** the reminder shows that cover-photo preview alongside its plant name and care information

#### Scenario: Photo is absent or fails to load
- **WHEN** a reminder's plant has no photo or its thumbnail cannot be loaded
- **THEN** a fallback appears and the reminder remains readable and usable

#### Scenario: Cover selection changes
- **WHEN** a user changes or removes a cover photo and the collection is refreshed
- **THEN** affected reminders show the current cover thumbnail or fallback

#### Scenario: Open a plant from an upcoming reminder
- **WHEN** a user clicks or keyboard-activates an upcoming reminder's thumbnail or fallback
- **THEN** the corresponding plant detail opens without recording a care activity

## ADDED Requirements

### Requirement: Simple new-note entry
The plant-detail new-note form SHALL provide note text and a save action without a Written at field or other date/time input. Submitting SHALL use the current server time rather than when the form was opened. Failed submissions SHALL retain note text and remain explicitly retryable; offline submissions SHALL remain disabled. Existing note correction SHALL retain its activity date/time editing controls.

#### Scenario: Save a note after leaving the form open
- **WHEN** a user writes and saves a new note after the plant page has been open for some time
- **THEN** the note receives the current save time and no new-note timestamp input is displayed

#### Scenario: Failed note save
- **WHEN** a new note cannot be saved
- **THEN** its text remains available and no successful note is fabricated

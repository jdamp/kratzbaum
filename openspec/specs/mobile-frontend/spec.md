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

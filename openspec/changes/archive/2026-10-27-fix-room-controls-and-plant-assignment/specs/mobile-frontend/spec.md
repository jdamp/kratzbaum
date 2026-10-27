## MODIFIED Requirements

### Requirement: Accessible controls and states
Controls SHALL support keyboard operation, visible focus, labelled form inputs, accessible error/loading feedback, and phone touch targets of at least 44 CSS pixels. Dialogs SHALL manage focus. Screens SHALL expose distinct empty, loading, error, offline, and unavailable-offline states. Room controls SHALL distinguish idle disabled actions from pending mutations: an empty-name Add room button SHALL NOT show a waiting cursor, and saving feedback SHALL be shown only while the mutation is pending. A valid name SHALL enable Add room when online, room data is available, and no mutation is pending.

#### Scenario: Operate a care-entry dialog with a keyboard
- **WHEN** a keyboard user opens, edits, submits, or closes a care-entry dialog
- **THEN** focus remains usable and returns to an appropriate control, and saving/errors are conveyed accessibly

#### Scenario: Select HEIC without native browser preview
- **WHEN** a user selects a HEIC file in a browser that cannot preview it
- **THEN** filename/progress feedback remains available until a backend-normalized preview or a useful error is shown

#### Scenario: Empty room form is idle
- **WHEN** the online room form has an empty name and no request is pending, including immediately after a successful creation
- **THEN** Add room is disabled without a waiting cursor or Saving indicator
- **AND** entering a valid room name enables Add room

#### Scenario: Room save finishes
- **WHEN** a room mutation succeeds or fails
- **THEN** its pending indicators end and controls return to the appropriate enabled or idle disabled state without duplicate writes

# Plant Rooms Specification

## Purpose

Organize the shared plant collection into named rooms so users can browse plants and record individual care while working through one room at a time.

## Requirements

### Requirement: Manage shared rooms
Users with collection access SHALL be able to create, list, rename, and delete shared named rooms. Room names SHALL be trimmed, nonblank, and unique without regard to letter case. A failed room change SHALL retain recoverable input and leave confirmed room data unchanged. Deleting a room SHALL require confirmation explaining that its plants become unassigned, and SHALL preserve all plants, photos, care settings, and activities. A confirmed room mutation SHALL promptly finish its saving state, update the visible room list from the confirmed result, and allow the next valid room submission independently of unrelated collection reads. A failed or delayed post-save refresh SHALL NOT cause the confirmed mutation to be resubmitted or leave an indefinite Saving indicator. Inline room management SHALL continue to preserve plant-form drafts. Successful room creation or rename SHALL announce exactly Room “<name>” saved. with the confirmed room name and no additional instruction.

#### Scenario: Create and rename a room
- **WHEN** a user creates Arbeitszimmer and later renames it to Wohnzimmer
- **THEN** the shared room list and assigned plants show the updated name without reassignment

#### Scenario: Reject blank or duplicate names
- **WHEN** a user submits a blank room name or a name matching another room after trimming and ignoring letter case
- **THEN** the system rejects the change with a useful validation error and preserves the existing rooms

#### Scenario: Delete an occupied room
- **WHEN** a user confirms deletion of a room containing plants
- **THEN** the room is removed and its plants become unassigned without loss of their content or care history

#### Scenario: Create another room while unrelated reads are stalled
- **WHEN** room creation is confirmed while a collection refresh is delayed or fails
- **THEN** the created room is shown, the Saving indicator ends, and entering another valid name enables Add room without repeating the first creation

#### Scenario: Concise room-save confirmation
- **WHEN** a user successfully creates or renames a room to Wohzimmer
- **THEN** the confirmation is exactly Room “Wohzimmer” saved.

### Requirement: Optional plant room assignment
Each plant SHALL belong to at most one room and SHALL support an unassigned state. The add/edit plant form SHALL offer an optional room selector. Plant detail SHALL also provide a visible labelled room selector with all available rooms and Unassigned, and an explicit save action without requiring the full plant editor. Users SHALL be able to assign, move, or unassign an existing plant without resetting care anchors or creating activities. A room assignment referencing a nonexistent room SHALL be rejected. Existing plants SHALL remain unassigned after upgrade until a room is selected. Saving a room assignment SHALL preserve all other plant details, care settings, photographs, and activity history. Confirmed assignment changes SHALL update plant detail and affected Plants and Today room filters. Saving SHALL prevent duplicate submission; a failed save SHALL preserve the selected room for explicit retry while confirmed assignment remains unchanged. Changes SHALL be disabled offline or when room information is unavailable.

#### Scenario: Create without a room
- **WHEN** a user saves a plant without choosing a room
- **THEN** the plant saves successfully as unassigned

#### Scenario: Move a plant
- **WHEN** a plant is moved from Arbeitszimmer to Wohnzimmer
- **THEN** it appears in Wohnzimmer and no longer in Arbeitszimmer while its care deadlines and history remain unchanged

#### Scenario: Room was deleted while editing
- **WHEN** a user submits a plant assignment to a room that no longer exists
- **THEN** the save is rejected with a useful error and the plant form remains recoverable

#### Scenario: Assign an existing unassigned plant from detail
- **WHEN** a user opens an existing unassigned plant, selects Wohnzimmer beside its room information, and saves
- **THEN** the confirmed room is Wohnzimmer and the plant appears in that room in Plants and Today without creating care activities

#### Scenario: Move or unassign from detail
- **WHEN** a user selects another room or Unassigned on plant detail and saves
- **THEN** the plant moves to the confirmed selection while its other details, care settings, photographs, and history are preserved

#### Scenario: Assignment failure and retry
- **WHEN** saving a selected room fails
- **THEN** the confirmed room remains unchanged, the selection remains available for explicit retry, and an accessible error is shown

#### Scenario: Assignment unavailable offline
- **WHEN** a plant is viewed offline or room information is unavailable
- **THEN** the confirmed room is readable and room assignment changes are disabled

### Requirement: Room-scoped collection and care views
Plants and Today SHALL offer All rooms, each existing room, and Unassigned filters. The selected room SHALL be retained when navigating between Plants and Today during the session. On Today, it SHALL filter due, upcoming, not-started, and collection-preview items and their displayed counts consistently. Care SHALL be recorded through individual plant/activity actions. Filters SHALL NOT hide available actions because of an unrelated plant-name search. Room controls SHALL support keyboard operation and fit a 320 CSS-pixel viewport with touch targets of at least 44 CSS pixels.

#### Scenario: Care for one room
- **WHEN** the user selects Arbeitszimmer on Today
- **THEN** every displayed care item and collection-preview plant belongs to Arbeitszimmer and displayed section counts match those items

#### Scenario: Open Plants from a room's care overview
- **WHEN** a user navigates from Today with Wohnzimmer selected to Plants
- **THEN** Wohnzimmer remains selected and its plants are shown subject to any catalogue search

#### Scenario: Browse unassigned plants
- **WHEN** the user selects Unassigned
- **THEN** only plants without a room and their applicable care items are displayed

#### Scenario: Search does not disable room care
- **WHEN** a catalogue search excludes a plant that has a care item in the selected room on Today
- **THEN** that care item's individual recording action remains usable

#### Scenario: Selected room is deleted
- **WHEN** refreshed room data confirms that the selected room was deleted
- **THEN** the selection returns to All rooms and the room's surviving plants are available under Unassigned

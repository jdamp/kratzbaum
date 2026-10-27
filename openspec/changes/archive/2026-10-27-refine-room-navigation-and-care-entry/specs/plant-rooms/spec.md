## MODIFIED Requirements

### Requirement: Manage shared rooms
Users with collection access SHALL be able to create, list, rename, and delete shared named rooms. Room names SHALL be trimmed, nonblank, and unique without regard to letter case. A failed room change SHALL retain recoverable input and leave confirmed room data unchanged. Deleting a room SHALL require confirmation explaining that its plants become unassigned, and SHALL preserve all plants, photos, care settings, and activities. A confirmed room mutation SHALL promptly finish its saving state, update the visible room list from the confirmed result, and allow the next valid room submission independently of unrelated collection reads. A failed or delayed post-save refresh SHALL NOT cause the confirmed mutation to be resubmitted or leave an indefinite Saving indicator. Inline room management SHALL continue to preserve plant-form drafts.

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

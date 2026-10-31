## MODIFIED Requirements

### Requirement: Optional plant room assignment
Each plant SHALL belong to at most one room and SHALL support an unassigned state. The add/edit plant form SHALL offer an optional room selector. Plant detail SHALL display its saved room or unassigned state in the identity header, and Bearbeiten SHALL open the editor containing a labelled selector with all available rooms and Unassigned. Room changes SHALL be committed through the editor's explicit Änderungen speichern action rather than an always-visible standalone room-assignment form. Users SHALL be able to assign, move, or unassign an existing plant without resetting care anchors or creating activities. A room assignment referencing a nonexistent room SHALL be rejected. Existing plants SHALL remain unassigned after upgrade until a room is selected. A room-only edit SHALL preserve all unrelated plant details, the Wikipedia override, care settings, photographs, and activity history, including unrelated changes confirmed before its submission. Confirmed assignment changes SHALL update plant detail and affected Plants and Today room filters. Saving SHALL prevent duplicate submission; a failed save SHALL preserve the selected room for explicit retry while confirmed assignment remains unchanged. Room changes SHALL be disabled offline or when room information is unavailable; unavailable room information SHALL NOT prevent unrelated plant edits or silently clear an assignment.

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
- **WHEN** a user opens Bearbeiten from an existing unassigned plant, selects Wohnzimmer, and saves
- **THEN** the confirmed room is Wohnzimmer and the plant appears in that room in Plants and Today without creating care activities

#### Scenario: Move or unassign from detail
- **WHEN** a user selects another room or Unassigned in Bearbeiten and saves
- **THEN** the plant moves to the confirmed selection while unrelated details, its Wikipedia override, care settings, photographs, and history are preserved

#### Scenario: Assignment failure and retry
- **WHEN** saving a selected room fails
- **THEN** the confirmed room remains unchanged, the editor retains the selection for explicit retry, and an accessible error is shown

#### Scenario: Assignment unavailable offline
- **WHEN** a plant is viewed offline or room information is unavailable
- **THEN** its confirmed room remains readable and assignment changes are disabled

#### Scenario: Cancel a room edit
- **WHEN** a user changes the room in Bearbeiten and cancels
- **THEN** the saved assignment and collection filters remain unchanged

#### Scenario: Preserve a newer unrelated change
- **WHEN** the user changes only the room while another client has confirmed changes to unrelated plant fields before submission
- **THEN** saving the room preserves those newer unrelated values

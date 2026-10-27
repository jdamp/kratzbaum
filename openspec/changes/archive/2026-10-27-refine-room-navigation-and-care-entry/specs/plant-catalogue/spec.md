## MODIFIED Requirements

### Requirement: User-written care notes
The system SHALL allow users to add, edit, and delete dated text care notes attached to a plant. New notes entered on plant detail SHALL automatically receive the current server time at submission without asking the user for a date or time. Users SHALL retain the ability to correct saved note text and timestamps. Notes SHALL appear as note activities in the timeline and collection calendar and SHALL NOT reset watering or fertilizing schedules.

#### Scenario: Record a care note
- **WHEN** a user saves a text note for a plant
- **THEN** the text and current submission date/time appear in plant history and calendar, while care due dates remain unchanged

#### Scenario: Correct a care note
- **WHEN** a user edits or deletes a previously saved note
- **THEN** subsequent plant and calendar views show the corrected text/date or omit the deleted note

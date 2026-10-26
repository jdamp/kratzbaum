## MODIFIED Requirements

### Requirement: Completion-based due dates
The system SHALL calculate the next due date from the latest completed activity of that care type plus the applicable interval. Before any such activity exists, it SHALL use the plant's editable, optional care start date when supplied, without creating a completed activity. The care start date SHALL default to absent rather than the creation date. A configured, currently enabled schedule without either anchor SHALL be not started and SHALL have no due date. Watering and fertilizing SHALL be evaluated independently. Adding a note or photo SHALL NOT alter either care anchor.

#### Scenario: Care completed after its due date
- **WHEN** a plant on a seven-day watering interval is due Monday and is actually watered Wednesday
- **THEN** its next watering date is the following Wednesday

#### Scenario: Plant without care history
- **WHEN** a plant has no watering events and its explicitly supplied care start date is June 1 with a seven-day watering interval
- **THEN** its first watering is due June 8 and no completed watering is invented

#### Scenario: Configure an interval without starting care
- **WHEN** a plant is created with a seven-day watering interval and no care start date or completed watering
- **THEN** the interval is saved and watering is not started, with no due date or completed watering

#### Scenario: Start care types independently
- **WHEN** a plant without a care start date has enabled watering and fertilizing schedules and its first watering is recorded June 8
- **THEN** its next watering date is June 8 plus its watering interval and fertilizing remains not started

#### Scenario: Clear an optional fallback date
- **WHEN** the care start date is cleared on a plant with watering history and no fertilizing history
- **THEN** watering remains anchored to its latest completed watering and enabled fertilizing becomes not started

#### Scenario: Upgrade existing plants
- **WHEN** an existing collection is upgraded to support optional care start dates
- **THEN** existing care start dates, completed activities, and calculated deadlines are preserved without inventing or deleting history

### Requirement: Record and correct completed care
The system SHALL let users record watering and fertilizing at a chosen date/time, defaulting to now, and edit or delete incorrect records. It SHALL derive due dates from the latest surviving completed event of the affected type, then the optional care start date if no event remains. With neither anchor, a configured and currently enabled schedule SHALL return to not started. Repeated submissions carrying the same submission identifier SHALL create at most one event.

#### Scenario: Backdated care
- **WHEN** a user records on June 10 that watering happened June 8
- **THEN** the watering event is dated June 8 and its interval is anchored to June 8

#### Scenario: Delete the latest care event
- **WHEN** a user deletes a plant's latest watering event
- **THEN** the next watering date is derived from the previous surviving watering event, or the optional care start date if no event remains
- **AND** if neither anchor remains, watering becomes not started without a due date

#### Scenario: Duplicate save
- **WHEN** the same activity submission identifier is received twice
- **THEN** only one completed activity is stored and the care anchor advances only once

### Requirement: Timeline and calendar
The system SHALL provide chronological plant history and a collection calendar containing completed watering, fertilizing, photo, and note activities. The calendar SHALL also expose one outstanding due date per enabled and anchored plant/activity schedule and distinguish it from completed care. Not-started schedules SHALL NOT appear as dated calendar entries. Missed due dates SHALL NOT become completed events or generate multiple outstanding copies.

#### Scenario: Review mixed activities
- **WHEN** a plant has watering, fertilizing, photo, and note entries within the selected calendar period
- **THEN** all four types are available with their plant, date/time, and type, and due-care items are distinguishable from completed entries

#### Scenario: Overdue activity
- **WHEN** watering is several intervals overdue without a new completed watering
- **THEN** there is one outstanding watering task and no fabricated watering history

#### Scenario: No calendar deadline before first care
- **WHEN** a configured schedule has no completed activity or care start date
- **THEN** no calendar day contains a due entry for that schedule

## ADDED Requirements

### Requirement: Not-started schedule overview
The system SHALL expose configured, currently enabled schedules without an anchor separately from dated due and upcoming care. Each not-started item SHALL identify its plant, care type, and applicable interval without due-date or overdue information. Paused or unconfigured fertilizing SHALL be excluded. Season changes SHALL reevaluate fertilizing eligibility without creating an anchor or completed activity.

#### Scenario: Paused or unconfigured fertilizing
- **WHEN** a plant has no care anchors and its current-season fertilizing is paused or has no interval
- **THEN** watering is listed as not started and fertilizing is absent from both not-started and dated care

#### Scenario: Fertilizing becomes enabled in a new season
- **WHEN** fertilizing has no anchor and a season change activates a configured, unpaused fertilizing interval
- **THEN** fertilizing appears as not started without a fabricated deadline

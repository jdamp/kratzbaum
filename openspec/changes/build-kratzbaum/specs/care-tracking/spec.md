## Purpose

Track completed plant care and calculate individual watering and seasonal fertilizing due dates for shared timelines and calendar views.

## ADDED Requirements

### Requirement: Per-plant care intervals
Each plant SHALL have independently configurable watering and summer/winter fertilizing intervals in positive whole calendar days. Fertilizing SHALL support an explicit paused state per season. The system SHALL reject zero, negative, or non-integer intervals.

#### Scenario: Different schedules for different plants
- **WHEN** one plant has a seven-day watering interval and another has a fourteen-day interval with the same care anchor
- **THEN** their next watering dates differ according to their own intervals

#### Scenario: Invalid interval
- **WHEN** a user submits a zero, negative, or non-integer interval
- **THEN** the system rejects the setting and retains the last valid schedule

### Requirement: Completion-based due dates
The system SHALL calculate the next due date from the latest completed activity of that care type plus the applicable interval. Before any such activity exists, it SHALL use the plant's editable care start date, defaulting to its creation date, without creating a completed activity. Adding a note or photo SHALL NOT alter either care anchor.

#### Scenario: Care completed after its due date
- **WHEN** a plant on a seven-day watering interval is due Monday and is actually watered Wednesday
- **THEN** its next watering date is the following Wednesday

#### Scenario: Plant without care history
- **WHEN** a plant has no watering events and its care start date is June 1 with a seven-day watering interval
- **THEN** its first watering is due June 8 and no completed watering is invented

### Requirement: Northern hemisphere fertilizing seasons
The system SHALL evaluate summer as April 1 through September 30 and winter as October 1 through March 31 in the deployment timezone. It SHALL use the currently active season's fertilizing interval when calculating outstanding due care, including after a season switch or interval edit. Paused fertilizing SHALL have no outstanding due date for that season.

#### Scenario: Switch to winter interval
- **WHEN** evaluation changes from September 30 to October 1
- **THEN** the next fertilizing date is recalculated from the same completed-care anchor using that plant's winter setting, without changing its recorded history

#### Scenario: Paused winter fertilizing
- **WHEN** a plant's winter fertilizing setting is paused and the current season is winter
- **THEN** the plant has no outstanding fertilizing task until a non-paused setting applies

### Requirement: Record and correct completed care
The system SHALL let users record watering and fertilizing at a chosen date/time, defaulting to now, and edit or delete incorrect records. It SHALL derive due dates from the latest surviving completed event of the affected type. Repeated submissions carrying the same submission identifier SHALL create at most one event.

#### Scenario: Backdated care
- **WHEN** a user records on June 10 that watering happened June 8
- **THEN** the watering event is dated June 8 and its interval is anchored to June 8

#### Scenario: Delete the latest care event
- **WHEN** a user deletes a plant's latest watering event
- **THEN** the next watering date is derived from the previous surviving watering event, or the care start date if no event remains

#### Scenario: Duplicate save
- **WHEN** the same activity submission identifier is received twice
- **THEN** only one completed activity is stored and the care anchor advances only once

### Requirement: Timeline and calendar
The system SHALL provide chronological plant history and a collection calendar containing completed watering, fertilizing, photo, and note activities. The calendar SHALL also expose one outstanding due date per enabled plant/activity schedule and distinguish it from completed care. Missed due dates SHALL NOT become completed events or generate multiple outstanding copies.

#### Scenario: Review mixed activities
- **WHEN** a plant has watering, fertilizing, photo, and note entries within the selected calendar period
- **THEN** all four types are available with their plant, date/time, and type, and due-care items are distinguishable from completed entries

#### Scenario: Overdue activity
- **WHEN** watering is several intervals overdue without a new completed watering
- **THEN** there is one outstanding watering task and no fabricated watering history

### Requirement: Calendar-day calculation
The system SHALL use one configurable deployment timezone for season boundaries, activity display, and interval calculations. Due dates SHALL advance by calendar days rather than fixed multiples of twenty-four hours.

#### Scenario: Interval crosses daylight-saving time
- **WHEN** a seven-day care interval crosses a daylight-saving transition in the deployment timezone
- **THEN** its next due date remains seven local calendar dates after the anchor

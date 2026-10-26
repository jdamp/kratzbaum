## MODIFIED Requirements

### Requirement: Today care overview
Today SHALL show overdue care before due-today and upcoming care, including the plant, activity type, and due information. It SHALL show a separate Not started yet section for configured, currently enabled schedules without an anchor, including plant name, care type, interval, and an individual Watered or Fertilized action without a due or overdue label. Users SHALL be able to open an activity-entry form from a due or not-started item, change the completed date/time, and save. Saving SHALL disable duplicate submission and update affected views only after server confirmation. Care recording SHALL remain available from plant detail independently of reminder eligibility.

#### Scenario: Record care from Today
- **WHEN** a user selects Water on an outstanding item and successfully saves the completed activity
- **THEN** Today, the plant's history, and calendar reflect the confirmed event and recalculated due date

#### Scenario: Failed save
- **WHEN** saving care fails
- **THEN** the interface retains the input, shows an actionable error, and does not mark the activity completed

#### Scenario: First watering from Not started yet
- **WHEN** a user saves the first watering for a plant without a care start date through its Not started yet action
- **THEN** only that plant's watering item leaves the section and a dated watering reminder appears based on the selected completion date
- **AND** its eligible, unstarted fertilizing item remains in Not started yet

#### Scenario: Nothing due with schedules not started
- **WHEN** no care is due and at least one eligible schedule is not started
- **THEN** Today shows the Not started yet section alongside an accurate no-due-care message

## ADDED Requirements

### Requirement: Optional care start input
The add/edit plant form SHALL allow a blank care start date while retaining valid care intervals. New-plant forms SHALL default this date to blank and explain that schedules start when actual watering or fertilizing is recorded unless an optional fallback date is supplied. Editing SHALL show the saved value and allow clearing it without deleting activities. Creation recovery and plant detail SHALL represent absent care dates without displaying an invalid or fabricated date.

#### Scenario: Add a plant before doing care
- **WHEN** the user supplies a plant name and valid intervals and leaves Care started blank
- **THEN** the plant saves successfully without any completed care or dated reminders being invented

#### Scenario: Edit an existing fallback date
- **WHEN** the user edits a plant with a saved care start date
- **THEN** the saved date is shown and can be retained, changed, or cleared

### Requirement: Reminder photo previews
Today due, upcoming, and not-started items SHALL display the plant's current cover-photo thumbnail when available. Missing or unavailable photos SHALL use a nonbroken fallback while retaining the plant name, activity icon and text, status, and applicable care action. Photo previews SHALL fit the mobile layout and SHALL NOT be required to understand or operate a reminder.

#### Scenario: Upcoming plant with a photo
- **WHEN** an upcoming reminder belongs to a plant with an available cover photo
- **THEN** the reminder shows that cover-photo preview alongside its plant name and care information

#### Scenario: Photo is absent or fails to load
- **WHEN** a reminder's plant has no photo or its thumbnail cannot be loaded
- **THEN** a fallback appears and the reminder remains readable and usable

#### Scenario: Cover selection changes
- **WHEN** a user changes or removes a cover photo and the collection is refreshed
- **THEN** affected reminders show the current cover thumbnail or fallback

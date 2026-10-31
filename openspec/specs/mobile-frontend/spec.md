# Mobile Frontend Specification

## Purpose

Provide a responsive, accessible interface for browsing a photo-led plant collection, recording care, and reviewing calendar activity.

## Requirements

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

### Requirement: Photo-led catalogue and plant detail
Plants SHALL provide search and a responsive photo-card collection with an Add Plant action. Plant detail at `/plants/:plantId` SHALL show one identity header containing the cover photo or a nonbroken fallback, plant name, available species information and reference, room or unassigned state, and a Bearbeiten action. Detail SHALL provide labelled Übersicht, Fotos, and Verlauf sections, defaulting to Übersicht on a fresh visit. Switching sections SHALL retain the current plant and SHALL NOT mutate saved data. The header and section navigation SHALL remain available in each section; the application navigation SHALL remain usable.

Übersicht SHALL prioritize watering and fertilizing status with their recording actions, followed by a compact care-plan summary, saved plant notes, and a recent-activity preview linking to Verlauf. It SHALL distinguish overdue, due today, upcoming, not started, paused, and unconfigured states without inventing deadlines. Fotos SHALL expose photo upload, cover selection, deletion, and explicit identification from a saved photograph. Verlauf SHALL expose chronological activity, type filters, dated-note creation, and activity correction/deletion. Persistent plant notes SHALL remain distinct from dated note activities. Empty, loading, failed-read, and unavailable-offline states SHALL be explicit. Phone layouts SHALL use a readable single column at 320 CSS pixels without horizontal page scrolling; desktop layouts SHALL use available width while preserving this hierarchy.

#### Scenario: Open plant detail
- **WHEN** a user selects a plant card or opens its detail URL directly
- **THEN** Übersicht shows the plant identity, saved care state, care actions, plan, plant notes, and recent activities with applicable editing actions available online

#### Scenario: Switch detail sections
- **WHEN** a user switches among Übersicht, Fotos, and Verlauf
- **THEN** the same plant and identity header remain selected and each section exposes its relevant controls without changing saved data

#### Scenario: Missing cover and empty content
- **WHEN** a plant has no available cover, photographs, plant notes, or activities
- **THEN** the applicable fallback or empty state appears with an online action to add content and no fabricated content

#### Scenario: Reminder is paused or not started
- **WHEN** the current care state is paused, unconfigured, or lacks a care anchor
- **THEN** Übersicht explains that state without a dated reminder and still offers manual care recording online

#### Scenario: Small phone and desktop layouts
- **WHEN** plant detail is viewed at 320 CSS pixels or on desktop
- **THEN** its header, three sections, status labels, and controls remain readable and operable without horizontal page scrolling

#### Scenario: Offline detail sections
- **WHEN** the user switches sections while offline
- **THEN** successfully cached content is readable with offline and refresh-time feedback, unavailable content is identified, and mutation controls are disabled

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

### Requirement: Photo selection during plant creation
The Add Plant interface SHALL offer a labelled optional photo picker for one JPG, PNG, WebP, or HEIC file, show the selected filename, and show a local preview when the browser can render it. Users SHALL be able to replace or remove the selection before saving without losing other form input. Preview failure SHALL NOT prevent submission of a supported file. Selecting a file SHALL NOT create a plant or upload it before submission. An explicit Identify species action SHALL allow sending that photo for identification before plant submission without attaching a catalogue photo. Cancelling before plant submission SHALL discard the local selection without creating a plant or attaching a catalogue photo; any previously requested identification SHALL NOT cause a subsequent catalogue save or upload.

#### Scenario: Preview and replace a selected photo
- **WHEN** the user chooses a browser-previewable photo and then replaces it
- **THEN** the displayed preview and filename reflect the latest selection and existing plant form input is retained

#### Scenario: Remove a selected photo
- **WHEN** the user removes the selection before saving
- **THEN** the preview and filename are cleared and the form can be saved without a photo

#### Scenario: HEIC preview is unavailable
- **WHEN** the user selects a HEIC file that the browser cannot render
- **THEN** filename feedback explains the selection without a broken preview and the supported file remains available to submit

#### Scenario: Cancel an unsaved plant
- **WHEN** the user cancels creation after selecting a photo but before submitting and without requesting identification
- **THEN** no plant or photo is sent to the server and the next new-plant form starts without that selection

#### Scenario: Explicitly identify before saving
- **WHEN** the user activates Identify species for the selected creation photo
- **THEN** only an identification request is made and the form remains open for candidate confirmation and a separate plant save

#### Scenario: Cancel after an identification-only upload
- **WHEN** the user cancels creation after requesting identification but before saving the plant
- **THEN** no plant or catalogue photo is created and the next creation form has no previous selection or candidates

### Requirement: Creation photo progress and recovery
The creation interface SHALL distinguish plant saving from photo uploading and prevent concurrent or repeated submission while either operation is pending. Plant-creation rejection SHALL retain the entered details and selected photo without uploading it. After confirmed creation, photo-upload failure SHALL present an accessible error with Retry photo and Continue without photo actions. The selected file SHALL remain available for retry or replacement. Retrying SHALL reuse the confirmed saved plant. Closing the flow after a confirmed save SHALL preserve that plant. Failed operations SHALL NOT be queued or retried automatically while offline.

#### Scenario: Save and upload progress
- **WHEN** a user saves a new plant with a selected photo
- **THEN** the interface announces the saving and uploading phases and prevents another create or upload submission while either phase is pending

#### Scenario: Plant creation is rejected
- **WHEN** the server rejects plant creation
- **THEN** the form retains its input and photo selection, reports the error, and does not upload the photo

#### Scenario: Recover from a photo failure
- **WHEN** the photo upload fails after the plant was saved
- **THEN** the interface explains the saved-plant state, retains the selection, and allows retry, replacement, or continuation without another upload

#### Scenario: Connection is lost during photo upload
- **WHEN** connectivity is lost after plant creation is confirmed and photo upload cannot be confirmed
- **THEN** the interface reports the upload uncertainty, retains the saved-plant context and selected file in the open flow, and requires an explicit action before another upload attempt

### Requirement: Simplified plant species fields
The add/edit plant form SHALL offer an optional Scientific name input without Common name or Family inputs. Saving edits through this form SHALL preserve any previously saved common name and family. Creating a plant without identification SHALL NOT require either omitted field.

#### Scenario: Create with simplified species input
- **WHEN** a user opens Add Plant
- **THEN** Scientific name is optional, Common name and Family inputs are absent, and the plant can be saved with its required details

#### Scenario: Edit without losing saved species metadata
- **WHEN** a user updates a plant through the simplified edit form
- **THEN** the requested editable details are saved and the plant's existing common name and family are preserved

### Requirement: Scientific name Wikipedia reference
Without a saved manual Wikipedia override, a plant with a nonblank scientific name SHALL resolve a matching Wikipedia article, prefer the German article when found, and fall back to a matching English article only when the German lookup succeeds without finding a matching German article. Resolution SHALL account for normalized scientific names, redirects, and a verified equivalent article under a different title when available. A saved manual override SHALL take precedence without requiring automatic lookup. A reference SHALL display the scientific name as a keyboard-accessible link opening in a new tab, identify Wikipedia and new-tab behavior accessibly in German, and identify an English destination as English. Destinations SHALL use HTTPS on the appropriate German or English Wikipedia host with the title safely URL-encoded. A plant without a scientific name or an override SHALL retain the existing species fallback without a Wikipedia link or lookup. If an override exists without a scientific name, the fallback SHALL remain readable and a separately labelled Wikipedia link SHALL be available. No Wikipedia input SHALL be required to save a plant.

The existing-plant editor SHALL offer an optional Wikipedia-Link field below the scientific name, prefilled with the saved override or an automatically found article when available. Automatic results SHALL remain distinguishable from a deliberate manual replacement: leaving an automatically populated field unchanged SHALL NOT create an override. Automatisch ermitteln, or clearing the field, SHALL reset the draft to automatic lookup for the draft's current scientific name. Saving SHALL commit the chosen mode with other edits; cancellation SHALL preserve the saved reference. Lookup failure SHALL NOT prevent saving valid unrelated plant edits. Late lookup results SHALL NOT replace user-entered URLs, a saved override, or another plant's reference.

If neither article can be matched in automatic mode, the scientific name SHALL remain readable without a link. An offline, timed-out, or failed lookup SHALL be treated as unavailable rather than as proof that a German article does not exist; detail SHALL remain usable, show accessible German feedback, and permit another lookup when connectivity returns or the user retries. Successfully cached manual override data SHALL remain readable offline without implying that the external article is available offline. External lookup responses and articles SHALL NOT be added to the application's offline caches.

#### Scenario: Open a species reference
- **WHEN** a matching German Wikipedia article is found for a plant's scientific name without a saved override
- **THEN** the scientific name links to that German article in a new tab
- **AND** the link is keyboard accessible and describes its Wikipedia destination and new-tab behavior in German

#### Scenario: German title differs from the scientific name
- **WHEN** a verified German article is available through a redirect or an equivalent article's language link under a different title
- **THEN** the automatic reference points to that German article rather than assuming the scientific name is its displayed title

#### Scenario: Fall back to an English article
- **WHEN** the German lookup succeeds without finding a matching article and a matching English article is found in automatic mode
- **THEN** the scientific name links to the English article and the accessible reference identifies it as English

#### Scenario: No matching article
- **WHEN** both automatic lookups complete without finding a matching article
- **THEN** the scientific name is displayed without a Wikipedia link

#### Scenario: Scientific name is absent
- **WHEN** a plant has no nonblank scientific name and no saved override
- **THEN** the existing species fallback is shown without a Wikipedia link or lookup

#### Scenario: Encode a scientific name
- **WHEN** a scientific name or matched article title includes repeated whitespace, Unicode, or URL-reserved characters
- **THEN** the resolved link stays on the intended German or English Wikipedia host and does not allow the input to inject a query or fragment

#### Scenario: Lookup cannot be completed
- **WHEN** the German article lookup times out, fails, or is unavailable offline in automatic mode
- **THEN** the scientific name and plant details remain readable and no unverified English fallback is presented as a confirmed match
- **AND** German feedback communicates that the reference could not be checked and a later retry is possible

#### Scenario: Plant changes during lookup
- **WHEN** a user opens a different plant or changes its scientific name before a reference lookup completes
- **THEN** a late result for the previous name does not appear on the current plant

#### Scenario: Replace and save a reference
- **WHEN** a user replaces Wikipedia-Link with a valid article URL and saves successfully
- **THEN** that URL is the plant's reference after reopening or reloading and automatic lookup does not replace it

#### Scenario: Keep automatic mode while editing other fields
- **WHEN** a user edits a plant without changing its automatically populated Wikipedia-Link
- **THEN** saving preserves automatic mode and later scientific-name changes can resolve a new article

#### Scenario: Reset or cancel a manual override
- **WHEN** a user chooses Automatisch ermitteln or clears an override
- **THEN** the editor returns to automatic mode for its current scientific name
- **AND** only a successful save removes the stored override; cancelling preserves it

#### Scenario: Lookup finishes after manual typing
- **WHEN** an automatic lookup completes after the user has entered a replacement URL
- **THEN** the manually entered draft remains unchanged

#### Scenario: Override without a scientific name
- **WHEN** a plant has a saved override and no scientific name
- **THEN** the identity header retains its species fallback and provides a separately labelled Wikipedia link without automatic lookup

### Requirement: Dedicated login page
Signed-out OIDC visitors SHALL see a standalone branded `/login` page with a clear identity-provider sign-in action instead of collection navigation, empty collection content, or editing controls. Collection requests SHALL wait until authentication is confirmed. The page SHALL work at 320 CSS pixels and support keyboard operation and touch targets of at least 44 CSS pixels. Sign-in SHALL use the existing server authentication route.

#### Scenario: Signed-out collection visit
- **WHEN** a signed-out OIDC visitor opens a collection destination or plant detail
- **THEN** the application replaces the URL with `/login`, displays the login page, and does not request protected collection data

#### Scenario: Start provider sign-in
- **WHEN** an online visitor activates the login action
- **THEN** the browser navigates to the server login route and follows the provider redirect

#### Scenario: Login is unnecessary
- **WHEN** an authenticated visitor or an open-access deployment visitor opens `/login`
- **THEN** the application replaces the URL with `/` and displays the collection

#### Scenario: Session expires
- **WHEN** the application learns that collection access has been denied
- **THEN** it closes collection editing, clears visible collection content, and displays `/login`

#### Scenario: Offline and unavailable bootstrap
- **WHEN** the visitor is signed out offline or bootstrap cannot be loaded
- **THEN** the page provides accessible connection or error feedback, offers retry for a failed bootstrap, and does not offer an active offline sign-in action

#### Scenario: Authenticated offline collection
- **WHEN** a previously authenticated visitor opens cached collection content offline
- **THEN** the existing offline collection experience remains available

### Requirement: Shared identification review controls
Add Plant SHALL retain its explicit Identify species action for the selected creation photo. Existing plant detail SHALL start identification directly when the user activates Identify this photo on a saved gallery image, without a second start action. Existing plant detail SHALL NOT display Choose identification photo, an identification-only file picker, or a standalone Identify species button. Both flows SHALL provide a consistent review of ranked scientific names, available common names, and confidence scores. Merely opening plant detail, rendering a gallery, or uploading a photo SHALL NOT start identification. Confirmation SHALL require a current candidate selection. Identification progress and species-save progress SHALL be announced accessibly and SHALL prevent duplicate submissions and conflicting save actions. The interface SHALL explain unavailable configuration, no match, invalid input, timeout, quota exhaustion, rejected credentials, rejected provider requests, and connectivity failure while retaining recoverable input. Identification SHALL be visibly unavailable without a configured integration or while offline, with manual species entry remaining available online. No failed request SHALL be queued or automatically retried. Controls SHALL support keyboard use and fit a 320 CSS-pixel viewport.

#### Scenario: No photo selected during creation
- **WHEN** a user opens Add Plant without selecting a photograph
- **THEN** Identify species is unavailable until a source is selected and manual plant creation remains available

#### Scenario: Review and confirm
- **WHEN** candidates are displayed in either flow
- **THEN** the user sees ranked names and confidence scores and Confirm species remains disabled until a current candidate is selected

#### Scenario: Identification is unavailable
- **WHEN** no PlantNet key is configured or the app is offline
- **THEN** the identification controls explain why they are unavailable and do not submit a request

#### Scenario: Failure and explicit retry
- **WHEN** an identification attempt fails
- **THEN** an accessible failure message is shown, input remains recoverable, and another identification requires an explicit user action

#### Scenario: Prevent concurrent actions
- **WHEN** identification or candidate saving is pending
- **THEN** duplicate identification, duplicate confirmation, and conflicting plant submission are prevented until the operation settles

#### Scenario: Keyboard and mobile review
- **WHEN** a user reviews suggestions with a keyboard or at a 320 CSS-pixel viewport
- **THEN** source selection, candidate selection, confirmation, cancellation, and feedback remain accessible without horizontal page scrolling

#### Scenario: Identify a gallery image directly
- **WHEN** a user activates Identify this photo on a saved gallery image
- **THEN** one identification attempt starts for that image without requiring Identify species
- **AND** progress and results are associated visibly with the selected image and review is reachable by keyboard
- **AND** saved species information changes only after candidate selection and confirmation

#### Scenario: Existing detail has no redundant identification controls
- **WHEN** a user opens existing plant detail with or without gallery photos
- **THEN** Choose identification photo, the identification-only file picker, and the standalone Identify species action are absent
- **AND** Add photo remains available online and no identification starts without a gallery action

#### Scenario: Retry the same gallery image
- **WHEN** an attempt has failed or its results were cancelled and the user activates Identify this photo on the same image again
- **THEN** a new explicit attempt starts and previous unconfirmed results cannot be applied

### Requirement: Optional care start input
The add/edit plant form SHALL allow a blank care start date while retaining valid care intervals. New-plant forms SHALL default this date to blank and explain that schedules start when actual watering or fertilizing is recorded unless an optional fallback date is supplied. Editing SHALL show the saved value and allow clearing it without deleting activities. Creation recovery and plant detail SHALL represent absent care dates without displaying an invalid or fabricated date.

#### Scenario: Add a plant before doing care
- **WHEN** the user supplies a plant name and valid intervals and leaves Care started blank
- **THEN** the plant saves successfully without any completed care or dated reminders being invented

#### Scenario: Edit an existing fallback date
- **WHEN** the user edits a plant with a saved care start date
- **THEN** the saved date is shown and can be retained, changed, or cleared

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

### Requirement: Simple new-note entry
The plant-detail new-note form SHALL provide note text and a save action without a Written at field or other date/time input. Submitting SHALL use the current server time rather than when the form was opened. Failed submissions SHALL retain note text and remain explicitly retryable; offline submissions SHALL remain disabled. Existing note correction SHALL retain its activity date/time editing controls.

#### Scenario: Save a note after leaving the form open
- **WHEN** a user writes and saves a new note after the plant page has been open for some time
- **THEN** the note receives the current save time and no new-note timestamp input is displayed

#### Scenario: Failed note save
- **WHEN** a new note cannot be saved
- **THEN** its text remains available and no successful note is fabricated

### Requirement: Grouped existing-plant editor
Bearbeiten SHALL open a full-screen editor on phones and an equivalent centred, scrollable dialog on desktop. Pflanzendetails SHALL group name, optional scientific name, optional Wikipedia-Link, optional room, and persistent plant notes; Pflegeplan SHALL group watering interval, independent summer/winter fertilizing intervals and pause controls, and optional care start date. Ändern on the plan and the plant-notes edit action SHALL open the relevant group of the same editor. Common-name and family inputs SHALL remain absent and existing values SHALL be preserved. Abbrechen and Änderungen speichern SHALL apply to the complete draft. Saving SHALL prevent duplicate submission, retain recoverable input on error, and close only after server confirmation. Keyboard focus SHALL be managed on opening and closing, and the editor SHALL fit 320 CSS pixels with labelled controls and 44px touch targets. Editing SHALL remain unavailable offline.

#### Scenario: Edit details and plan together
- **WHEN** a user changes the room, notes, Wikipedia reference, or care settings and saves
- **THEN** one confirmed plant update commits the draft and refreshes affected detail, collection, and care views

#### Scenario: Cancel plant edits
- **WHEN** a user changes any fields and cancels before submission
- **THEN** no plant change is sent and the saved details and care settings remain unchanged

#### Scenario: Validation or save failure
- **WHEN** validation or a plant save fails
- **THEN** the editor remains open with the draft and an actionable German error, and no unconfirmed success is displayed

#### Scenario: Keyboard editing
- **WHEN** a keyboard user opens, traverses, and closes the editor
- **THEN** focus remains usable within the editor and returns to its launcher on closing

### Requirement: On-demand care entry from plant detail
Gießen eintragen and Düngen eintragen SHALL open a care-entry form on demand, presented as a phone bottom sheet or desktop dialog. The form SHALL identify the plant and activity, allow a chosen date/time defaulting to now in the deployment timezone, and accept an optional note attached to that care activity. Abbrechen SHALL leave history and care anchors unchanged. Saving SHALL prevent duplicate submissions and show success only after server confirmation. Confirmed saves SHALL refresh affected reminders, history, and calendar data; a next date SHALL be shown only when the confirmed schedule provides one. Failed saves SHALL preserve date/time and note for explicit retry and SHALL NOT queue automatic retries. Both actions SHALL remain available online independently of reminder eligibility.

#### Scenario: Backdate care with a note
- **WHEN** a user changes the completion date/time, enters an optional note, and successfully saves
- **THEN** one care activity with that timestamp and note is recorded and the schedule follows the existing completion-based rules

#### Scenario: Cancel care entry
- **WHEN** a user opens care entry and cancels
- **THEN** no activity is created and no care deadline changes

#### Scenario: Save succeeds but a refresh fails
- **WHEN** care creation is confirmed but a follow-up read fails
- **THEN** the interface distinguishes the confirmed save from unavailable refreshed data and does not resubmit the activity or invent a next date

#### Scenario: Care save fails
- **WHEN** saving care fails or connectivity is lost before confirmation
- **THEN** the entered date/time and note remain recoverable with an accessible error and no completed care is fabricated

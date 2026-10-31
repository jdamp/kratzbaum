## MODIFIED Requirements

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

## ADDED Requirements

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

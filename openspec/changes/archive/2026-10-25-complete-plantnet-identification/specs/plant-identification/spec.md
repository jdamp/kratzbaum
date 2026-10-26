## ADDED Requirements

### Requirement: Identify before plant creation
The system SHALL allow an explicit identification request for one selected photograph without requiring a saved plant. Identification and candidate confirmation SHALL NOT create a plant, catalogue photograph, cover, or photo activity. A confirmed candidate SHALL be applied only to the local draft until the user saves the plant. Cancelling creation SHALL discard the draft without creating catalogue records. Saving the draft and attaching its optional photo SHALL remain independent of identification success.

#### Scenario: Identify an unsaved plant
- **WHEN** a user selects a photograph in Add Plant and explicitly requests identification
- **THEN** ranked candidates are returned without creating a plant or attaching a catalogue photo

#### Scenario: Confirm a draft candidate and save
- **WHEN** a user confirms a candidate in Add Plant
- **THEN** its species information fills the draft without saving the plant
- **AND** a later successful Add plant action persists the confirmed or subsequently edited draft information

#### Scenario: Cancel after identification
- **WHEN** a user identifies a selected photo and then cancels Add Plant
- **THEN** no plant, catalogue photo, cover, or photo activity is created

#### Scenario: Identification fails during creation
- **WHEN** identification fails or produces no usable candidate
- **THEN** entered details and the selected photo remain available and the user can save with manually entered or absent species information

### Requirement: Identify from an existing gallery photo
The system SHALL allow a user to explicitly identify an existing plant using one of its saved photographs or a newly selected supported file. A saved-photo request SHALL verify that the photograph belongs to the target plant and use its stored full image. Identification alone SHALL NOT add a photograph, change the cover, create a photo activity, or change saved species information. Missing photographs, mismatched plant/photo references, and unreadable stored images SHALL fail before an upstream request.

#### Scenario: Use a saved photograph
- **WHEN** a user requests identification from a photograph in a plant's gallery
- **THEN** the stored image is used to return ranked candidates without requiring the user to select the file again or adding another catalogue photo

#### Scenario: Invalid saved-photo reference
- **WHEN** an identification request names a missing photo, a photo belonging to a different plant, or an unreadable stored image
- **THEN** the request fails with a useful error and no PlantNet request occurs

#### Scenario: Identify from a fresh file
- **WHEN** a user identifies an existing plant from a newly selected supported file
- **THEN** ranked candidates are returned without automatically attaching that file to the gallery

## MODIFIED Requirements

### Requirement: Confirm candidate species
The system SHALL present ranked candidate species with confidence scores for new and existing plants. It SHALL apply candidate species information only after the user selects and explicitly confirms a candidate. Confirmation for a new plant SHALL update only its draft; confirmation for an existing plant SHALL save species information and report success only after server confirmation. The system SHALL preserve existing species information if the user cancels or no usable candidate is returned. Candidate confirmation SHALL preserve unrelated plant details and care settings and SHALL NOT generate care advice. Changing the identification source, opening a different plant, or starting a new attempt SHALL clear unconfirmed candidate selection and prevent obsolete responses from being confirmed.

#### Scenario: Accept a suggestion
- **WHEN** a user selects and confirms a returned candidate
- **THEN** the selected species information is available to save on the plant without generating care advice

#### Scenario: Cancel identification
- **WHEN** a user closes the results without confirming a candidate
- **THEN** the existing species information and other plant form input remain unchanged

#### Scenario: Confirm an existing plant candidate
- **WHEN** a user confirms a candidate for a saved plant and the save succeeds
- **THEN** its species information is updated while its name, notes, care settings, cover, and photographs are preserved

#### Scenario: Species save fails
- **WHEN** saving a confirmed candidate for an existing plant fails
- **THEN** the interface reports that the save was not confirmed, retains the candidate for an explicit save retry, and does not repeat identification

#### Scenario: Source changes before confirmation
- **WHEN** the user replaces or removes the source photo or opens another plant before confirming a result
- **THEN** the previous unconfirmed candidates cannot be applied and any late result from the previous source is ignored

#### Scenario: A new attempt replaces previous results
- **WHEN** the user explicitly starts a new identification attempt
- **THEN** previous results and selection are cleared before new results become confirmable

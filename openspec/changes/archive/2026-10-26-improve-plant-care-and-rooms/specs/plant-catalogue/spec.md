## MODIFIED Requirements

### Requirement: Browse and search the catalogue
The system SHALL display plant names, species information when present, representative photos when present, and care-status information. Users SHALL be able to search by plant name or saved species name and combine search with All rooms, a specific room, or Unassigned. Plant cards and detail SHALL identify an assigned room when present. A filtered empty result SHALL be distinguishable from an empty collection.

#### Scenario: Find a saved plant
- **WHEN** a user searches for text appearing in a saved plant's name or species
- **THEN** the catalogue displays matching plants and an explicit empty state if none match

#### Scenario: Search within a room
- **WHEN** the user selects Wohnzimmer and searches for a saved plant name or species
- **THEN** only plants in Wohnzimmer matching that search are displayed

#### Scenario: Empty room result
- **WHEN** the collection has plants but the selected room and search match none
- **THEN** the interface explains that no plants match the selection and allows changing or clearing the filters

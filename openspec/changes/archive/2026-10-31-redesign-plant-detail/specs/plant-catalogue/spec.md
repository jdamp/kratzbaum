## ADDED Requirements

### Requirement: Optional saved Wikipedia reference override
Each plant SHALL support an optional saved Wikipedia article URL override shared with the collection. Existing plants and new plants without a supplied override SHALL use automatic reference lookup. Plant reads SHALL expose the saved override or an empty value. A valid explicit override on plant save SHALL be persisted; an explicit empty string SHALL clear it; an omitted field on an existing-plant update SHALL preserve the stored value. Changing other plant fields, confirming species identification, or changing room, photos, or cover SHALL NOT implicitly clear or rewrite an override. Saving or clearing an override SHALL NOT create activities or change care settings or anchors. A scientific name SHALL NOT be required to store an override.

#### Scenario: Upgrade and default behavior
- **WHEN** an existing collection is upgraded or a plant is created without an override
- **THEN** it remains in automatic mode and existing plant data, photographs, and history are preserved

#### Scenario: Persist across reads and clients
- **WHEN** a valid override is saved and the plant is later read or opened by another authorized collection user
- **THEN** the saved override is returned and used as its Wikipedia destination

#### Scenario: Clear an override explicitly
- **WHEN** a successful update supplies an empty string for the override
- **THEN** the saved override is removed and reference selection returns to automatic mode

#### Scenario: Older or unrelated update omits the field
- **WHEN** an existing-plant update omits the override field, including a room-only or species-confirmation update
- **THEN** the saved override is preserved

#### Scenario: Preserve override through species and photo changes
- **WHEN** a plant with an override has its scientific name, room, photographs, or cover changed without an explicit override change
- **THEN** its saved override remains intact and no additional activity or care-anchor change is caused by the reference

### Requirement: Validate manual Wikipedia destinations
The system SHALL validate explicit nonempty Wikipedia overrides before saving. Only absolute HTTPS article URLs on the German or English Wikipedia host SHALL be accepted, with a nonempty `/wiki/` title. Equivalent German/English mobile-host links SHALL be normalized to the corresponding desktop host. Surrounding whitespace SHALL be trimmed. URLs containing credentials, nonstandard ports, query parameters, unsupported schemes, misleading or unrelated hosts, or nonarticle paths SHALL be rejected with an actionable German validation error. Valid article section fragments SHALL be preserved safely. Invalid input SHALL NOT change any saved plant fields. Validation SHALL NOT require a live third-party request or treat syntactic validation as proof that an article exists or matches the species.

#### Scenario: Accept and normalize an article URL
- **WHEN** a user saves a valid supported Wikipedia article URL, including a mobile-host URL
- **THEN** the normalized HTTPS desktop-host destination is saved with its title and optional section fragment intact

#### Scenario: Reject an invalid destination
- **WHEN** a save contains an external host, HTTP or executable scheme, credentials, a query, nonstandard port, or a missing article title
- **THEN** the save fails with a German validation error and the previously saved plant remains unchanged

#### Scenario: Preserve a user choice without external verification
- **WHEN** a syntactically valid manual article URL is saved while automatic lookup is unavailable
- **THEN** the plant save can succeed without contacting Wikipedia and does not claim the article was verified

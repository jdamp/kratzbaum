## ADDED Requirements

### Requirement: Scientific name Wikipedia reference
When a plant has a nonblank scientific name, plant detail SHALL display that name as a keyboard-accessible link to the corresponding English Wikipedia title, opening in a new tab. The link SHALL identify Wikipedia and the new-tab behavior accessibly. The destination SHALL be generated from the trimmed scientific name with whitespace converted to underscores and the title safely URL-encoded. Plants without a scientific name SHALL retain the existing species fallback without a Wikipedia link. No additional reference form input or automatic Wikipedia network lookup SHALL be required.

#### Scenario: Open a species reference
- **WHEN** a user opens a plant with scientific name Monstera deliciosa
- **THEN** its scientific name links to the Monstera_deliciosa title on English Wikipedia in a new tab

#### Scenario: Scientific name is absent
- **WHEN** a plant has no nonblank scientific name
- **THEN** the existing species fallback is shown without a Wikipedia link

#### Scenario: Encode a scientific name
- **WHEN** a scientific name includes repeated whitespace, Unicode, or URL-reserved characters
- **THEN** the link remains on English Wikipedia and represents the complete normalized title without injecting a query or fragment

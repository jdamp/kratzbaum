## ADDED Requirements

### Requirement: Simplified plant species fields
The add/edit plant form SHALL offer an optional Scientific name input without Common name or Family inputs. Saving edits through this form SHALL preserve any previously saved common name and family. Creating a plant without identification SHALL NOT require either omitted field.

#### Scenario: Create with simplified species input
- **WHEN** a user opens Add Plant
- **THEN** Scientific name is optional, Common name and Family inputs are absent, and the plant can be saved with its required details

#### Scenario: Edit without losing saved species metadata
- **WHEN** a user updates a plant through the simplified edit form
- **THEN** the requested editable details are saved and the plant's existing common name and family are preserved

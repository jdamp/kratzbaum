## Why

Common name and family add fields the user does not need when creating or editing plants. Simplifying the form keeps plant naming, scientific name, photos, and care details easy to enter.

## What Changes

- Remove Common name and Family inputs from the add/edit plant dialog.
- Retain the optional Scientific name input at full form width.
- Preserve existing common-name and family values when saving edits; new manual entries use empty values for those metadata fields.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-frontend`: Specify the simplified plant form and preservation of metadata omitted from it.

## Impact

Affects `web/src/PlantDialog.tsx`, browser regression coverage, and regenerated embedded assets. Existing API, database, identification, and saved species metadata remain compatible.

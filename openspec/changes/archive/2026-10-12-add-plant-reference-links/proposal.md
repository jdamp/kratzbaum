## Why

A scientific name is more useful when it can open a species article. Automatically linking it to Wikipedia provides a reference without adding another form field.

## What Changes

- Make a saved scientific name on plant detail an automatic link to its corresponding English Wikipedia title.
- Open the reference in a separate tab and identify the destination accessibly.
- Keep plants without scientific names unchanged, with no reference link or extra form input.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-frontend`: Automatically link scientific names to Wikipedia in plant detail.

## Impact

Frontend detail rendering and a small URL helper, meaningful URL/browser checks, regenerated embedded assets, and the Penpot reference. No API, database, dependency, or Wikipedia lookup is needed.

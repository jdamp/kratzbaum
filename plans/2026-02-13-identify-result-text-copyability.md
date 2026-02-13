# Implementation Plan: Identify Result Text Copyability (Issue #13)

## Goal
Allow users to reliably select and copy species text from identify results on `/plants/new` without unintentionally selecting a species.

## Scope
- In scope:
  - Update feature spec acceptance criteria for copyable identify text.
  - Refactor identify result row interaction in the new plant form.
  - Validate frontend checks still pass.
- Out of scope:
  - Changes to identify backend API behavior.
  - Changes to identify ranking/scoring logic.

## Current State (2026-02-13)
- Identify results are rendered as row-wide `<button>` elements in `frontend/src/routes/plants/new/+page.svelte`.
- Drag-selecting text inside those buttons can trigger click selection behavior.

## Target Behavior
1. Scientific/common name text in identify results is selectable and copyable.
2. Species selection remains available through an explicit action.
3. Existing identify flow and species field population remain unchanged.

## Implementation Steps
1. Update `docs/01_features/F04_plant_recognition.md`:
- Add acceptance criterion for copyable identify suggestion text in US-02.

2. Update `frontend/src/routes/plants/new/+page.svelte`:
- Replace row-wide `button` wrappers with non-button containers.
- Keep result text in normal text elements with `select-text` behavior.
- Add explicit per-row `Use` button to trigger `selectSpecies(result)`.
- Preserve current score display and visual hierarchy.

3. Validation:
- Run `cd frontend && npm run check`.
- Optionally run `cd frontend && npm run build` if needed for extra confidence.

## Risks and Mitigations
1. Risk: reduced discoverability of how to choose a species.
- Mitigation: explicit per-row action button labeled `Use`.

2. Risk: frontend accessibility regressions.
- Mitigation: keep interactive behavior on semantic `button` elements only.

## Delivery
1. Specs updated.
2. UI behavior fixed for text copyability.
3. Frontend checks verified.

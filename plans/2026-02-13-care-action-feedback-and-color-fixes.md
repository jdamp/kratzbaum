# Implementation Plan: Care Action Feedback and Color Fixes

## Goal
Fix two frontend UX issues:
1. Plant list quick actions (`Water`, `Fertilize`) must provide clear visual feedback when clicked.
2. Plant detail quick actions (`Fertilize`, `Repot`) must use explicit semantic colors instead of grey/neutral appearance.

## Scope
- In scope:
  - `frontend/src/lib/components/PlantCard.svelte`
  - `frontend/src/routes/plants/[id]/+page.svelte`
  - Supporting style/constants updates if needed in shared frontend styles
  - Manual verification and frontend checks
- Out of scope:
  - Backend API contract changes
  - New care-event endpoint behavior

## Current State (2026-02-13)
- `PlantCard.svelte` triggers care-event calls but has no pending/success/error button state.
- Plant-detail page uses `variant-soft` for both `Fertilize` and `Repot`, which renders as neutral grey.
- Water action on plant-detail already has a stronger variant (`variant-filled-primary`).

## Behavioral Requirements
1. Clicking `Water` or `Fertilize` on a plant card shows immediate press feedback.
2. While request is in progress, the clicked button is visibly disabled.
3. On success, the clicked button briefly shows success feedback, then returns to normal.
4. On error, the clicked button resets and the user sees an error indication.
5. On plant detail, `Fertilize` and `Repot` buttons are visually distinct and color-coded:
  - Fertilize: amber semantic treatment
  - Repot: green semantic treatment

## Proposed UX
1. Plant list card feedback
- Add per-button local state (`idle | pending | success | error`) in `PlantCard.svelte`.
- Pending:
  - disable clicked button
  - adjust opacity/cursor
  - optional spinner replacement for icon
- Success:
  - temporary success tint/icon for ~800ms
  - return to default state automatically
- Error:
  - brief error tint and message (`title` or inline text), then reset

2. Plant detail action colors
- Keep button sizing/layout unchanged.
- Apply explicit semantic styling:
  - `Fertilize`: amber icon and/or amber button text/border treatment
  - `Repot`: green icon and/or green button text/border treatment
- Ensure styles remain accessible (sufficient contrast on light backgrounds).

## Technical Plan
1. `frontend/src/lib/components/PlantCard.svelte`
- Add action state variables for water/fertilize.
- Refactor handlers to set/reset state around async `recordCareEvent` calls.
- Update button classes and attributes (`disabled`, `aria-busy`) based on state.
- Add transient success/error rendering (icon swap or class change).

2. `frontend/src/routes/plants/[id]/+page.svelte`
- Update `Fertilize` and `Repot` button classes to non-neutral semantic styling.
- Keep existing click handlers/modal behavior unchanged.

3. Shared styling (only if needed)
- If ad-hoc classes become repetitive, add reusable utility classes in `frontend/src/routes/layout.css` for care-action semantic variants.

## Validation Plan
1. Automated checks
- `cd frontend && npm run check`
- `cd frontend && npm run build`

2. Manual scenarios
- Plants list:
  - Click `Water` and verify pending then success feedback.
  - Click `Fertilize` and verify pending then success feedback.
  - Simulate API failure path and verify visible error feedback.
- Plant detail:
  - Confirm `Fertilize` is visually amber-coded.
  - Confirm `Repot` is visually green-coded.
  - Confirm both still open the expected care-event modal.

## Risks and Mitigations
1. Risk: transient state flicker with rapid repeated clicks.
- Mitigation: disable button during pending and guard duplicate submits.
2. Risk: inconsistent color use across pages.
- Mitigation: centralize semantic classes if multiple files need the same styles.
3. Risk: low contrast for custom semantic styles.
- Mitigation: verify contrast against current surface tokens and adjust shades.

## Delivery Breakdown
1. Implement list quick-action feedback states.
2. Implement detail quick-action color fixes.
3. Run frontend checks and manual validation.
4. Update docs/screenshots if UI visuals materially differ.

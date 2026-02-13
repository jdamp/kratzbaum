# Implementation Plan: Link Assigned Pot from Plant Detail

## Goal
Enable users to open the assigned pot detail page directly from a plant detail page by clicking the displayed pot name.

## Scope
- In scope:
  - Plant detail UI on `frontend/src/routes/plants/[id]/+page.svelte`
  - Link behavior and fallback text for assigned pot display
  - Frontend validation checks
- Out of scope:
  - Backend API changes
  - Pot list/detail redesign

## Current State (2026-02-13)
- Plant detail currently loads pot metadata with `potService.getPot(plantData.pot_id)` and stores only the pot name in local state.
- Assigned pot is rendered as static text (`Pot: {potName || 'Assigned'}`) and is not navigable.
- Pot detail already links back to assigned plant (`/plants/{pot.plant_id}`), so navigation is currently one-way.

## Behavioral Requirements
1. When a plant has an assigned pot (`plant.pot_id`), the pot display on the plant page is clickable.
2. Clicking the pot name routes to `/pots/{pot_id}`.
3. If pot name lookup fails, the UI still provides a clickable fallback label (for example, `View assigned pot`).
4. If no pot is assigned, no pot-link block is shown.

## Proposed UX
1. Keep the existing “Pot:” metadata row on plant detail.
2. Render the value as a text link styled consistently with existing primary links (`text-primary-600`, `hover:underline`).
3. Preserve concise fallback copy when pot lookup fails without blocking navigation.

## Technical Plan
1. Update plant detail markup in `frontend/src/routes/plants/[id]/+page.svelte`:
  - Replace plain pot text with an anchor pointing to `/pots/{plant.pot_id}`.
  - Use the resolved pot name when available, otherwise use fallback link text.
2. Keep existing `loadPlant` lookup flow and error handling:
  - Continue setting `potName = null` before each reload.
  - Preserve `try/catch` around `potService.getPot(...)` to avoid blocking page render.
3. Ensure no regressions in edit and refresh flows:
  - After save/care/photo actions that call `loadPlant`, pot link remains correct.

## Validation Plan
1. Automated checks
  - `cd frontend && npm run check`
  - `cd frontend && npm run build`
2. Manual scenarios
  - Plant with assigned pot shows clickable pot name and routes to correct pot detail.
  - Assigned pot where pot-name lookup fails still renders a clickable fallback label.
  - Plant without assigned pot does not show a pot link.

## Delivery Breakdown
1. Implement pot-link rendering on plant detail.
2. Verify fallback behavior and navigation target correctness.
3. Run frontend checks and record results.

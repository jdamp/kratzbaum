# Implementation Plan: Assign Existing Plant to Existing Pot (Frontend)

## Goal
Enable users to assign or reassign an already existing plant to an already existing pot from the frontend, and to clear an existing assignment.

## Scope
- In scope:
  - Pot detail assignment flow (`/pots/[id]`)
  - Pot create/edit assignment selector (`/pots/new` and edit mode)
  - Plant edit assignment parity (`/plants/[id]` edit modal)
  - Frontend state, API usage, and UX for warnings/errors
- Out of scope:
  - New backend endpoints
  - Multi-user concurrency controls

## Current State (2026-02-13)
- Backend supports assignment through `PUT /api/plants/{id}` by setting `pot_id`.
- Frontend supports pot assignment only when creating a new plant (`/plants/new`).
- Frontend does not support assigning existing plants and existing pots from pot views or plant edit.
- Pot API does not directly assign plants; assignment is plant-driven (`plant.pot_id`).

## Behavioral Requirements
1. User can assign an existing plant to the current pot.
2. User can unassign the current plant from the current pot (set to “No plant assigned”).
3. User sees a warning before reassignment when either condition is true:
   - Current pot is already assigned to another plant.
   - Selected plant is already assigned to a different pot.
4. Save operation keeps one displayed owner per pot in UI by explicitly unassigning previous owner before assigning new one.
5. UI refreshes after save and reflects updated plant/pot linkage immediately.

## Proposed UX
1. Pot Detail (`frontend/src/routes/pots/[id]/+page.svelte`)
- Add an “Assign/Reassign Plant” action.
- Show inline assignment form:
  - Select: existing plants + “No plant assigned”.
  - Save + Cancel actions.
- If selected plant currently has a different pot, show a confirmation message before save.
- If current pot already has a different plant and user selects another plant, show confirmation.

2. New/Edit Pot (`frontend/src/routes/pots/new/+page.svelte`)
- Add optional “Assign to Plant” selector in the form.
- Create mode:
  - Create pot first, then apply assignment via `PUT /api/plants/{id}`.
- Edit mode:
  - Preselect current assigned plant.
  - On submit, update pot fields first, then apply assignment diff.

3. Plant Edit Modal (`frontend/src/routes/plants/[id]/+page.svelte`)
- Add pot selector using available pots + currently assigned pot.
- Allow clearing assignment.
- Persist via `plantService.updatePlant(plant.id, { pot_id })`.

## Technical Plan
1. API/client typings
- Update `frontend/src/lib/api/types.ts`:
  - Add explicit `PlantUpdate` type with `name`, `species`, `pot_id`.
- Update `frontend/src/lib/api/plants.ts`:
  - Type `updatePlant` with `PlantUpdate` instead of `any`.

2. Shared assignment helper (frontend)
- Add helper module (for reuse in pot detail + pot form), e.g.:
  - `frontend/src/lib/services/pot-assignment.ts`
- Implement utility methods:
  - `assignPlantToPot({ selectedPlantId, potId, currentPotPlantId })`
  - `clearPotAssignment({ currentPotPlantId })`
- Use sequence:
  1. If replacing current pot owner, unassign old owner (`pot_id: null`).
  2. If selected plant exists, assign selected plant (`pot_id: potId`).

3. Pot detail UI
- Add plants loading state (`plantService.getPlants()`).
- Build selector options from existing plants.
- Add warning and confirmation flow before submit.
- Refresh pot detail after assignment.

4. Pot create/edit UI
- Load plants list and current assignment when editing.
- Track original selected plant to compute diffs.
- On save, perform assignment helper logic after pot create/update success.

5. Plant edit modal parity
- Load available pots and current pot.
- Include selected pot in update payload.
- Refresh plant data after save.

## Edge Cases
1. Selected plant no longer exists (stale UI): show error toast/alert and reload lists.
2. Pot deleted during assignment: show error and return to pot list.
3. Network failure after unassign but before assign:
- Show explicit partial-update error.
- Reload pot + plant lists so UI state is truthful.
4. User selects the already assigned plant: no-op assignment call.

## Validation Plan
1. Automated checks
- `cd frontend && npm run check`
- `cd frontend && npm run build`

2. Manual scenarios
- Assign free plant to free pot.
- Reassign pot from Plant A to Plant B (confirm dialog path).
- Assign Plant C that already has Pot X to Pot Y (confirm dialog path).
- Clear assignment from an assigned pot.
- Cancel assignment without saving.
- API error path displays user-visible error and preserves page usability.

## Follow-up (Backend Hardening)
To fully enforce one-to-one constraints beyond UI behavior, add backend validation in `backend/app/api/plants.py` to prevent duplicate `pot_id` ownership (or support explicit forced reassignment in API).

## Delivery Breakdown
1. Frontend types + service typing cleanup.
2. Shared assignment helper.
3. Pot detail assignment UI.
4. Pot create/edit assignment UI.
5. Plant edit modal pot assignment.
6. Validation and documentation sync.

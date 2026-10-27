## Why

An idle disabled Add room button displays a waiting cursor, which can make the room workflow appear stuck even when no request is running. Existing room assignment is buried inside the full plant editor, making it difficult to find how to assign or move an established plant.

## What Changes

- Distinguish idle disabled room controls from genuinely pending saves; keep consecutive room creation and failure recovery working.
- Shorten the room-save confirmation to `Room “<name>” saved.` exactly.
- Put a labelled room selector and explicit save action beside the room information on plant detail, supporting assignment, movement, and Unassigned without opening the full editor.
- Preserve the existing room selector in Add/Edit Plant, care settings, photographs, and activity history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plant-rooms`: Specify concise save confirmation and a directly discoverable existing-plant assignment workflow.
- `mobile-frontend`: Distinguish disabled and pending room-control feedback, including pointer behavior.

## Impact

Frontend room controls, primary-button styling, plant-detail rendering and state updates, browser regressions, README, and rebuilt embedded assets. Reuse existing plant-update and room APIs; no schema migration or dependency additions are expected. The user confirmed that the reported button symptom is a loading wheel when hovering over the greyed-out button, matching the reproduced waiting-cursor defect.

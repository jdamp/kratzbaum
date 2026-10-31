## Why

The German localization introduced overflowing text at narrow phone widths in the CI browser container, breaking the settings screen, plant creation dialog, and navigation. Existing specifications already require these screens and controls to fit at 320 CSS pixels.

## What Changes

- Correct the affected responsive layouts for German text and realistic font metrics.
- Preserve accessible touch targets, plant creation, identification, and navigation behavior.
- Preserve the selected care-history filter and saving feedback when an activity save is in flight.
- Verify the failing scenarios and the full browser suite using the same container target as CI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change restores existing mobile and localization requirements, so no specification change is needed.

## Impact

Responsive frontend styling and care-entry state, browser regression coverage, generated frontend assets, and the CI browser-test container.

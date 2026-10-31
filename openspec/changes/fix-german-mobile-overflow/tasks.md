## 1. Restore narrow-screen layouts

- [x] 1.1 Correct settings, plant creation and identification, and navigation layouts at 320 CSS pixels without weakening existing assertions or touch targets; verify the failed scenarios under CI-like font metrics.
- [x] 1.2 Preserve the selected care-history filter and saving feedback when a pending activity save refreshes the same plant, and reproduce both races with a controlled browser test.
- [x] 1.3 Run the complete browser-test container used by CI, validate the maintenance change, and record the results.

## Planning decisions

Specs are skipped because existing requirements already cover German text, usable 320-pixel layouts, and care entry. Design is omitted for these focused frontend corrections.

## Validation results

- The original CI container reproduced all four narrow-screen failures; the corrected container passed all 56 browser tests.
- The controlled duplicate-save and filter-refresh race passed, and opening a plant from the collection still resets its history filter.
- Frontend unit tests (21), typecheck, frontend build, Go tests, and strict OpenSpec validation passed.

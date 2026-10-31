## 1. Restore CI coverage

- [x] 1.1 Replace the three stale Choose identification photo locators in the plant-room test with Identify this photo and verify the targeted room-assignment test passes with enabled, pending-disabled, and restored-enabled assertions intact.
- [x] 1.2 Run the complete Playwright suite used by the container CI job and verify all tests pass; record results and validate the OpenSpec maintenance change.

## Planning decisions

Specs are skipped because product requirements are unchanged. Design is conditionally skipped: this is a selector correction in one existing test with no architecture, migration, dependency, or ambiguous implementation decision.

## Validation results

- Targeted room-assignment test: 1 passed.
- Full CI Playwright suite: 51 passed (27.2s) against a fresh, healthy local server built from current source, using PLAYWRIGHT_BROWSERS_PATH=/home/paseo/.cache/ms-playwright and KRATZBAUM_BASE_URL=http://127.0.0.1:18086.
- OpenSpec strict validation and git diff --check passed.
- Earlier local full-suite startup failures were resolved by starting the rebuilt server with a separate database and checking /healthz before running tests.

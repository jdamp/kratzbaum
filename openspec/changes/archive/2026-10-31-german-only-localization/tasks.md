## 1. German application presentation

- [x] 1.1 Translate the app shell, navigation, login, settings, offline/update prompts, document metadata, and PWA manifest into German; verify these surfaces render in German even with an English browser locale and expose no language switcher.
- [x] 1.2 Translate catalogue, plant creation/detail, gallery, room management, care, calendar, and identification interfaces, including accessible names, help, confirmation, loading, empty, and success states; verify representative keyboard and 320 CSS-pixel flows remain usable and room saves announce the specified German message.
- [x] 1.3 Localize frontend and Go API/authentication error paths, preserving error categories, response fields, status codes, safe diagnostics, and recoverable input; verify room, media, identification, unknown-error, offline, and direct sign-in failure cases produce appropriate German feedback.
- [x] 1.4 Preserve existing user-entered names, notes, and scientific names through localization and unrelated edits; verify an existing multilingual collection remains unchanged after reading or editing a different record.

## 2. German dates and plant names

- [x] 2.1 Apply explicit German formatting and correct singular/plural messages to dates, times, numbers, and care intervals; verify one-day and multi-day cases and dates around timezone and daylight-saving boundaries without changing stored values or care calculations.
- [x] 2.2 Align the calendar grid and German weekday labels to a Monday-first week while preserving correct event and due-date placement; verify month boundaries and selected-day agendas in an English-language browser.
- [x] 2.3 Force PlantNet identification requests to `lang=de` while preserving other supported configured query parameters, credentials handling, and one-shot semantics; verify default, conflicting-language, and custom-query requests in backend tests and document the override in the configuration guidance.

## 3. Wikipedia reference resolution

- [x] 3.1 Replace the fixed English URL builder with bounded anonymous reference resolution that identifies normalized names, redirects, and verified equivalent German titles, preferring a confirmed German article and using a confirmed English article only after a successful German miss; verify German, different-title, English-only, and no-match fixtures without live external calls.
- [x] 3.2 Restrict generated reference links to HTTPS German or English Wikipedia, safely encode titles, and retain the accessible German new-tab cue and secure link attributes; verify Unicode and reserved-character inputs, disallowed destinations, keyboard activation, and the English-language fallback label.
- [x] 3.3 Integrate lookup loading, failure, offline, retry/reconnect, and stale-result handling into plant detail without blocking other actions or caching third-party responses; verify unavailable lookup, navigation or name changes during requests, no-name behavior, and existing offline reads.

## 4. Integration verification

- [x] 4.1 Update existing English-dependent frontend and browser test selectors and add focused German-only coverage for login, error states, accessibility, calendar, PlantNet results, and reference fallback; verify the tests do not depend on live Wikipedia or PlantNet responses.
- [x] 4.2 Run `npm test`, `npm run typecheck`, and `npm run build` in `web`, plus `go test ./...` at the project root; resolve regressions and record any unavailable required test environment.
- [x] 4.3 Run the Playwright suite against the built application, including offline and narrow-screen flows, and verify German app text and both Wikipedia selection paths; document any environment-dependent checks that cannot run.

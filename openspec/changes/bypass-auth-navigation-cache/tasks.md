## 1. Reproduce and correct authentication routing

- [x] 1.1 Add a focused Playwright spec and local HTTP fixture in `web/e2e` serving production assets, deterministic signed-out bootstrap data, and observable login/callback endpoints; verify an active controlling worker intercepts auth navigation with the current build and the regression fails at server-arrival assertions.
- [x] 1.2 Exclude the `/auth/` prefix from the navigation fallback in `web/src/sw.ts`, preserving existing API/media exclusions and cache allowlists; rebuild and verify the browser login test reaches the fixture server, receives its state cookie, and follows its redirect.

## 2. Cover cache boundaries and existing clients

- [x] 2.1 Extend browser coverage to callback URLs with code/state queries and another `/auth/` path; verify server-observed parameters and distinctive responses, and inspect all CacheStorage entries to confirm no auth URL is retained.
- [x] 2.2 Verify ordinary `/plants` navigation still serves the application shell offline while authentication navigation fails through the network rather than receiving that shell, using an explicitly controlling worker in the Playwright regression.
- [x] 2.3 Add an update-lifecycle browser case that starts under the previous worker, discovers the corrected worker at the same script URL, and accepts the existing update prompt; verify controller replacement and subsequent network auth navigation, and verify declining an update preserves the active page without reload.

## 3. Validate the production build

- [x] 3.1 Run `npm test`, `npm run typecheck`, and `npm run build` from `web`; verify successful frontend checks and that the generated worker excludes authentication routes.
- [x] 3.2 Run the full production browser suite, including the new regression and existing offline collection flows; use `/builder/bin/buildctl` for container builds, verify the `browser-tests-result` target passes, and record the exact validation result.

## Validation results

- Reproduced the original bug with the production worker controlling the page: the login regression failed because the fixture server observed zero `/auth/login` requests.
- `npm test`: 2 files / 6 tests passed.
- `npm run typecheck` and `npm run build`: passed; built worker includes the `/auth/` navigation exclusion.
- Focused Playwright authentication suite: 4 tests passed, including accepting and declining the corrected worker update.
- `/builder/bin/buildctl build --progress plain --frontend dockerfile.v0 --local context=. --local dockerfile=. --opt platform=linux/amd64 --opt target=browser-tests-result`: passed, with all 8 production browser tests passing.

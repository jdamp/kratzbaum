## Context

See proposal.md for motivation. `web/src/sw.ts` registers an app-shell navigation fallback that denies `/api/` and `/media/` but matches `/auth/`. Runtime data and media caching use explicit allowlists that already exclude authentication routes. The login link in `web/src/main.tsx` correctly navigates to the bootstrap-provided login URL.

The PWA uses injectManifest and prompted updates. `registerSW` offers a confirmation before invoking its update callback, and the worker handles `SKIP_WAITING` and calls `clientsClaim`. Existing Playwright coverage allows service workers and tests offline shell navigation, but does not test authentication under worker control or worker replacement. Design is needed to avoid a false-positive browser test and to preserve the update lifecycle.

## Goals / Non-Goals

**Goals:**
- Test actual browser navigation through the built production worker with an asserted controller.
- Prove network arrival independently of browser request events or URL changes.
- Verify the current activation mechanism can deliver the corrected worker to existing clients.

**Non-Goals:**
- Reimplement OIDC token verification, change the login link, disable the PWA, or automatically reload editing users.
- Add a real Authentik deployment or change backend authentication behavior.

## Decisions

### Deny authentication navigations in the existing fallback

Add a prefix exclusion for `/auth/` alongside `/api/` and `/media/`. NavigationRoute matching includes query strings, so a prefix exclusion covers login, callback code/state parameters, and future routes in this namespace. Keep authentication outside runtime cache allowlists. Let unmatched requests use the browser network path; no additional caching strategy or backend changes are needed.

Alternatives: removing the navigation fallback would break offline application routes; a separate cached auth strategy would introduce unnecessary interception and risk retaining sensitive responses.

### Use a server-side browser-test fixture

Add a focused Playwright spec with a local HTTP server on a loopback origin serving the built assets (obtain assets from the running application used by existing tests). Serve deterministic bootstrap JSON for a signed-out OIDC deployment, a login endpoint setting a test state cookie and redirecting to a fake provider page, and a callback endpoint recording its query and returning a distinctive response. The fixture is navigation coverage, not a substitute for the existing Go signed-token tests. No browser route interception may fulfill authentication navigations or disable service workers.

Wait for registration readiness, reload as necessary, and explicitly assert `navigator.serviceWorker.controller` before clicking the real login link and before callback navigation. Assert server-side request counters, redirect destination, state cookie, preserved callback parameters, and the distinctive callback response. Inspect all CacheStorage entries for `/auth/` URLs, including query strings. Exercise another `/auth/` route to demonstrate namespace-wide exclusion. Verify ordinary `/plants` navigation still returns the shell offline and an auth navigation fails instead.

### Exercise update activation without changing user behavior

Have the fixture initially serve the previous worker behavior, then switch to the built corrected worker bytes at the same `/sw.js` URL. Use the browser registration's update mechanism to discover the corrected worker. Accept the application's existing update confirmation and wait for the controller to change, then repeat the network-arrival assertion. Verify declining an offered update does not reload/discard an active page. Use isolated contexts and close fixture servers after each test.

Keep the existing prompt, skip-waiting message, and client claim mechanism unless the test exposes a defect. No unconditional skipWaiting is planned. A version change naturally changes worker bytes; no cache-name migration is required because the erroneous behavior returned the precached shell rather than caching auth responses by URL.

## Risks / Trade-offs

- A test may pass without a controlling worker -> Require an explicit controller before every relevant navigation and use server-side observations.
- Browser routing mocks can bypass the broken worker path -> Serve authentication responses over a real local HTTP listener.
- A simulated update may be nondeterministic -> Use deterministic differing worker bodies at one script URL, disable HTTP caching of the worker script, and wait for lifecycle events rather than fixed sleeps.
- Fixture behavior could be mistaken for full OIDC verification -> Keep existing backend auth tests and describe this coverage as service-worker navigation verification.

## Migration Plan

Build and deploy the corrected frontend with the normal release. Existing clients receive the new worker through the current update prompt and activate it after accepting; a waiting corrected worker can also activate after old controlled tabs close. Rollback reintroduces intercepted auth navigations. No persistent data or schema migration is required.

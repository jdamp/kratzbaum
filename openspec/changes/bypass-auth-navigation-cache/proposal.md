## Why

GitHub issue [#2](https://github.com/jdamp/kratzbaum/issues/2) reports that the installed service worker serves the cached application shell for OIDC login and callback navigations. Authentication must reach the server even when the page is controlled by the offline worker.

## What Changes

- Exclude every `/auth/` route from the application-shell navigation fallback and keep authentication responses outside service-worker caches.
- Preserve offline navigation for ordinary application routes.
- Add browser regression coverage with an active controlling worker for login redirects, callback requests, cache exclusion, offline shell navigation, and activation of an updated worker through the existing update prompt.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `offline-pwa`: Require authentication navigations to bypass the cached shell and reach the network, with an explicit update-activation scenario for existing clients.

## Impact

- Production fix targets `web/src/sw.ts`; existing runtime cache allowlists already exclude authentication responses.
- Extend `web/e2e` coverage with server-side fixtures that cannot mask worker interception; retain the existing Playwright and built-production-app test setup.
- Existing update behavior in `web/src/main.tsx` and the worker's `SKIP_WAITING` handler will be verified. No automatic reload, backend authentication changes, new dependencies, or database migration is planned.

## Context
Bootstrap supplies authentication mode, authenticated state, and the existing login URL. The SPA currently renders its shell regardless of this state, and its initial detail effect can run before bootstrap. The server already serves SPA routes and handles `/auth/login` and `/auth/callback`.

## Goals / Non-Goals
Goals: Give signed-out visitors a focused entry screen while preserving open access and authenticated offline reads.
Non-goals: Password forms, provider configuration changes, new session semantics, or return-to-original-path handling.

## Decisions
- Render a separate LoginPage before the collection shell when bootstrap is pending, unavailable, or reports signed-out OIDC. This prevents flashing protected controls. A loading title is neutral until authentication mode is known.
- Replace browser history with `/login` for signed-out OIDC and `/` for an authenticated `/login` visit. Keep the existing callback destination `/`. A router dependency would add unnecessary complexity to the existing history-based navigation.
- Gate initial plant-detail requests on authenticated bootstrap. Clear dialogs and visible detail on access-denied events.
- Retain the existing cached bootstrap semantics for offline authenticated reads. Listen for connection changes so a signed-out visitor cannot activate sign-in offline.
- Reuse the app palette, brand mark, and rounded cards with a botanical illustration and a single primary provider action.

## Risks / Trade-offs
- Cached bootstrap is not proof of a valid online session → existing server authorization remains authoritative and access-denied handling returns to login.
- Service worker interception can break provider redirects → retain actual HTTP provider/worker regression tests and the `/auth/` navigation exclusion.

## Migration Plan
Rebuild embedded frontend assets and deploy the existing binary/image normally. No database or configuration migration; rollback uses the previous frontend build.

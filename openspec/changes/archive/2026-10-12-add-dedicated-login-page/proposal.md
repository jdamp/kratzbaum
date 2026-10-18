## Why
Signed-out visitors currently see collection navigation and empty care content around a sign-in card. A dedicated login page makes the next action clear before entering the collection.

## What Changes
- Add a responsive standalone `/login` page with the existing identity-provider sign-in action.
- Route signed-out OIDC visitors and expired sessions to this page without requesting collection data.
- Show loading, retryable errors, and offline sign-in feedback; preserve authenticated cached collection access offline.
- Bypass login for authenticated visitors and open-access deployments.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `mobile-frontend`: Dedicated login page and authentication-aware collection entry.

## Impact
React entry point, styles, browser tests, and rebuilt embedded frontend assets. Existing OIDC routes and session handling remain unchanged. No new dependencies.

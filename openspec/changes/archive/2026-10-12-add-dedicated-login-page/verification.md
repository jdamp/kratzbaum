# Verification

- Frontend unit tests: 9 passed across 3 files (npm --prefix web test).
- Production frontend: TypeScript and Vite build passed; embedded assets regenerated (npm --prefix web run build).
- Full Chromium browser suite: 25 passed using BuildKit browser-tests-result. Includes signed-out /plants, plant-detail, /calendar and /login routing; no protected requests before authentication; 320px layout and keyboard sign-in; retryable bootstrap errors; offline sign-in and reconnection; authenticated/open-access login bypass; denied access closing editing; actual HTTP provider and callback routes; service-worker update and offline navigation regressions.
- Visual review: rendered mobile 390×844 and desktop 1280×900 screenshots, inspected the standalone branded login layout.
- OpenSpec strict validation and git diff --check passed.

The session-expiry test scopes its navigation selector to Main navigation. Existing creation response-count assertions now poll asynchronous response tracking, avoiding a race with dialog dismissal.

No backend authentication changes or database migration are required. The change is implemented and ready to sync and archive.

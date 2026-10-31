## Context

See `proposal.md` for motivation and scope. The React app contains English literals in all major views, including `api.ts` error handling, and `index.html` and the PWA manifest declare English text. The Go API and direct OIDC responses also supply English messages. PlantNet's configured URL currently preserves an explicit `lang` parameter. The calendar uses browser-default formatting with a fixed Sunday-first grid. Scientific-name links are constructed synchronously on English Wikipedia without checking availability. The offline policy excludes third-party responses from caches.

## Goals / Non-Goals

**Goals:**

- Provide German app-owned output consistently in online, offline, login, error, and accessibility paths, without introducing runtime language selection.
- Resolve dependable Wikipedia references while keeping plant detail responsive when the external service fails.
- Preserve existing data, APIs, authentication safety, care calculations, and offline-cache boundaries.

**Non-Goals:**

- Translating or rewriting existing user-created names and notes, adding a translation service, or maintaining a second interface language.
- Guaranteeing that external sources have German names or a correctly linked Wikipedia article for every species.
- Changing identity-provider-hosted pages or browser-generated native UI outside the app's control.

## Decisions

### One German presentation, including error paths

Translate existing app-owned copy in place or via a small shared German text/formatting module; do not introduce language negotiation, persisted language preferences, or a locale switch. Cover status messages, accessible names, image alternatives, placeholders, dialog text, update prompts, generated activity labels, login, the HTML language/title/description, and the PWA manifest. Preserve dynamic user content and scientific names as data. Request `lang=de` for PlantNet, including when a configured endpoint contains a different `lang`, while retaining its other allowed query parameters. The provider may return no German common name, in which case the scientific name remains usable.

Translate server-produced messages displayed by the frontend, including identification result errors, room and media validation failures, and direct authentication responses. Preserve HTTP status codes, JSON fields, stable error codes, and the distinction between failure categories; for unknown errors, display a safe German fallback instead of raw English technical details. This is simpler than maintaining two catalogs and negotiation logic for a household that has requested only German.

### German formatting without changing care semantics

Use an explicit German locale for app-rendered dates, times, numbers, and singular/plural text, and render calendar weekdays in German with Monday first. Maintain the existing deployment timezone and date-only/instant semantics, including activity-day grouping, when changing display and grid alignment; do not treat a locale change as a change to stored dates or due-date calculations. Native input widgets may still follow browser or operating-system settings. Retain keyboard access and the 320 CSS-pixel layout with longer translated labels.

### Resolve an actual German article before the English fallback

Resolve references asynchronously from the scientific name while keeping the plant detail readable. Use bounded, anonymous read-only Wikipedia/Wikidata lookups: resolve normalized scientific-name titles and redirects, and use verified interlanguage links or exact taxon metadata to find an equivalent article under a different title. A German match wins; use a confirmed English match only after a successful German lookup finds no matching German article. Do not select an unrelated search result merely because its text is similar. If neither article is established, keep the scientific name as text. If a lookup is offline, times out, or otherwise fails, treat the result as unknown, show German unavailable feedback rather than claiming a German article is missing, and retry for the current plant when connectivity returns or the user retries.

Construct returned links on an allowlist of HTTPS German/English Wikipedia hosts and encode the canonical title as a path component; never treat an arbitrary upstream URL or user-provided scientific name as a trusted destination. Preserve the keyboard-accessible new-tab cue and `noopener noreferrer`. Cancel or ignore stale responses when the plant or scientific name changes. Lookup failures must not block other plant actions. The no-link behavior for failed lookup or no matching article is an assumption for this change, chosen to avoid a fabricated or broken destination.

Prefer a browser-side anonymous lookup over a new backend proxy because the app is already a browser client and Wikimedia exposes anonymous cross-origin access. Send no app credentials to Wikimedia; do not persist third-party responses or add them to the service-worker cache. Direct hostname substitution was rejected because the article may not exist at that title or may use a different German title. See [MediaWiki query and redirects](https://www.mediawiki.org/wiki/API%3AQuery), [language links](https://www.mediawiki.org/wiki/API%3ALanglinks), and [cross-site requests](https://www.mediawiki.org/wiki/API%3ACross-site_requests).

## Risks / Trade-offs

- [Wikipedia/Wikidata metadata may lack an exact redirect or interlanguage mapping] -> Avoid guessing; a real but undiscoverable article can remain unlinked. Exercise direct German titles, redirects, language links, English-only articles, and absent matches with deterministic fixtures.
- [Opening plant detail contacts Wikimedia and reveals the queried scientific name to that service] -> Use anonymous requests without credentials and query only the name needed for resolution.
- [A lookup or connection failure could be mistaken for absence] -> Model unavailable separately from a confirmed missing result and do not switch to English on an inconclusive German lookup.
- [Longer German labels or locale changes could regress mobile care flows] -> Exercise mobile and keyboard flows, calendar boundaries, German plurals, and timezone-sensitive dates without changing stored values.
- [Forcing `lang=de` changes behavior of custom PlantNet URLs] -> Document the override and test preservation of all other supported query parameters and one-shot request behavior.

## Migration Plan

Ship frontend and server changes together and let the existing service-worker update flow replace the cached app shell without discarding active forms. No database migration or translation of stored collection data is required. Update the configuration documentation and English-dependent tests. Rollback deploys the previous app version; existing records and API data formats remain readable, and configured PlantNet endpoint URLs are not rewritten.

## Why

The household uses kratzbaum in German, but the app currently presents English interface text and links plant species directly to English Wikipedia. A consistent German experience and a German-first reference lookup will make everyday plant care easier while retaining useful English articles when German coverage is missing.

## What Changes

- Present all app-owned user-facing text in German, including login, navigation, forms, accessibility labels, errors, confirmations, offline states, and installable-app metadata. Use German date, number, and calendar conventions without changing stored care data or scheduling semantics. Do not add a language switcher.
- Resolve a scientific name to its German Wikipedia article when a matching article can be established; use the corresponding English article only when no German article is found. Keep the species readable if neither article is found or the lookup cannot be completed.
- Request German common names for PlantNet identification where the provider supplies them. Preserve names, notes, scientific names, and other collection content already entered by users.
- **BREAKING**: The app becomes German-only, and an explicitly configured PlantNet `lang` query parameter is overridden with `de`; other supported endpoint parameters and the existing identification request semantics remain intact.

## Capabilities

### New Capabilities

- `german-localization`: German-only app presentation, accessible messaging, locale conventions, and preservation of user-supplied content.

### Modified Capabilities

- `mobile-frontend`: Replace unconditional English Wikipedia links with a checked German-first, English-fallback reference and an accessible unavailable state.
- `plant-identification`: Request German contextualized common names while retaining the existing provider request and safety guarantees.
- `plant-rooms`: Replace the specified English room-save announcement with a concise German announcement.

## Impact

The React frontend, document and PWA metadata, calendar formatting, backend-provided and direct authentication error messages, PlantNet request construction, and their tests are affected. Wikipedia lookup introduces a read-only external dependency for resolving links; unavailable lookup must not block plant details or change the existing offline cache policy. Error status codes and response structures remain compatible, although user-visible message text changes.

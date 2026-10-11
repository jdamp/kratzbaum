## Why

kratzbaum will give a self-hosted plant collection one place to keep photos, species information, care notes, and care history. It should make daily care convenient on a phone, retain access to previously cached information offline, and provide a practical project for learning Go.

## What Changes

- Introduce one shared plant collection per deployment, including photos, editable species information, and dated care notes written by users.
- Track watering, fertilizing, photos, and notes in plant timelines and a collection calendar, with consistent activity colours, labels, and icons.
- Give each plant its own watering interval and summer/winter fertilizing intervals. Calculate due dates from completed care and use a northern hemisphere season preset.
- Add explicit, one-shot PlantNet identification. Accept JPG, PNG, WebP, and HEIC uploads, normalize images to JPEG on the backend, and let users confirm a candidate species.
- Introduce a mobile-first, installable PWA with Today, Plants, and Calendar views, and Workbox caching for offline reading of cached data.
- Support open access or an external OIDC provider, with authenticated users accessing the same collection.
- Build a Go backend supporting local SQLite and PostgreSQL, with persistent filesystem photo storage and a self-hosted container deployment.

## Capabilities

### New Capabilities

- `plant-catalogue`: Shared plant records, photos, species information, and user-written care notes.
- `care-tracking`: Per-plant schedules, seasonal fertilizing, activity history, and calendar data.
- `plant-identification`: Upload normalization and explicit PlantNet identification with candidate confirmation.
- `mobile-frontend`: Responsive navigation, collection browsing, plant details, and convenient care entry.
- `offline-pwa`: Installation, application-shell caching, offline reads, and cache lifecycle behavior.
- `authentication`: Open/OIDC modes and access to the shared collection.
- `self-hosting`: Go deployment, SQLite/PostgreSQL persistence, migrations, and persistent photo storage.

### Modified Capabilities

None. The project currently has no application code or existing capability specifications.

## Impact

This is a greenfield application. It adds a Go HTTP API, a React/TypeScript frontend built with Vite, database schemas and migrations for both supported engines, and a container image with a HEIC decoder. External services are limited to the deployment's optional OIDC provider and optional PlantNet integration. The PostgreSQL configuration must support an existing homelab database server; SQLite must support running the application without a separate database service.

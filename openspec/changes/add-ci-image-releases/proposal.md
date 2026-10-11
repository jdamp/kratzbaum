## Why

Kratzbaum has local tests and container tooling but no automated checks or published application image. A hobby homelab deployment needs tested main builds with identifiable versions and no manual release bookkeeping.

## What Changes

- Add GitHub Actions checks for pull requests and pushes to main covering Go, SQLite/PostgreSQL integration, frontend, browser, and container smoke tests.
- Publish the production image to `ghcr.io/jdamp/kratzbaum` only after checks pass on a push to main.
- Tag each published build as `0.1.<github.run_number>` and maintain `latest`; reruns reuse the same version and gaps are allowed.
- Use buildctl for image builds and the repository GITHUB_TOKEN for publication.
- Document image consumption, version semantics, and initial GHCR setup.

## Capabilities

### New Capabilities

- `image-releases`: Automated validation and publication of versioned application images from main.

### Modified Capabilities

None. Existing self-hosting requirements remain applicable to the published image.

## Impact

Adds GitHub Actions workflow configuration and updates deployment documentation. May add narrowly scoped Dockerfile test targets or CI helpers to reuse existing test stages. Uses GHCR, GitHub-hosted runners, a disposable PostgreSQL 18 service, and BuildKit. No application API, database schema, or runtime version endpoint changes; no manual Git tags or release automation service.

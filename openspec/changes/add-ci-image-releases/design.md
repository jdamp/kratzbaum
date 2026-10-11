## Context

See proposal.md for motivation. There is no .github workflow or Git release history. The Dockerfile already has frontend-tests-result, browser-tests-result, smoke, and production targets; building production does not execute the test targets. The backend embeds the built frontend. Go targets 1.27, the frontend uses Node 22, and PostgreSQL tests need KRATZBAUM_TEST_POSTGRES_URL pointing to a database ending in _test. Backup tests require PostgreSQL 18 client tools. The private frontend package version is not an application release source.

## Goals / Non-Goals

**Goals:** Reuse existing test paths, keep release numbering automatic, and require no long-lived publishing credential.

**Non-Goals:** Manual Git tags, release PRs, changelog generation, automatic semantic change detection, runtime version endpoints, deployment automation, and multi-platform images. Start with linux/amd64; additional architectures can be a separate change.

## Decisions

### One stable workflow owns validation and release numbering

Use pull_request targeting main and push on main. A single stable workflow gives github.run_number its meaning; PR and failed runs consume numbers, which is acceptable. Compute 0.1.<run-number> directly and do not edit package.json or commit a version file. Reruns retain the run number. Manual SemVer releases and automated version commits add bookkeeping without benefiting this project.

Do not configure cancellation of main runs or a concurrency policy that discards pending main runs: each passing push needs its own numbered image. latest is a convenience alias for the most recently published passing build; overlapping runs can finish out of commit order. Numbered tags allow selecting a particular build. Strict ordering of latest is outside this initial hobby-project pipeline.

### Explicit validation jobs gate publication

Run backend tests after building frontend assets, with a healthy disposable PostgreSQL 18 service and matching pg_dump/pg_restore clients installed and verified. Set the test URL explicitly using CI-only credentials and a database ending in _test. Ensure optional PostgreSQL cases actually execute rather than skip. Run frontend unit tests and type checking using npm ci --legacy-peer-deps. Reuse the Dockerfile browser-tests-result and smoke targets, and explicitly invoke frontend-tests-result if frontend tests are run through BuildKit. All required jobs must pass before publication; skipped or cancelled checks cannot authorize publication.

### BuildKit and explicit production target

Build container targets using buildctl. In this workspace the binary is /builder/bin/buildctl; GitHub-hosted runners must provision a pinned BuildKit distribution and daemon instead of assuming that mount exists. Use the production target explicitly and export both image names in one image publication so they resolve to the same digest. Build/test the same checked-out revision. Registry cache may improve speed but is optional and must not add application release tags.

### Restricted publication credentials

Use read-only contents permissions by default. Only the main-push publication job receives packages: write and authenticates buildctl through a temporary Docker credential configuration using GITHUB_TOKEN. Avoid pull_request_target and personal access tokens. Pin third-party actions to reviewed commit SHAs. Add OCI source, revision, and version labels so the package links back to the repository and build.

### Version tags identify runs, digests identify exact bytes

Use only latest and the numbered version for application releases. A rerun can rebuild the same numbered tag; dependency or base-image changes may produce different bytes. Do not claim numbered tags are immutable. Document digest pinning for exact rollback. A future workflow replacement or run-number reset requires changing the version prefix to avoid collisions.

## Risks / Trade-offs

- [Required tests silently skip] -> Explicitly provision database and tools, verify prerequisites, and inspect verbose backend output for required coverage.
- [GHCR package initially private or existing package lacks workflow access] -> Document one-time package visibility/access setup and verify the first publication.
- [latest can follow completion order during overlapping runs] -> Document this simple behavior and use numbered versions or digests when selecting a specific build.
- [Workflow numbering is not semantic version analysis] -> Keep the workflow identity stable; allow gaps and document the automatic patch scheme.
- [Local checks cannot prove hosted publishing permissions] -> Validate workflow structure locally and verify publication in the first GitHub run.

## Migration Plan

Add the workflow and deployment documentation, then validate checks through a pull request. After merging, verify the main run publishes both tags with matching digests, labels, and working image startup. Set package visibility as needed. Operators can adopt the published image without a data migration. Roll back a deployment by selecting a previous image digest; disable the workflow to stop future publication if needed.

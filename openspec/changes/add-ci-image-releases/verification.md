# Implementation verification

Verified locally on 2026-10-11:

- actionlint v1.7.7: workflow passes; publication depends on backend, frontend, and both container matrix legs. The default success condition prevents publication after failed, skipped, or cancelled dependencies. Only pushes to refs/heads/main can publish; only that job has packages write permission. There is no main-run cancellation policy.
- npm ci --legacy-peer-deps, npm test, npm run typecheck, npm run build: pass; 6 frontend tests.
- Mounted buildctl builds of browser-tests-result and smoke: pass; 4 browser tests plus startup, decoder validation, and HEIC-to-JPEG upload checks.
- scripts/ci/backend-tests.sh executed in a temporary PostgreSQL 18/Go verification image against isolated project database kratzbaum_ci_test: passes, including all six explicitly required SQLite/PostgreSQL contract/API/backup cases. Connection credentials were supplied via a BuildKit secret and were not committed or logged. The temporary image reused Go modules and CA certificates from the backend stage; it is not part of the project Dockerfile.
- Explicit linux/amd64 production export with both image names: passes. Build metadata contains latest and 0.1.42 with a single image digest. This was a local export with push=false, not a GHCR publication.
- Pinned BuildKit v0.25.1 archive checksum and client execution: verified. Hosted daemon startup uses sudo and remains a hosted-run verification item.
- bash syntax check, git diff --check, and openspec strict validation: pass.

Remaining task 3.3 requires the first GitHub main run: confirm hosted setup, GITHUB_TOKEN package access, registry tags/digest/labels, and startup of the pulled image. No commit, remote push, or registry publication was performed in this implementation session.

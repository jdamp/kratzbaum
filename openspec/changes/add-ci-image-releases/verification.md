# Implementation verification

Verified locally on 2026-10-11:

- actionlint v1.7.7: workflow passes; publication depends on backend, frontend, and both container matrix legs. The default success condition prevents publication after failed, skipped, or cancelled dependencies. Only pushes to refs/heads/main can publish; only that job has packages write permission. There is no main-run cancellation policy.
- npm ci --legacy-peer-deps, npm test, npm run typecheck, npm run build: pass; 6 frontend tests.
- Mounted buildctl builds of browser-tests-result and smoke: pass; 4 browser tests plus startup, decoder validation, and HEIC-to-JPEG upload checks.
- scripts/ci/backend-tests.sh executed in a temporary PostgreSQL 18/Go verification image against isolated project database kratzbaum_ci_test: passes, including all six explicitly required SQLite/PostgreSQL contract/API/backup cases. Connection credentials were supplied via a BuildKit secret and were not committed or logged. The temporary image reused Go modules and CA certificates from the backend stage; it is not part of the project Dockerfile.
- Explicit linux/amd64 production export with both image names: passes. Build metadata contains latest and 0.1.42 with a single image digest. This was a local export with push=false, not a GHCR publication.
- Pinned BuildKit v0.25.1 archive checksum and client execution: verified. Hosted daemon startup uses sudo and remains a hosted-run verification item.
- bash syntax check, git diff --check, and openspec strict validation: pass.

## Hosted verification

Completed task 3.3 on 2026-10-11 using https://github.com/jdamp/kratzbaum/actions/runs/38135153066 (workflow run number 4, commit 1aeaf7c8fe302979c0366385ce9771941f481ba2).

- All frontend, backend/database, browser, and HEIC smoke jobs passed.
- GHCR publication succeeded using GITHUB_TOKEN.
- Both ghcr.io/jdamp/kratzbaum:0.1.4 and latest were pulled and resolved to sha256:5657fa27aec28424e21c0eddf5bf94e8bafd570f0a02a36e4d5ffeb57587527a.
- The pulled version image passed explicit version/revision/source-label checks.
- Running that digest returned HTTP success for the frontend and health endpoint, reported {"status":"ok"}, ran as UID 10001, and contained /usr/bin/heif-convert.
- Earlier hosted failures exposed the BuildKit socket parent-directory permission and PostgreSQL health-option quoting issues; both were corrected and verified by the successful run. Failed validation blocked publication as designed.
- Every future publication now repeats the registry pull, label checks, and runtime checks in the publication job.

All nine implementation tasks are complete. The verification-record commit is another main push and therefore receives its own automatic release when checks pass.

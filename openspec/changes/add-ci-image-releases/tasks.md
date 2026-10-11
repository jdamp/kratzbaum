## 1. Automated validation

- [x] 1.1 Add a stable GitHub Actions workflow for pull requests targeting main and pushes to main, using read-only default permissions and pinned actions; verify triggers and job dependencies with actionlint and ensure main runs are not cancelled by newer pushes.
- [x] 1.2 Add backend checks that build embedded frontend assets and run go test ./... with a healthy PostgreSQL 18 test service, matching client tools, and an explicit test database URL; verify verbose output includes passing SQLite, PostgreSQL contract/API, and backup/restore cases without required skips.
- [x] 1.3 Add frontend unit tests and type checking using the lockfile and npm ci --legacy-peer-deps; verify both npm test and npm run typecheck pass.
- [x] 1.4 Provision pinned BuildKit tooling on hosted runners and invoke existing browser and HEIC smoke targets using buildctl; verify browser-tests-result and smoke builds succeed and frontend tests execute either in their dedicated job or frontend-tests-result.

## 2. Image publication

- [x] 2.1 Add a main-push-only publication job depending on every required check, with packages: write and temporary GITHUB_TOKEN registry credentials; verify PRs, other branches, failed checks, and skipped checks cannot publish and credentials are not logged.
- [x] 2.2 Build the explicit linux/amd64 production target using buildctl and publish latest plus 0.1.<github.run_number> for the same image with OCI version/revision/source labels; verify tag computation, unchanged rerun versions, production target selection, and matching exported digests.

## 3. Documentation and end-to-end verification

- [x] 3.1 Update README container instructions with the GHCR path, latest and version examples, expected numbering gaps, rerun behavior, completion-order latest updates, digest pinning, and initial package access setup; verify examples agree with workflow configuration.
- [x] 3.2 Run actionlint and the required checks locally where supported, then review event/permission/failure gates against the image-releases scenarios; record results and any hosted-only verification remaining.
- [ ] 3.3 On the first authorized GitHub main run, verify successful checks, two published tags with matching digests and labels, and startup of the pulled production image; record the hosted run and registry evidence, leaving this task pending until that evidence is available.

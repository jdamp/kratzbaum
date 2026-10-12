## 1. Creation photo selection

- [x] 1.1 Add a labelled optional single-photo picker with filename, browser preview/fallback, and replace/remove controls to the creation form; verify JPG/PNG/WebP/HEIC selection, preserved form input, keyboard access, and a usable 320px layout.
- [x] 1.2 Manage preview object URLs and reset creation-only state on cancel, close, and a fresh dialog; verify replacement/removal releases previews, cancelling makes no create/upload request, and reopening or editing does not inherit a prior file or saved ID.

## 2. Save and recovery flow

- [x] 2.1 Retain the typed created plant response and upload a selected photo to its ID using the ordinary photo helper; verify creation without a photo still completes and creation with a photo produces a gallery entry, first cover, and dated activity without identification.
- [x] 2.2 Add distinct saving/uploading progress with an immediate in-flight guard and disabled submission, dismissal, and input changes during pending requests; verify delayed responses and repeated clicks cannot start concurrent create/upload requests, and create rejection retains details/file without uploading.
- [x] 2.3 Add the saved-plant recovery state with accessible upload-failure/uncertainty feedback, retained selection, replacement, Retry photo, and Continue without photo; verify retries use the same ID with exactly one confirmed plant create, continuation/dismissal preserves the plant, and refresh errors never repeat writes or misreport upload success.

## 3. Regression and production verification

- [x] 3.1 Extend Playwright coverage for optional-photo success, preview/filename fallback, replacement/removal, cancellation/reset, and unchanged editing; verify the tests check gallery/cover/activity results and absence of early uploads or identification requests.
- [x] 3.2 Add controlled create rejection, upload rejection, and connection-loss cases, including delayed requests, retry, replacement, and continuation; verify input retention, phase controls, one confirmed create across photo retries, saved-plant visibility, and no automatic offline replay.
- [x] 3.3 Run the frontend unit tests, TypeScript checks, and production build, committing the regenerated embedded assets under `cmd/kratzbaum/web/dist`; verify all checks pass and generated changes match this feature.
- [x] 3.4 Run the production Playwright container workflow using `/builder/bin/buildctl` and its `browser-tests-result` target; verify the complete browser suite passes and record any environment limitations alongside the results.

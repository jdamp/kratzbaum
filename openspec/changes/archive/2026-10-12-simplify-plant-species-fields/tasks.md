## 1. Simplify the shared form

- [x] 1.1 Remove Common name and Family inputs, expand Scientific name, and preserve existing metadata in edit submissions; verify the browser regression checks absent inputs and unchanged saved metadata.

## 2. Verification

- [x] 2.1 Extend the existing creation/edit browser coverage and run the production browser-tests-result BuildKit target; verify all browser tests pass, including the 320px form checks.
- [x] 2.2 Run the frontend build and OpenSpec validation; verify the embedded assets are regenerated and all change artifacts validate.

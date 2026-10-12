# Verification

Implemented against the approved Penpot design in file **Kratzbaum**, page **Create plant · Photo flow** (file ID `9c72c01a-ed94-81f2-8008-c5d26b7e9bfd`, page ID `c2e69c6f-94af-80eb-8008-c79161aadfdb`).

- `npm --prefix web test`: 6 unit tests passed.
- `npm --prefix web run typecheck`: passed.
- `npm --prefix web run build`: passed; embedded assets regenerated in `cmd/kratzbaum/web/dist`, including the worker's updated precache references.
- `/builder/bin/buildctl build --progress plain --frontend dockerfile.v0 --local context=. --local dockerfile=. --opt platform=linux/amd64 --opt target=browser-tests-result --output type=local,dest=/tmp/kratzbaum-photo-browser-results`: passed all 17 production Playwright tests, including 9 new creation-photo tests. Result marker exported successfully.

New browser coverage verifies local selection, replacement/removal, preview cleanup, HEIC fallback, keyboard focus, 44px photo actions, and no horizontal overflow at 320px. It exercises cancellation/reset, creation without a photo, actual creation/upload with first cover and one activity, absence of automatic identification, unchanged editing, rejected creation, delayed requests/double submission, retry with a replacement against one saved plant ID, continuation/dismissal, connection loss without automatic replay, and a refresh failure after successful upload.

No database, backend API, or dependency changes were needed. Photo selection is retained while the dialog remains open. Ordinary uploads retain the existing uncertainty after a lost response: explicit retry reuses the saved plant, but does not guarantee exactly-once photo storage if the server committed an upload before its response was lost.

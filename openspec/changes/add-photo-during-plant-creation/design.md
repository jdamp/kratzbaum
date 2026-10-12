## Context

The proposal adds an optional photograph to the existing Add a plant dialog. That dialog in `web/src/main.tsx` currently submits plant details, discards the create response, and closes after saving. Photo upload is a separate action in the saved plant's gallery.

The existing APIs already support this flow: `POST /api/plants` returns the created plant, and `POST /api/plants/{id}/photos` normalizes supported photographs, creates a dated photo activity, and sets the first photo as cover. The frontend `uploadPhoto` helper uses the ordinary upload endpoint unless identification is explicitly requested. The shared request wrapper blocks offline writes and does not replay them.

The key constraint is partial success: the plant may be saved even when its photo fails. The agreed behavior preserves the saved plant and offers an explicit retry or continuation without another upload.

## Goals / Non-Goals

**Goals:**
- Select one optional photo before creating a plant, with preview or filename fallback and replace/remove controls.
- Preserve creation without a photo and use existing photo normalization and cover behavior.
- Retain the confirmed plant ID and selected file when upload fails so recovery never repeats confirmed plant creation.
- Keep progress, errors, cancellation, and keyboard/mobile use understandable.

**Non-Goals:**
- Multiple photos during creation, automatic species identification, or changes to the existing edit/gallery workflows.
- A new multipart plant-creation API, database migration, dependency, or upload queue.
- Persisting a local selection across page reloads or guaranteeing exactly-once photo storage after a lost response.

## Decisions

### Keep photo selection local until submission

Store one `File` in creation-dialog state. Reuse the gallery's accepted formats (JPG, PNG, WebP, HEIC, including the existing HEIF alias). Show its filename and use an object URL for a preview. If the browser cannot decode the image, show filename feedback without a broken image and keep the file eligible for upload. Revoke object URLs on replacement, removal, dialog reset, and unmount. Replacing or removing the file must preserve the other form fields.

Selection itself makes no network request. Cancelling an unsaved form clears its transient state. This avoids creating an orphan plant merely to preview a file. Backend normalization remains authoritative; browser file filters are selection hints, not validation guarantees.

### Save the plant, then upload to its returned ID

Use the typed create response and retain its ID before calling `uploadPhoto` without identification. Model these phases explicitly:

`draft -> saving plant -> uploading photo -> complete`

A create rejection returns to the draft with details and selection intact and makes no upload request. A confirmed save without a photo completes immediately. A confirmed save followed by an upload failure enters a recovery state containing the saved plant ID and selected file.

Reuse of the two APIs avoids duplicating backend photo processing. An atomic multipart endpoint would expand backend scope; deleting the saved plant on upload failure would contradict the agreed recovery behavior.

### Recover against the saved plant

Show an accessible message explaining that the plant was saved and the photo failed or could not be confirmed. Offer Retry photo and Continue without photo, and allow selecting a replacement file. Retry calls only the photo endpoint for the retained plant ID. Display the saved plant details as a summary or read-only fields in this state so edits cannot appear to modify an already saved record.

Continuation or dismissal after a confirmed save preserves that plant, refreshes the collection, and clears transient creation state. The next new-plant form starts without a saved ID or file. A refresh failure must not cause another create or upload request or misreport an already successful upload as failed.

### Guard pending operations and preserve the existing completion flow

Use an immediate in-flight guard alongside disabled controls to prevent double submissions before a rerender. Announce saving and uploading separately. Prevent dismissal and changes to form/file input while an operation is pending, preserving the context needed for recovery. Keep the existing collection refresh and dialog completion behavior after success; no new route is required.

Writes remain disabled offline through the existing request policy. No upload is automatically retried or queued. Loss of connectivity after a confirmed create leaves the saved ID and local file available in the open dialog.

## Risks / Trade-offs

- **Lost upload response may follow a successful server commit.** Ordinary photo uploads have no idempotency key. -> Describe uncertain outcomes accurately, require explicit retry, and refresh server state when leaving the flow. Retrying cannot duplicate the confirmed plant, but may add another photo if the previous response was lost. Exactly-once photo retries are outside this change.
- **HEIC preview support varies by browser.** -> Keep filename fallback independent of upload eligibility and test the preview-error path.
- **Shared add/edit dialog state could leak across sessions.** -> Scope photo controls to creation and reset file, preview, saved ID, errors, and phase when closing or opening a new form; verify editing remains unchanged.
- **Local selection is lost on reload.** -> Recovery is supported while the creation flow remains open; do not imply durable offline storage.
- **Pending-operation dismissal restriction can briefly delay closing.** -> Show clear progress and restore dismissal/recovery actions as soon as the request settles.

## Migration Plan

No backend or schema migration is needed. Rebuild the frontend and commit its embedded production assets under `cmd/kratzbaum/web/dist` with the implementation. Rollback consists of restoring the prior frontend; any successfully created plants and photos remain ordinary compatible records.

## Verification

Extend Playwright coverage for creation with and without a photo, first cover and activity behavior, selection replacement/removal/cancellation, unavailable previews, plant-create rejection, photo-upload rejection, retry, and continuation. Intercept requests where needed to assert one confirmed create across retries, no early upload, no identification, and disabled concurrent submission. Exercise keyboard access and narrow layout, run the frontend checks/build, and run the production browser-test container workflow.

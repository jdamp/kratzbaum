## Context

See proposal.md for motivation. The shared dialog submits a complete plant update; simply deleting its inputs would cause the current FormData mapping to send empty common-name and family values on edits.

## Goals / Non-Goals

Keep form simplification compatible with saved records. Data deletion, API changes, and identification changes are outside this change.

## Decisions

Remove both labelled inputs and make Scientific name a full-width field. Populate omitted metadata from the editing plant when building the update payload; use empty strings for a new manual plant. Keeping metadata in the API avoids destructive edits and schema migrations. Removing the fields from the database would expand scope and discard saved information.

## Risks / Trade-offs

- Editing could erase omitted metadata -> Extend the browser edit regression with nonempty persisted values and verify they survive saving.
- The scientific-name row could retain an empty column -> Remove its paired-field wrapper and verify responsive form behavior.

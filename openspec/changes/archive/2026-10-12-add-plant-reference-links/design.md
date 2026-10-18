## Context

See proposal.md for motivation. Plant detail already displays scientific name with common-name/unknown-species fallback. The user chose an automatic Wikipedia link, avoiding an additional URL field.

## Goals / Non-Goals

Keep the form and persistence model unchanged. Wikipedia availability checks, automated matching, custom reference sites, and article previews are outside this change.

## Decisions

Generate a destination using a fixed `https://en.wikipedia.org/wiki/` prefix, trimmed scientific name, whitespace normalized to underscores, and encodeURIComponent for the whole title. Use the scientific name as visible anchor text inside the existing detail heading, with a visible external-link cue and an accessible label explaining Wikipedia/new tab. Set target=_blank and rel=noopener noreferrer. Keep the fallback heading as ordinary text when scientific name is blank.

A custom URL field would require persistence and validation that the selected automatic-link behavior does not need. A search endpoint would open search results rather than the named article. A direct title is predictable and requires no Wikipedia requests until the user follows it.

## Risks / Trade-offs

- A scientific name may not have an article -> Wikipedia handles missing pages or redirects; the app does not claim to verify article existence.
- Reserved characters could change the destination -> Encode the full normalized title and test Unicode, slashes, query, and fragment characters.

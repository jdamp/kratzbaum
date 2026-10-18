# Verification

- Frontend unit tests: 9 passed, including whitespace, blank-name, Unicode, and URL delimiter handling.
- TypeScript and production frontend build passed; embedded assets regenerated.
- Production BuildKit browser-tests-result target: all 17 tests passed. Identification coverage verifies absent-name fallback, the automatic Wikipedia destination, new-tab semantics, and keyboard focus.
- Strict OpenSpec validation passed.
- Penpot: Kratzbaum → Kratzbaum · Mobile reference → 03 · Plant detail now shows an underlined scientific name with an external-link cue and a clickable Wikipedia prototype destination. Export visually inspected.

The implementation generates the article title without checking article existence or making automatic Wikipedia requests. No API, database, or dependency changes. The previously implemented form simplification remains present.

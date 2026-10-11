## Context

See proposal.md for motivation and specs/authentication/spec.md for the behavior contract. `config.Load` currently removes all trailing slashes from `OIDC_ISSUER`. `auth.New` passes that value to `oidc.NewProvider`, uses the provider's default verifier, and retains the configured issuer in session identity and attribution. Startup exits on discovery failure.

The existing signed-token flow fixture in `internal/auth/oidc_flow_test.go` tests state, nonce, issuer, audience, and expiry but constructs `config.Config` directly and uses a slashless server-root issuer. It therefore bypasses the faulty loader. The reported startup failure was identified through source inspection; it has not yet been reproduced locally. This design is included because the fix affects an authentication identifier and must preserve strict verification.

## Goals / Non-Goals

**Goals:**
- Make regression coverage exercise environment loading, discovery, token verification, and resolved session identity together.
- Demonstrate both acceptance of exact issuer matches and rejection of slash-only mismatches.

**Non-Goals:**
- General URL-validation cleanup, issuer aliases, provider-specific authentication branches, dependency upgrades, or changes to session storage.
- Running or deploying a real Authentik instance as a test dependency.

## Decisions

### Preserve the raw environment value

Replace trailing-slash removal with direct environment retrieval in `internal/config/config.go`. Avoid URL reconstruction and surrounding-whitespace trimming: exact preservation is the narrowest fix and does not introduce a second configuration behavior change. Operators must supply the exact issuer advertised by discovery. Leave the existing URL validation in place.

Alternatives: whitespace trimming is allowed by the issue but unnecessary for resolving it; treating slash variants as equivalent or disabling issuer checks would weaken verification and would not preserve the identifier.

### Keep the OIDC verifier unchanged

Continue using `oidc.NewProvider` and the provider's default verifier. Do not enable issuer-check bypasses. The same preserved identifier already flows into session issuer and identity attribution, so no auth production-code or schema changes are expected.

### Extend the existing local signed-token fixture

Exercise slashless root and Authentik-style path issuers, including a provider path ending in `/`. Load test configuration through `config.Load` with isolated environment variables before calling `auth.New`. Keep endpoint construction separate from the issuer identifier so test routes do not accidentally acquire doubled slashes. Serve discovery at the path requested by the existing OIDC library, and publish explicit authorization, token, and JWKS endpoints.

Assert that a successful callback creates a session resolvable through `Manager.Resolve`, with the exact issuer and issuer/subject identity. Retain existing invalid-state, nonce, issuer, audience, and expiry checks. Add discovery failures and signed-token rejection where only the trailing slash differs, covering both mismatch directions. Failed callbacks must not create an authenticated session cookie.

Add focused configuration cases for root URLs, provider paths, and trailing-slash preservation, including multiple trailing slashes to guard against reintroducing slash normalization. Configuration tests isolate loading behavior; the flow tests prove that loading works with strict discovery and token checks.

## Risks / Trade-offs

- Test fixture could conceal loader regressions by constructing config directly -> Run the successful discovery/login cases through environment loading and assert the loaded issuer.
- Fixture endpoint concatenation could create misleading routing failures -> Derive endpoint URLs independently and check the discovery request path.
- A local fixture cannot prove every Authentik deployment works -> Model the reported per-provider path and exact discovery/token issuer semantics without claiming a live-provider validation.
- An operator may have relied on silent slash removal -> Document exact issuer configuration; an actual mismatch must fail rather than be silently rewritten.

## Migration Plan

No database migration is required. Deploy the fixed build with `OIDC_ISSUER` set to the exact advertised issuer and restart. Existing correctly configured slashless issuers continue to work. Rolling back restores the trailing-slash bug and can block startup for affected providers; do not use open authentication mode as a rollback workaround.

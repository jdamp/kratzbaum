## Why

GitHub issue [#1](https://github.com/jdamp/kratzbaum/issues/1) reports that configuration strips the trailing slash from Authentik's per-provider issuer, causing a discovery issuer mismatch and blocking startup. Preserving the configured identifier enables these providers while retaining strict OIDC verification.

## What Changes

- Preserve `OIDC_ISSUER` exactly when loading configuration, including trailing slashes.
- Explicitly require exact issuer matching during discovery and token verification.
- Add configuration and discovery/login regression coverage for issuers with and without trailing slashes, including Authentik-style provider paths and slash-only mismatches.
- Document that deployments must use the exact issuer advertised by their provider.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authentication`: Preserve the configured issuer identifier and accept matching trailing-slash issuers while rejecting discovery and token issuer mismatches.

## Impact

- Production change targets `internal/config/config.go`; existing strict verification in `internal/auth/oidc.go` remains enabled.
- Regression coverage targets `internal/config/config_test.go` and `internal/auth/oidc_flow_test.go` using the existing local provider fixture.
- Update OIDC guidance in `README.md`. No dependency, database schema, API, or deployment infrastructure changes are needed.

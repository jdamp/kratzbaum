## 1. Preserve issuer configuration

- [x] 1.1 Add isolated configuration regression cases in `internal/config/config_test.go` for root and provider-path issuers with no slash, one trailing slash, and multiple trailing slashes; verify trailing-slash cases fail against the current loader with `go test ./internal/config`.
- [x] 1.2 Read `OIDC_ISSUER` verbatim in `internal/config/config.go`, preserving existing validation; verify all configuration cases pass with `go test ./internal/config`.

## 2. Verify discovery and login behavior

- [x] 2.1 Extend the signed local provider fixture in `internal/auth/oidc_flow_test.go` to load configuration through environment variables and exercise slashless and Authentik-style path issuers, with endpoint construction independent of the issuer; verify successful discovery, callback, resolved session issuer, and issuer/subject identity using `go test ./internal/auth`.
- [x] 2.2 Add discovery mismatch cases differing only by a trailing slash in both directions; verify `auth.New` returns a discovery error rather than accepting the provider with `go test ./internal/auth`.
- [x] 2.3 Add signed-token issuer mismatch cases differing only by a trailing slash in both directions; verify unauthorized callbacks and absence of an authenticated session cookie, and retain state, nonce, wrong-issuer, audience, and expiry rejection coverage with `go test ./internal/auth`.

## 3. Document and validate the fix

- [x] 3.1 Update the OIDC guidance in `README.md` to require the exact advertised issuer, including any trailing slash, and show an Authentik-style example; verify it agrees with the authentication delta spec and does not suggest disabling verification.
- [x] 3.2 Run `go test ./...` for integration across configuration, authentication, storage, and HTTP handlers; verify the default SQLite suite passes and report any environment-dependent skipped PostgreSQL cases accurately.

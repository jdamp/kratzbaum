package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-jose/go-jose/v4"
	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

type oidcTestClaims struct {
	Issuer    string   `json:"iss"`
	Audience  []string `json:"aud"`
	Subject   string   `json:"sub"`
	Name      string   `json:"name"`
	Nonce     string   `json:"nonce"`
	IssuedAt  int64    `json:"iat"`
	ExpiresAt int64    `json:"exp"`
}

func TestOIDCAuthorizationCodeFlowValidatesStateNonceIssuerAudienceAndExpiry(t *testing.T) {
	for _, path := range []string{"", "/", "/application/o/kratzbaum", "/application/o/kratzbaum/"} {
		t.Run("issuer="+path, func(t *testing.T) {
			testOIDCAuthorizationCodeFlow(t, path)
		})
	}
}

func loadOIDCTestConfig(t *testing.T, issuer string) config.Config {
	t.Helper()
	for _, key := range []string{"DATABASE_DRIVER", "DATABASE_URL", "APP_TIMEZONE", "MAX_UPLOAD_BYTES", "MAX_IMAGE_PIXELS", "PLANTNET_API_URL"} {
		t.Setenv(key, "")
	}
	t.Setenv("AUTH_MODE", "oidc")
	t.Setenv("OIDC_ISSUER", issuer)
	t.Setenv("OIDC_CLIENT_ID", "kratzbaum-test")
	t.Setenv("OIDC_CLIENT_SECRET", "test-secret")
	t.Setenv("OIDC_REDIRECT_URL", "https://plants.example/auth/callback")
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.OIDCIssuer != issuer {
		t.Fatalf("loaded issuer = %q, want %q", cfg.OIDCIssuer, issuer)
	}
	return cfg
}

func TestOIDCDiscoveryRejectsTrailingSlashMismatch(t *testing.T) {
	for _, configuredPath := range []string{"/application/o/kratzbaum", "/application/o/kratzbaum/"} {
		t.Run("issuer="+configuredPath, func(t *testing.T) {
			var advertisedIssuer string
			provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/application/o/kratzbaum/.well-known/openid-configuration" {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{"issuer": advertisedIssuer})
			}))
			defer provider.Close()
			configuredIssuer := provider.URL + configuredPath
			advertisedIssuer = alternateTrailingSlash(configuredIssuer)
			ctx := oidc.ClientContext(context.Background(), provider.Client())
			manager, err := New(ctx, loadOIDCTestConfig(t, configuredIssuer), nil)
			var mismatch *oidc.IssuerMismatchError
			if manager != nil || !errors.As(err, &mismatch) {
				t.Fatalf("expected discovery issuer mismatch, manager=%v err=%v", manager, err)
			}
			if mismatch.Provided != configuredIssuer || mismatch.Discovered != advertisedIssuer {
				t.Fatalf("unexpected issuer mismatch: %+v", mismatch)
			}
		})
	}
}

func alternateTrailingSlash(issuer string) string {
	if strings.HasSuffix(issuer, "/") {
		return strings.TrimSuffix(issuer, "/")
	}
	return issuer + "/"
}

func testOIDCAuthorizationCodeFlow(t *testing.T, issuerPath string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var issuer, endpointBase string
	claims := oidcTestClaims{Audience: []string{"kratzbaum-test"}, Subject: "keeper-1", Name: "Plant keeper"}
	challenge := ""
	nonce := ""
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case strings.TrimRight(issuerPath, "/") + "/.well-known/openid-configuration":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": endpointBase + "/authorize", "token_endpoint": endpointBase + "/token", "jwks_uri": endpointBase + "/jwks", "response_types_supported": []string{"code"}, "subject_types_supported": []string{"public"}, "id_token_signing_alg_values_supported": []string{"RS256"}})
		case "/jwks":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, Use: "sig", Algorithm: string(jose.RS256)}}})
		case "/authorize":
			challenge, nonce = r.URL.Query().Get("code_challenge"), r.URL.Query().Get("nonce")
			w.WriteHeader(http.StatusOK)
		case "/token":
			if err := r.ParseForm(); err != nil {
				http.Error(w, "form", 400)
				return
			}
			verifier := r.Form.Get("code_verifier")
			digest := sha256.Sum256([]byte(verifier))
			if r.Form.Get("code") != "test-code" || r.Form.Get("client_id") != "kratzbaum-test" || base64.RawURLEncoding.EncodeToString(digest[:]) != challenge {
				http.Error(w, "invalid authorization code exchange", 400)
				return
			}
			if claims.Issuer == "" {
				claims.Issuer = issuer
			}
			if claims.IssuedAt == 0 {
				claims.IssuedAt = time.Now().Unix()
			}
			if claims.ExpiresAt == 0 {
				claims.ExpiresAt = time.Now().Add(time.Hour).Unix()
			}
			if claims.Nonce == "" {
				claims.Nonce = nonce
			}
			payload, _ := json.Marshal(claims)
			signer, signErr := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithType("JWT"))
			if signErr != nil {
				http.Error(w, "signer", 500)
				return
			}
			jwt, signErr := signer.Sign(payload)
			if signErr != nil {
				http.Error(w, "sign", 500)
				return
			}
			raw, _ := jwt.CompactSerialize()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "access", "token_type": "Bearer", "expires_in": 3600, "id_token": raw})
		default:
			http.NotFound(w, r)
		}
	}))
	defer provider.Close()
	endpointBase = provider.URL
	issuer = provider.URL + issuerPath

	dir := t.TempDir()
	store, err := storage.Open(context.Background(), config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "oidc.db"), DataDir: dir, MediaDir: filepath.Join(dir, "media")}, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	ctx := oidc.ClientContext(context.Background(), provider.Client())
	m, err := New(ctx, loadOIDCTestConfig(t, issuer), store)
	if err != nil {
		t.Fatal(err)
	}

	start := func() (*http.Cookie, string) {
		r := httptest.NewRequest(http.MethodGet, "/auth/login", nil)
		w := httptest.NewRecorder()
		m.login(w, r)
		if w.Code != http.StatusFound {
			t.Fatalf("login status=%d", w.Code)
		}
		location, err := url.Parse(w.Header().Get("Location"))
		if err != nil {
			t.Fatal(err)
		}
		response, err := provider.Client().Get(location.String())
		if err != nil {
			t.Fatal(err)
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("authorization endpoint status=%d", response.StatusCode)
		}
		return w.Result().Cookies()[0], location.Query().Get("state")
	}
	callback := func(cookie *http.Cookie, state string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodGet, "/auth/callback?code=test-code&state="+url.QueryEscape(state), nil)
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		m.callback(response, request)
		return response
	}

	cookie, state := start()
	if got := callback(cookie, "forged-state").Code; got != http.StatusBadRequest {
		t.Fatalf("forged state status=%d", got)
	}
	cookie, state = start()
	response := callback(cookie, state)
	if response.Code != http.StatusSeeOther {
		t.Fatalf("valid callback status=%d: %s", response.Code, response.Body.String())
	}
	request := httptest.NewRequest(http.MethodGet, "/api/plants", nil)
	for _, c := range response.Result().Cookies() {
		if c.Name == "kratzbaum_session" {
			request.AddCookie(c)
		}
	}
	identity, err := m.Resolve(request)
	if err != nil {
		t.Fatalf("resolve authenticated session: %v", err)
	}
	if !identity.Authenticated || identity.Issuer != issuer || identity.Subject != "keeper-1" || identity.Key != issuer+"|keeper-1" {
		t.Fatalf("unexpected identity: %+v", identity)
	}

	for _, tc := range []struct {
		name  string
		alter func(*oidcTestClaims)
	}{
		{"wrong nonce", func(c *oidcTestClaims) { c.Nonce = "another-login" }},
		{"wrong issuer", func(c *oidcTestClaims) { c.Issuer = issuer + "/wrong" }},
		{"issuer trailing slash mismatch", func(c *oidcTestClaims) { c.Issuer = alternateTrailingSlash(issuer) }},
		{"wrong audience", func(c *oidcTestClaims) { c.Audience = []string{"another-client"} }},
		{"expired token", func(c *oidcTestClaims) { c.ExpiresAt = time.Now().Add(-time.Hour).Unix() }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims = oidcTestClaims{Audience: []string{"kratzbaum-test"}, Subject: "keeper-1", Name: "Plant keeper"}
			tc.alter(&claims)
			cookie, state := start()
			response := callback(cookie, state)
			if response.Code != http.StatusUnauthorized {
				t.Fatalf("invalid token status=%d", response.Code)
			}
			for _, c := range response.Result().Cookies() {
				if c.Name == "kratzbaum_session" && c.Value != "" {
					t.Fatal("invalid token created an authenticated session cookie")
				}
			}
		})
	}
}

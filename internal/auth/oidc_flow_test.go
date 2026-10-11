package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var issuer string
	claims := oidcTestClaims{Audience: []string{"kratzbaum-test"}, Subject: "keeper-1", Name: "Plant keeper"}
	challenge := ""
	nonce := ""
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/jwks", "response_types_supported": []string{"code"}, "subject_types_supported": []string{"public"}, "id_token_signing_alg_values_supported": []string{"RS256"}})
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
	issuer = provider.URL

	dir := t.TempDir()
	store, err := storage.Open(context.Background(), config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "oidc.db"), DataDir: dir, MediaDir: filepath.Join(dir, "media")}, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	ctx := oidc.ClientContext(context.Background(), provider.Client())
	m, err := New(ctx, config.Config{AuthMode: "oidc", OIDCIssuer: issuer, OIDCClientID: "kratzbaum-test", OIDCClientSecret: "test-secret", OIDCRedirectURL: "https://plants.example/auth/callback", SessionTTL: time.Hour}, store)
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
	if got := callback(cookie, state).Code; got != http.StatusSeeOther {
		t.Fatalf("valid callback status=%d", got)
	}
	if len(strings.TrimSpace(cookie.Value)) == 0 {
		t.Fatal("login state cookie was empty")
	}

	for _, tc := range []struct {
		name  string
		alter func(*oidcTestClaims)
	}{
		{"wrong nonce", func(c *oidcTestClaims) { c.Nonce = "another-login" }},
		{"wrong issuer", func(c *oidcTestClaims) { c.Issuer = issuer + "/wrong" }},
		{"wrong audience", func(c *oidcTestClaims) { c.Audience = []string{"another-client"} }},
		{"expired token", func(c *oidcTestClaims) { c.ExpiresAt = time.Now().Add(-time.Hour).Unix() }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims = oidcTestClaims{Audience: []string{"kratzbaum-test"}, Subject: "keeper-1", Name: "Plant keeper"}
			tc.alter(&claims)
			cookie, state := start()
			if got := callback(cookie, state).Code; got != http.StatusUnauthorized {
				t.Fatalf("invalid token status=%d", got)
			}
		})
	}
}

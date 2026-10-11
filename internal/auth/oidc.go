package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/storage"
	"golang.org/x/oauth2"
)

type Manager struct {
	store            *storage.Store
	verifier         *oidc.IDTokenVerifier
	oauth            oauth2.Config
	issuer, clientID string
	ttl              time.Duration
	secure           bool
	mu               sync.Mutex
	attempts         map[string]attempt
}
type attempt struct {
	verifier, nonce string
	expires         time.Time
}
type Identity struct {
	Key, Issuer, Subject, Name, CSRF string
	Authenticated                    bool
}
type contextKey struct{}

func WithIdentity(ctx context.Context, v Identity) context.Context {
	return context.WithValue(ctx, contextKey{}, v)
}
func FromContext(ctx context.Context) Identity { v, _ := ctx.Value(contextKey{}).(Identity); return v }

func New(ctx context.Context, c config.Config, s *storage.Store) (*Manager, error) {
	if c.AuthMode != "oidc" {
		return nil, nil
	}
	provider, err := oidc.NewProvider(ctx, c.OIDCIssuer)
	if err != nil {
		return nil, fmt.Errorf("discover OIDC provider: %w", err)
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: c.OIDCClientID})
	redirect, _ := url.Parse(c.OIDCRedirectURL)
	secure := redirect.Scheme == "https"
	return &Manager{store: s, verifier: verifier, oauth: oauth2.Config{ClientID: c.OIDCClientID, ClientSecret: c.OIDCClientSecret, Endpoint: provider.Endpoint(), RedirectURL: c.OIDCRedirectURL, Scopes: []string{oidc.ScopeOpenID, "profile", "email"}}, issuer: c.OIDCIssuer, clientID: c.OIDCClientID, ttl: c.SessionTTL, secure: secure, attempts: map[string]attempt{}}, nil
}
func (m *Manager) Register(mux *http.ServeMux) {
	if m == nil {
		return
	}
	mux.HandleFunc("GET /auth/login", m.login)
	mux.HandleFunc("GET /auth/callback", m.callback)
	mux.HandleFunc("POST /auth/logout", m.logout)
}
func (m *Manager) login(w http.ResponseWriter, r *http.Request) {
	state, err := randomToken(32)
	if err != nil {
		http.Error(w, "Unable to start sign-in", 500)
		return
	}
	verifier, err := randomToken(32)
	if err != nil {
		http.Error(w, "Unable to start sign-in", 500)
		return
	}
	nonce, err := randomToken(32)
	if err != nil {
		http.Error(w, "Unable to start sign-in", 500)
		return
	}
	m.mu.Lock()
	m.attempts[storage.HashSecret(state)] = attempt{verifier: verifier, nonce: nonce, expires: time.Now().Add(10 * time.Minute)}
	m.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: "kratzbaum_oidc_state", Value: state, Path: "/auth/callback", MaxAge: 600, HttpOnly: true, Secure: m.secure, SameSite: http.SameSiteLaxMode})
	http.Redirect(w, r, m.oauth.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oauth2.SetAuthURLParam("nonce", nonce)), http.StatusFound)
}
func (m *Manager) callback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	cookie, err := r.Cookie("kratzbaum_oidc_state")
	if err != nil || state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(cookie.Value)) != 1 {
		http.Error(w, "Invalid sign-in state", http.StatusBadRequest)
		return
	}
	m.mu.Lock()
	a, ok := m.attempts[storage.HashSecret(state)]
	delete(m.attempts, storage.HashSecret(state))
	m.mu.Unlock()
	if !ok || time.Now().After(a.expires) {
		http.Error(w, "Sign-in request expired", http.StatusBadRequest)
		return
	}
	if providerErr := r.URL.Query().Get("error"); providerErr != "" {
		http.Error(w, "Sign-in was not completed", http.StatusBadRequest)
		return
	}
	token, err := m.oauth.Exchange(r.Context(), r.URL.Query().Get("code"), oauth2.VerifierOption(a.verifier))
	if err != nil {
		http.Error(w, "Sign-in could not be verified", http.StatusUnauthorized)
		return
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		http.Error(w, "Identity provider returned no ID token", http.StatusUnauthorized)
		return
	}
	idToken, err := m.verifier.Verify(r.Context(), raw)
	if err != nil {
		http.Error(w, "Identity token is invalid", http.StatusUnauthorized)
		return
	}
	var claims struct {
		Subject   string `json:"sub"`
		Name      string `json:"name"`
		Preferred string `json:"preferred_username"`
		Nonce     string `json:"nonce"`
	}
	if err := idToken.Claims(&claims); err != nil || claims.Subject == "" || subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(a.nonce)) != 1 {
		http.Error(w, "Identity token claims are invalid", http.StatusUnauthorized)
		return
	}
	if claims.Name == "" {
		claims.Name = claims.Preferred
	}
	sessionToken, err := randomToken(32)
	if err != nil {
		http.Error(w, "Unable to create session", 500)
		return
	}
	csrf, err := randomToken(32)
	if err != nil {
		http.Error(w, "Unable to create session", 500)
		return
	}
	identity := m.issuer + "|" + claims.Subject
	session := storage.Session{Hash: storage.HashSecret(sessionToken), Identity: identity, Issuer: m.issuer, Subject: claims.Subject, DisplayName: claims.Name, CSRF: csrf, ExpiresAt: time.Now().Add(m.ttl)}
	if err := m.store.SaveSession(r.Context(), session); err != nil {
		http.Error(w, "Unable to create session", 500)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "kratzbaum_session", Value: sessionToken, Path: "/", MaxAge: int(m.ttl.Seconds()), HttpOnly: true, Secure: m.secure, SameSite: http.SameSiteLaxMode})
	clearState(w, m.secure)
	http.Redirect(w, r, "/", http.StatusSeeOther)
}
func (m *Manager) Resolve(r *http.Request) (Identity, error) {
	cookie, err := r.Cookie("kratzbaum_session")
	if err != nil {
		return Identity{}, err
	}
	session, err := m.store.GetSession(r.Context(), storage.HashSecret(cookie.Value))
	if err != nil || time.Now().After(session.ExpiresAt) {
		return Identity{}, errors.New("session expired")
	}
	return Identity{Key: session.Identity, Issuer: session.Issuer, Subject: session.Subject, Name: session.DisplayName, CSRF: session.CSRF, Authenticated: true}, nil
}
func (m *Manager) logout(w http.ResponseWriter, r *http.Request) {
	identity, err := m.Resolve(r)
	if err != nil {
		clearSession(w, m.secure)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	cookie, _ := r.Cookie("kratzbaum_session")
	if err := validateWrite(r, identity); err != nil {
		http.Error(w, "Request could not be verified", http.StatusForbidden)
		return
	}
	_ = m.store.DeleteSession(r.Context(), storage.HashSecret(cookie.Value))
	clearSession(w, m.secure)
	w.WriteHeader(http.StatusNoContent)
}
func validateWrite(r *http.Request, id Identity) error {
	origin, err := url.Parse(r.Header.Get("Origin"))
	if err != nil || origin.Host == "" || !strings.EqualFold(origin.Host, r.Host) {
		return errors.New("cross-origin request")
	}
	csrf := r.Header.Get("X-CSRF-Token")
	if csrf == "" || subtle.ConstantTimeCompare([]byte(csrf), []byte(id.CSRF)) != 1 {
		return errors.New("invalid anti-forgery token")
	}
	return nil
}
func (m *Manager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/auth/") || r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/api/") && !strings.HasPrefix(r.URL.Path, "/media/") {
			next.ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/api/bootstrap" {
			identity, _ := m.Resolve(r)
			next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
			return
		}
		identity, err := m.Resolve(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Sign in is required", "login_url": "/auth/login"})
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
			if err := validateWrite(r, identity); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "Request could not be verified"})
				return
			}
		}
		next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
	})
}
func randomToken(size int) (string, error) {
	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func clearSession(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{Name: "kratzbaum_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode})
}
func clearState(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{Name: "kratzbaum_oidc_state", Value: "", Path: "/auth/callback", MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode})
}

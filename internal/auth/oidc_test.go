package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

func TestOIDCMiddlewareAndLogout(t *testing.T) {
	dir := t.TempDir()
	store, err := storage.Open(context.Background(), config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "auth.db"), DataDir: dir, MediaDir: filepath.Join(dir, "media")}, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	const token = "opaque-session-token"
	session := storage.Session{Hash: storage.HashSecret(token), Identity: "issuer|subject", Issuer: "issuer", Subject: "subject", DisplayName: "Plant keeper", CSRF: "anti-forgery", ExpiresAt: time.Now().Add(time.Hour)}
	if err := store.SaveSession(context.Background(), session); err != nil {
		t.Fatal(err)
	}
	m := &Manager{store: store, secure: true}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	handler := m.Middleware(next)
	request := httptest.NewRequest(http.MethodGet, "/api/plants", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous API status %d", response.Code)
	}
	request = httptest.NewRequest(http.MethodGet, "/media/photo-id/original.jpg", nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous media status %d", response.Code)
	}
	request = httptest.NewRequest(http.MethodPost, "/api/plants", nil)
	request.Host = "plants.example"
	request.Header.Set("Origin", "https://plants.example")
	request.Header.Set("X-CSRF-Token", session.CSRF)
	request.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: token})
	if _, err := m.Resolve(request); err != nil {
		t.Fatalf("resolve persisted session: %v", err)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("valid session write status %d: %s", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodPost, "/api/plants", nil)
	request.Host = "plants.example"
	request.Header.Set("Origin", "https://attacker.example")
	request.Header.Set("X-CSRF-Token", session.CSRF)
	request.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: token})
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("cross-site write status %d", response.Code)
	}
	request = httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	request.Host = "plants.example"
	request.Header.Set("Origin", "https://plants.example")
	request.Header.Set("X-CSRF-Token", session.CSRF)
	request.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: token})
	response = httptest.NewRecorder()
	m.logout(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("logout status %d", response.Code)
	}
	if _, err := store.GetSession(context.Background(), session.Hash); err == nil {
		t.Fatal("session row survived logout")
	}
	if _, err := m.Resolve(request); err == nil {
		t.Fatal("logged-out cookie still resolved to an identity")
	}
}

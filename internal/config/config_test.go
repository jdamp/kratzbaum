package config

import (
	"os"
	"strings"
	"testing"
)

func TestDefaults(t *testing.T) {
	for _, key := range []string{"AUTH_MODE", "DATABASE_DRIVER", "DATABASE_URL", "APP_TIMEZONE", "DATA_DIR", "MEDIA_DIR", "MAX_UPLOAD_BYTES", "MAX_IMAGE_PIXELS", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URL"} {
		t.Setenv(key, "")
	}
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() with defaults: %v", err)
	}
	if cfg.AuthMode != "no" || cfg.DatabaseDriver != "sqlite" || cfg.Timezone != "UTC" || cfg.DatabaseURL != "data/kratzbaum.db" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestPreservesOIDCIssuer(t *testing.T) {
	for _, issuer := range []string{
		"https://auth.example.com",
		"https://auth.example.com/",
		"https://auth.example.com///",
		"https://auth.example.com/application/o/kratzbaum",
		"https://auth.example.com/application/o/kratzbaum/",
		"https://auth.example.com/application/o/kratzbaum///",
	} {
		t.Run(issuer, func(t *testing.T) {
			for _, key := range []string{"DATABASE_DRIVER", "DATABASE_URL", "APP_TIMEZONE", "MAX_UPLOAD_BYTES", "MAX_IMAGE_PIXELS", "PLANTNET_API_URL"} {
				t.Setenv(key, "")
			}
			t.Setenv("AUTH_MODE", "oidc")
			t.Setenv("OIDC_ISSUER", issuer)
			t.Setenv("OIDC_CLIENT_ID", "test-client")
			t.Setenv("OIDC_CLIENT_SECRET", "test-secret")
			t.Setenv("OIDC_REDIRECT_URL", "https://plants.example/auth/callback")
			cfg, err := Load()
			if err != nil {
				t.Fatal(err)
			}
			if cfg.OIDCIssuer != issuer {
				t.Fatalf("issuer = %q, want %q", cfg.OIDCIssuer, issuer)
			}
		})
	}
}

func TestRejectsInvalidRuntimeConfiguration(t *testing.T) {
	for _, tc := range []struct{ key, value, contains string }{
		{"AUTH_MODE", "password", "AUTH_MODE"},
		{"DATABASE_DRIVER", "memory", "DATABASE_DRIVER"},
		{"APP_TIMEZONE", "Planet/Mordor", "APP_TIMEZONE"},
		{"MAX_UPLOAD_BYTES", "not-an-integer", "MAX_UPLOAD_BYTES"},
		{"AUTH_MODE", "oidc", "OIDC_ISSUER"},
		{"DATABASE_DRIVER", "postgres", "DATABASE_URL"},
		{"PLANTNET_API_URL", "http://example.org/identify", "PLANTNET_API_URL"},
		{"OIDC_REDIRECT_URL", "https://plants.example/callback", "OIDC_REDIRECT_URL path"},
	} {
		t.Run(tc.key+"="+tc.value, func(t *testing.T) {
			for _, key := range []string{"AUTH_MODE", "DATABASE_DRIVER", "DATABASE_URL", "APP_TIMEZONE", "MAX_UPLOAD_BYTES", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URL"} {
				if err := os.Unsetenv(key); err != nil {
					t.Fatal(err)
				}
				t.Setenv(key, "")
			}
			t.Setenv(tc.key, tc.value)
			if tc.key == "OIDC_REDIRECT_URL" {
				t.Setenv("AUTH_MODE", "oidc")
				t.Setenv("OIDC_ISSUER", "https://idp.example")
				t.Setenv("OIDC_CLIENT_ID", "test-client")
				t.Setenv("OIDC_CLIENT_SECRET", "test-secret")
				t.Setenv("OIDC_REDIRECT_URL", tc.value)
			}
			_, err := Load()
			if err == nil || !strings.Contains(err.Error(), tc.contains) {
				t.Fatalf("Load() error = %v, wanted message containing %q", err, tc.contains)
			}
		})
	}
}

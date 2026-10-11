package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ListenAddress     string
	DatabaseDriver    string
	DatabaseURL       string
	DataDir           string
	MediaDir          string
	Timezone          string
	AuthMode          string
	OIDCIssuer        string
	OIDCClientID      string
	OIDCClientSecret  string
	OIDCRedirectURL   string
	PlantNetKey       string
	PlantNetURL       string
	HEIFDecoder       string
	MaxUploadBytes    int64
	MaxImagePixels    int64
	ReadHeaderTimeout time.Duration
	SessionTTL        time.Duration
}

func Load() (Config, error) {
	c := Config{
		ListenAddress:     env("LISTEN_ADDR", ":8080"),
		DatabaseDriver:    strings.ToLower(env("DATABASE_DRIVER", "sqlite")),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		DataDir:           env("DATA_DIR", "./data"),
		MediaDir:          env("MEDIA_DIR", "./data/media"),
		Timezone:          env("APP_TIMEZONE", "UTC"),
		AuthMode:          strings.ToLower(env("AUTH_MODE", "no")),
		OIDCIssuer:        strings.TrimRight(os.Getenv("OIDC_ISSUER"), "/"),
		OIDCClientID:      os.Getenv("OIDC_CLIENT_ID"),
		OIDCClientSecret:  os.Getenv("OIDC_CLIENT_SECRET"),
		OIDCRedirectURL:   os.Getenv("OIDC_REDIRECT_URL"),
		PlantNetKey:       os.Getenv("PLANTNET_API_KEY"),
		PlantNetURL:       env("PLANTNET_API_URL", "https://my-api.plantnet.org/v2/identify/all"),
		HEIFDecoder:       env("HEIF_CONVERT", "heif-convert"),
		ReadHeaderTimeout: 5 * time.Second,
		SessionTTL:        12 * time.Hour,
	}
	var err error
	if c.MaxUploadBytes, err = envInt64("MAX_UPLOAD_BYTES", 20<<20); err != nil {
		return Config{}, err
	}
	if c.MaxImagePixels, err = envInt64("MAX_IMAGE_PIXELS", 24_000_000); err != nil {
		return Config{}, err
	}
	if c.MaxUploadBytes < 1024 || c.MaxUploadBytes > 50<<20 {
		return Config{}, fmt.Errorf("MAX_UPLOAD_BYTES must be between 1 KiB and 50 MiB")
	}
	if c.MaxImagePixels < 1 || c.MaxImagePixels > 100_000_000 {
		return Config{}, fmt.Errorf("MAX_IMAGE_PIXELS must be between 1 and 100 million")
	}
	if _, err := time.LoadLocation(c.Timezone); err != nil {
		return Config{}, fmt.Errorf("APP_TIMEZONE must be a valid IANA timezone: %w", err)
	}
	if c.AuthMode != "no" && c.AuthMode != "oidc" {
		return Config{}, fmt.Errorf("AUTH_MODE must be one of: no, oidc")
	}
	if c.DatabaseDriver != "sqlite" && c.DatabaseDriver != "postgres" && c.DatabaseDriver != "postgresql" {
		return Config{}, fmt.Errorf("DATABASE_DRIVER must be one of: sqlite, postgres")
	}
	if c.DatabaseDriver != "sqlite" && c.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required when DATABASE_DRIVER=postgres")
	}
	if c.DatabaseDriver != "sqlite" {
		dsn, parseErr := url.Parse(c.DatabaseURL)
		if parseErr != nil || dsn.Scheme != "postgres" && dsn.Scheme != "postgresql" || dsn.Host == "" {
			return Config{}, fmt.Errorf("DATABASE_URL must be a valid postgres:// or postgresql:// connection URL")
		}
	}
	if c.AuthMode == "oidc" {
		if c.OIDCIssuer == "" || c.OIDCClientID == "" || c.OIDCClientSecret == "" || c.OIDCRedirectURL == "" {
			return Config{}, fmt.Errorf("AUTH_MODE=oidc requires OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URL")
		}
		issuer, issuerErr := url.Parse(c.OIDCIssuer)
		redirect, redirectErr := url.Parse(c.OIDCRedirectURL)
		if issuerErr != nil || redirectErr != nil || issuer.Scheme != "https" && issuer.Hostname() != "localhost" && issuer.Hostname() != "127.0.0.1" || redirect.Scheme != "https" && redirect.Hostname() != "localhost" && redirect.Hostname() != "127.0.0.1" || redirect.Host == "" {
			return Config{}, fmt.Errorf("OIDC issuer and callback must be valid HTTPS URLs (localhost is allowed for development)")
		}
		if redirect.Path != "/auth/callback" {
			return Config{}, fmt.Errorf("OIDC_REDIRECT_URL path must be /auth/callback")
		}
	}
	if c.DatabaseDriver == "sqlite" && c.DatabaseURL == "" {
		c.DatabaseURL = filepath.Join(c.DataDir, "kratzbaum.db")
	}
	plantnet, plantErr := url.Parse(c.PlantNetURL)
	if plantErr != nil || plantnet.Host == "" || (plantnet.Scheme != "https" && plantnet.Hostname() != "localhost" && plantnet.Hostname() != "127.0.0.1") {
		return Config{}, fmt.Errorf("PLANTNET_API_URL must be an HTTPS URL (localhost is allowed for development)")
	}
	return c, nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt64(key string, fallback int64) (int64, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return parsed, nil
}

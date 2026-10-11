package main

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/auth"
	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/httpapi"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

//go:embed all:web/dist
var frontend embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(2)
	}
	decoderPath, err := exec.LookPath(cfg.HEIFDecoder)
	if err != nil {
		slog.Error("configured HEIC decoder is unavailable", "decoder", cfg.HEIFDecoder)
		os.Exit(2)
	}
	cfg.HEIFDecoder = decoderPath

	loc, err := time.LoadLocation(cfg.Timezone)
	if err != nil {
		slog.Error("load timezone", "error", err)
		os.Exit(2)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	store, err := storage.Open(ctx, cfg, loc)
	if err != nil {
		slog.Error("initialize storage", "error", err)
		os.Exit(1)
	}
	defer store.Close()
	var authManager *auth.Manager
	if cfg.AuthMode == "oidc" {
		providerCtx, providerCancel := context.WithTimeout(ctx, 15*time.Second)
		authManager, err = auth.New(providerCtx, cfg, store)
		providerCancel()
		if err != nil {
			slog.Error("initialize OIDC", "error", err)
			os.Exit(1)
		}
	}
	root, err := fs.Sub(frontend, "web/dist")
	if err != nil {
		slog.Error("load frontend assets", "error", err)
		os.Exit(1)
	}
	assets := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			name = "index.html"
		}
		f, err := root.Open(name)
		if err != nil {
			http.ServeFileFS(w, r, root, "index.html")
			return
		}
		_ = f.Close()
		http.FileServer(http.FS(root)).ServeHTTP(w, r)
	})
	api := (&httpapi.Server{Store: store, Config: cfg, Location: loc, Assets: assets, Auth: authManager}).Handler()
	server := &http.Server{
		Addr:              cfg.ListenAddress,
		Handler:           api,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      2 * time.Minute,
		IdleTimeout:       90 * time.Second,
	}
	slog.Info("kratzbaum configuration loaded", "listen", server.Addr, "auth", cfg.AuthMode, "database", cfg.DatabaseDriver)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server stopped", "error", err)
			cancel()
		}
	}()
	<-ctx.Done()
	shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	if err := server.Shutdown(shutdown); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

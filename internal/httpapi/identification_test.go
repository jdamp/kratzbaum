package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

func identificationFixture(t *testing.T, upstream http.HandlerFunc) (*Server, http.Handler) {
	t.Helper()
	provider := httptest.NewServer(upstream)
	t.Cleanup(provider.Close)
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "db.sqlite"), MediaDir: filepath.Join(dir, "media"), DataDir: dir, AuthMode: "no", PlantNetKey: "private-identification-key", PlantNetURL: provider.URL, MaxUploadBytes: 1 << 20, MaxImagePixels: 10000}
	store, err := storage.Open(context.Background(), cfg, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	s := &Server{Store: store, Config: cfg, Location: time.UTC}
	return s, s.Handler()
}

func identificationRequest(api http.Handler, path, key, filename string, data []byte) *httptest.ResponseRecorder {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if filename != "" {
		part, _ := w.CreateFormFile("image", filename)
		_, _ = part.Write(data)
	}
	_ = w.Close()
	r := httptest.NewRequest(http.MethodPost, path, &body)
	r.Header.Set("Content-Type", w.FormDataContentType())
	r.Header.Set("Idempotency-Key", key)
	result := httptest.NewRecorder()
	api.ServeHTTP(result, r)
	return result
}

func identificationPNG(t *testing.T) []byte {
	t.Helper()
	var data bytes.Buffer
	if err := png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 8, 8))); err != nil {
		t.Fatal(err)
	}
	return data.Bytes()
}

func TestDraftIdentificationDoesNotWriteCatalogueAndIsOneShot(t *testing.T) {
	var calls atomic.Int32
	entered, release := make(chan struct{}, 1), make(chan struct{})
	_, api := identificationFixture(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		file, header, err := r.FormFile("images")
		if err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		defer file.Close()
		if header.Header.Get("Content-Type") != "image/jpeg" {
			t.Error("provider image MIME is not JPEG")
		}
		if _, err := jpeg.Decode(file); err != nil {
			t.Error(err)
		}
		entered <- struct{}{}
		<-release
		_, _ = io.WriteString(w, `{"results":[{"score":0.9,"species":{"scientificNameWithoutAuthor":"Monstera deliciosa","commonNames":["Swiss cheese plant"]}}]}`)
	})
	data := identificationPNG(t)
	completed := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		completed <- identificationRequest(api, "/api/identifications", "draft-attempt-key", "leaf.png", data)
	}()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("provider was not called")
	}
	duplicate := identificationRequest(api, "/api/identifications", "draft-attempt-key", "leaf.png", data)
	close(release)
	first := <-completed
	if duplicate.Code != 409 || first.Code != 200 {
		t.Fatalf("first=%d duplicate=%d", first.Code, duplicate.Code)
	}
	replayed := identificationRequest(api, "/api/identifications", "draft-attempt-key", "leaf.png", data)
	if replayed.Code != 200 || replayed.Body.String() != first.Body.String() || calls.Load() != 1 {
		t.Fatalf("replay=%d calls=%d", replayed.Code, calls.Load())
	}
	if strings.Contains(first.Body.String(), "private-identification-key") {
		t.Fatal("key exposed")
	}
	read := httptest.NewRecorder()
	api.ServeHTTP(read, httptest.NewRequest(http.MethodGet, "/api/plants", nil))
	if !strings.Contains(read.Body.String(), `"plants":[]`) {
		t.Fatalf("identification wrote catalogue: %s", read.Body)
	}
}

func TestSavedPhotoIdentificationUsesOriginalAndRejectsBadSources(t *testing.T) {
	var calls atomic.Int32
	var received []byte
	s, api := identificationFixture(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		file, _, _ := r.FormFile("images")
		defer file.Close()
		received, _ = io.ReadAll(file)
		_, _ = io.WriteString(w, `{"results":[{"score":0.9,"species":{"scientificNameWithoutAuthor":"Monstera deliciosa"}}]}`)
	})
	p := storage.Plant{ID: storage.NewID(), Name: "Unknown", CareStartDate: "2026-01-01", WateringIntervalDays: 7}
	if err := s.Store.SavePlant(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	upload := identificationRequest(api, "/api/plants/"+p.ID+"/photos", "", "leaf.png", identificationPNG(t))
	if upload.Code != 201 {
		t.Fatalf("upload: %s", upload.Body)
	}
	photos, _ := s.Store.ListPhotos(context.Background(), p.ID)
	photo := photos[0]
	original, _ := os.ReadFile(s.Store.MediaFile(photo, false))
	s.Config.MaxUploadBytes = 256 // Stored normalized JPEG is larger than its PNG source.
	if len(original) <= 256 {
		t.Fatal("fixture must exceed upload limit")
	}
	path := "/api/plants/" + p.ID + "/photos/" + photo.ID + "/identify"
	result := identificationRequest(api, path, "saved-photo-attempt", "", nil)
	if result.Code != 200 || !bytes.Equal(received, original) {
		t.Fatalf("saved original: %d %s", result.Code, result.Body)
	}
	other := p
	other.ID = storage.NewID()
	if err := s.Store.SavePlant(context.Background(), other); err != nil {
		t.Fatal(err)
	}
	for _, badPath := range []string{
		"/api/plants/" + other.ID + "/photos/" + photo.ID + "/identify",
		"/api/plants/" + p.ID + "/photos/" + storage.NewID() + "/identify",
	} {
		if response := identificationRequest(api, badPath, "bad-source-attempt", "", nil); response.Code != 404 {
			t.Fatalf("bad source: %d", response.Code)
		}
	}
	if err := os.WriteFile(s.Store.MediaFile(photo, false), original[:len(original)/2], 0600); err != nil {
		t.Fatal(err)
	}
	if result := identificationRequest(api, path, "corrupt-source-attempt", "", nil); result.Code != 400 {
		t.Fatalf("corrupt photo: %d", result.Code)
	}
	if err := os.Remove(s.Store.MediaFile(photo, false)); err != nil {
		t.Fatal(err)
	}
	if result := identificationRequest(api, path, "missing-file-attempt", "", nil); result.Code != 400 {
		t.Fatalf("missing file: %d", result.Code)
	}
	if calls.Load() != 1 {
		t.Fatalf("invalid sources called provider: %d", calls.Load())
	}
	photos, _ = s.Store.ListPhotos(context.Background(), p.ID)
	activities, _ := s.Store.ListActivities(context.Background(), p.ID)
	saved, _ := s.Store.GetPlant(context.Background(), p.ID)
	if len(photos) != 1 || len(activities) != 1 || saved.CoverPhotoID != photo.ID || saved.ScientificName != "" {
		t.Fatal("identification modified catalogue")
	}
}

func TestIdentificationValidationAndFailureStates(t *testing.T) {
	for _, tc := range []struct {
		name           string
		status         int
		response, code string
	}{
		{"no match", 200, `{"results":[]}`, "plantnet_no_match"},
		{"quota", 429, "provider-body private-identification-key", "plantnet_quota"},
		{"rejected query", 400, "provider-body private-identification-key", "plantnet_request_rejected"},
		{"rejected input", 422, "provider-body private-identification-key", "plantnet_request_rejected"},
		{"unauthorized", 401, "provider-body private-identification-key", "plantnet_auth"},
		{"forbidden", 403, "provider-body private-identification-key", "plantnet_auth"},
		{"no match status", 404, "provider-body private-identification-key", "plantnet_no_match"},
		{"invalid response", 200, "provider-body private-identification-key", "plantnet_invalid_response"},
		{"unavailable", 502, "private-identification-key", "plantnet_unavailable"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			var logs bytes.Buffer
			previous := slog.Default()
			slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
			defer slog.SetDefault(previous)
			s, api := identificationFixture(t, func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.response)
			})
			invalid := identificationRequest(api, "/api/identifications", "invalid-image-key", "bad.png", []byte("not an image"))
			if invalid.Code != 400 || calls.Load() != 0 {
				t.Fatal("invalid input reached provider")
			}
			data := identificationPNG(t)
			result := identificationRequest(api, "/api/identifications", "failure-attempt-key", "leaf.png", data)
			if result.Code != 200 || !strings.Contains(result.Body.String(), tc.code) || strings.Contains(result.Body.String(), "private-identification-key") {
				t.Fatalf("failure result: %d %s", result.Code, result.Body)
			}
			logBefore := logs.String()
			replayed := identificationRequest(api, "/api/identifications", "failure-attempt-key", "leaf.png", data)
			if replayed.Body.String() != result.Body.String() || logs.String() != logBefore {
				t.Fatal("replayed result or diagnostics differ")
			}
			var event map[string]any
			if err := json.Unmarshal(logs.Bytes(), &event); err != nil {
				t.Fatalf("expected one structured event: %v", err)
			}
			var response map[string]any
			_ = json.Unmarshal(result.Body.Bytes(), &response)
			if event["attempt_id"] != response["attempt_id"] || event["failure_code"] != tc.code || event["upstream_status"] != float64(tc.status) {
				t.Fatalf("missing diagnostics: %v", event)
			}
			for _, private := range []string{"private-identification-key", "provider-body", "api-key=", "http://", "failure-attempt-key", fmt.Sprint(data)} {
				if strings.Contains(logs.String()+result.Body.String(), private) {
					t.Fatal("private data in logs or response")
				}
			}
			if calls.Load() != 1 {
				t.Fatal("failure replayed upstream")
			}
			s.Config.PlantNetKey = ""
			if missing := identificationRequest(api, "/api/identifications", "no-config-attempt", "leaf.png", data); missing.Code != 503 || calls.Load() != 1 {
				t.Fatal("missing key reached provider")
			}
		})
	}
}

func TestDraftIdentificationNormalizesSupportedFormats(t *testing.T) {
	var calls atomic.Int32
	s, api := identificationFixture(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		file, header, err := r.FormFile("images")
		if err != nil {
			t.Error(err)
			return
		}
		defer file.Close()
		if header.Header.Get("Content-Type") != "image/jpeg" {
			t.Error("wrong image MIME")
		}
		if _, err := jpeg.Decode(file); err != nil {
			t.Error(err)
		}
		_, _ = io.WriteString(w, `{"results":[{"score":0.9,"species":{"scientificNameWithoutAuthor":"Monstera deliciosa"}}]}`)
	})
	var jpg bytes.Buffer
	if err := jpeg.Encode(&jpg, image.NewRGBA(image.Rect(0, 0, 8, 8)), nil); err != nil {
		t.Fatal(err)
	}
	webp, err := os.ReadFile("../media/testdata/leaf.webp")
	if err != nil {
		t.Fatal(err)
	}
	// Isolate the decoder contract without requiring libheif in unit tests.
	// The runtime smoke target exercises the real HEIC converter.
	decoder := filepath.Join(t.TempDir(), "decode-heic")
	pngPath := decoder + ".png"
	if err := os.WriteFile(pngPath, identificationPNG(t), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(decoder, []byte("#!/bin/sh\ncp \"$0.png\" \"$2\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	s.Config.HEIFDecoder = decoder
	for _, input := range []struct {
		name string
		data []byte
	}{
		{"plant.jpg", jpg.Bytes()}, {"plant.png", identificationPNG(t)}, {"plant.webp", webp}, {"plant.heic", []byte("decoder fixture")},
	} {
		result := identificationRequest(api, "/api/identifications", "format-attempt-"+input.name, input.name, input.data)
		if result.Code != 200 || !strings.Contains(result.Body.String(), "succeeded") {
			t.Fatalf("%s: %d %s", input.name, result.Code, result.Body)
		}
	}
	if calls.Load() != 4 {
		t.Fatalf("format requests=%d", calls.Load())
	}
}

func TestIdentificationTransportFailureLogsAreSafe(t *testing.T) {
	for _, category := range []string{"connection", "tls"} {
		t.Run(category, func(t *testing.T) {
			var logs bytes.Buffer
			previous := slog.Default()
			slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
			defer slog.SetDefault(previous)
			s, api := identificationFixture(t, func(w http.ResponseWriter, _ *http.Request) { t.Error("unexpected provider request") })
			if category == "connection" {
				closed := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
				s.Config.PlantNetURL = closed.URL
				closed.Close()
			} else {
				untrusted := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Error("unexpected TLS request") }))
				defer untrusted.Close()
				untrusted.Config.ErrorLog = log.New(io.Discard, "", 0)
				s.Config.PlantNetURL = untrusted.URL
			}
			result := identificationRequest(api, "/api/identifications", "transport-attempt", "leaf.png", identificationPNG(t))
			var event map[string]any
			if err := json.Unmarshal(logs.Bytes(), &event); err != nil {
				t.Fatal(err)
			}
			var response map[string]any
			_ = json.Unmarshal(result.Body.Bytes(), &response)
			if event["transport"] != category || event["failure_code"] != "plantnet_unavailable" || event["attempt_id"] != response["attempt_id"] {
				t.Fatalf("unexpected diagnostics: %v", event)
			}
			if _, ok := event["upstream_status"]; ok {
				t.Fatal("transport failure has an HTTP status")
			}
			for _, secret := range []string{s.Config.PlantNetKey, s.Config.PlantNetURL, "transport-attempt", "api-key="} {
				if strings.Contains(logs.String()+result.Body.String(), secret) {
					t.Fatal("unsafe diagnostics")
				}
			}
		})
	}
}

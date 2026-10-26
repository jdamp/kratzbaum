package httpapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/kratzbaum/kratzbaum/internal/auth"
	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

func TestPlantAndCareAPI(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "db.sqlite"), DataDir: dir, MediaDir: filepath.Join(dir, "media"), AuthMode: "no", Timezone: "UTC", MaxUploadBytes: 1 << 20, MaxImagePixels: 10000}
	runPlantAndCareAPI(t, cfg)
}

func TestPlantAndCareAPIPostgres(t *testing.T) {
	connection := os.Getenv("KRATZBAUM_TEST_POSTGRES_URL")
	if connection == "" {
		t.Skip("set KRATZBAUM_TEST_POSTGRES_URL to a disposable database ending in _test")
	}
	parsed, err := url.Parse(connection)
	if err != nil || !strings.HasSuffix(strings.ToLower(strings.TrimPrefix(parsed.Path, "/")), "_test") {
		t.Fatal("refusing to run PostgreSQL API integration tests unless database name ends in _test")
	}
	admin, err := sql.Open("pgx", connection)
	if err != nil {
		t.Fatal("open disposable PostgreSQL API database")
	}
	defer admin.Close()
	schema := "kratzbaum_api_test_" + strings.ReplaceAll(storage.NewID(), "-", "")
	if _, err := admin.Exec(`CREATE SCHEMA "` + schema + `"`); err != nil {
		t.Fatal("create isolated PostgreSQL API schema")
	}
	defer func() { _, _ = admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`) }()
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "postgres", DatabaseURL: parsed.String(), DataDir: dir, MediaDir: filepath.Join(dir, "media"), AuthMode: "no", Timezone: "UTC", MaxUploadBytes: 1 << 20, MaxImagePixels: 10000}
	runPlantAndCareAPI(t, cfg)
}

func TestAuthenticatedUsersShareCollectionAndActorAttribution(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "shared.db"), DataDir: dir, MediaDir: filepath.Join(dir, "media"), AuthMode: "oidc", Timezone: "UTC", MaxUploadBytes: 1 << 20, MaxImagePixels: 10000}
	store, err := storage.Open(context.Background(), cfg, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	plant := storage.Plant{Name: "Shared fern", CareStartDate: "2026-01-01", WateringIntervalDays: 7}
	if err := store.SavePlant(context.Background(), plant); err != nil {
		t.Fatal(err)
	}
	plants, err := store.ListPlants(context.Background(), "")
	if err != nil || len(plants) != 1 {
		t.Fatalf("load shared collection fixture: %v %#v", err, plants)
	}
	plant = plants[0]
	users := []storage.Session{
		{Hash: storage.HashSecret("session-user-one"), Identity: "issuer|user-one", Issuer: "issuer", Subject: "user-one", DisplayName: "User One", CSRF: "csrf-user-one", ExpiresAt: time.Now().Add(time.Hour)},
		{Hash: storage.HashSecret("session-user-two"), Identity: "issuer|user-two", Issuer: "issuer", Subject: "user-two", DisplayName: "User Two", CSRF: "csrf-user-two", ExpiresAt: time.Now().Add(time.Hour)},
	}
	for _, user := range users {
		if err := store.SaveSession(context.Background(), user); err != nil {
			t.Fatal(err)
		}
	}
	var issuer string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/openid-configuration" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/jwks", "response_types_supported": []string{"code"}, "subject_types_supported": []string{"public"}, "id_token_signing_alg_values_supported": []string{"RS256"}})
	}))
	defer provider.Close()
	issuer = provider.URL
	manager, err := auth.New(oidc.ClientContext(context.Background(), provider.Client()), config.Config{AuthMode: "oidc", OIDCIssuer: issuer, OIDCClientID: "kratzbaum-test", OIDCClientSecret: "oidc-client-secret", OIDCRedirectURL: "https://plants.example/auth/callback", SessionTTL: time.Hour}, store)
	if err != nil {
		t.Fatal(err)
	}
	api := (&Server{Store: store, Config: cfg, Location: time.UTC, Auth: manager}).Handler()
	for _, path := range []string{"/api/rooms", "/api/identifications", "/api/plants/" + plant.ID + "/photos/" + storage.NewID() + "/identify"} {
		for _, authenticated := range []bool{false, true} {
			req := httptest.NewRequest(http.MethodPost, path, nil)
			req.Host = "plants.example"
			req.Header.Set("Origin", "https://plants.example")
			if authenticated {
				req.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: "session-user-one"})
			}
			result := httptest.NewRecorder()
			api.ServeHTTP(result, req)
			want := 401
			if authenticated {
				want = 403
			}
			if result.Code != want {
				t.Fatalf("identification auth/CSRF %s: got %d want %d", path, result.Code, want)
			}
		}
	}
	for index, session := range users {
		token := []string{"session-user-one", "session-user-two"}[index]
		r := httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
		r.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: token})
		w := httptest.NewRecorder()
		api.ServeHTTP(w, r)
		var data map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &data) != nil || data["authenticated"] != true || data["display_name"] != session.DisplayName {
			t.Fatalf("user bootstrap: %d %s", w.Code, w.Body.String())
		}
		for _, secret := range []string{"oidc-client-secret", "plantnet-private-key", token} {
			if strings.Contains(w.Body.String(), secret) {
				t.Fatalf("bootstrap leaked a secret for %s", session.Subject)
			}
		}
		r = httptest.NewRequest(http.MethodGet, "/api/plants", nil)
		r.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: token})
		w = httptest.NewRecorder()
		api.ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "Shared fern") {
			t.Fatalf("shared collection for %s: %d %s", session.Subject, w.Code, w.Body.String())
		}
	}
	updated := `{"name":"Shared fern revised","care_start_date":"2026-01-01","watering_interval_days":9}`
	r := httptest.NewRequest(http.MethodPut, "/api/plants/"+plant.ID, strings.NewReader(updated))
	r.Host = "plants.example"
	r.Header.Set("Origin", "https://plants.example")
	r.Header.Set("X-CSRF-Token", users[0].CSRF)
	r.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: "session-user-one"})
	w := httptest.NewRecorder()
	api.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("shared plant edit failed: %d %s", w.Code, w.Body.String())
	}
	r = httptest.NewRequest(http.MethodPost, "/api/plants/"+plant.ID+"/activities", strings.NewReader(`{"type":"note","occurred_at":"2026-10-09T09:00:00Z","note":"Actor note"}`))
	r.Host = "plants.example"
	r.Header.Set("Origin", "https://plants.example")
	r.Header.Set("X-CSRF-Token", users[0].CSRF)
	r.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: "session-user-one"})
	w = httptest.NewRecorder()
	api.ServeHTTP(w, r)
	if w.Code != 201 || !strings.Contains(w.Body.String(), `"actor_name":"User One"`) {
		t.Fatalf("actor attribution: %d %s", w.Code, w.Body.String())
	}
	r = httptest.NewRequest(http.MethodGet, "/api/plants/"+plant.ID, nil)
	r.AddCookie(&http.Cookie{Name: "kratzbaum_session", Value: "session-user-two"})
	w = httptest.NewRecorder()
	api.ServeHTTP(w, r)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Shared fern revised") || !strings.Contains(w.Body.String(), "User One") {
		t.Fatalf("second user did not see shared changes: %d %s", w.Code, w.Body.String())
	}
}

func runPlantAndCareAPI(t *testing.T, cfg config.Config) {
	t.Helper()
	loc := time.UTC
	store, err := storage.Open(context.Background(), cfg, loc)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	newAPI := func(store *storage.Store) http.Handler {
		return (&Server{Store: store, Config: cfg, Location: loc, Assets: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(200)
			_, _ = w.Write([]byte(`<div id="root"></div>`))
		})}).Handler()
	}
	api := newAPI(store)
	runCareRoomsAPI(t, api, store)
	payload := `{"name":"Kitchen fern","scientific_name":"Nephrolepis","care_start_date":"2026-09-01","watering_interval_days":9,"summer_fertilizing_interval_days":14,"winter_fertilizing_interval_days":40}`
	req := httptest.NewRequest(http.MethodPost, "/api/plants", strings.NewReader(payload))
	res := httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 201 {
		t.Fatalf("create status %d: %s", res.Code, res.Body.String())
	}
	var p storage.Plant
	if err := json.Unmarshal(res.Body.Bytes(), &p); err != nil || p.ID == "" {
		t.Fatalf("plant response missing ID: %v %#v", err, p)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/today", nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 || !strings.Contains(res.Body.String(), p.ID) || !strings.Contains(res.Body.String(), "watering") {
		t.Fatalf("today did not include due plant: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodPost, "/api/plants/"+p.ID+"/activities", strings.NewReader(`{"type":"watering","occurred_at":"2026-10-05T09:00:00Z","note":""}`))
	req.Header.Set("Idempotency-Key", "backdate-event-001")
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 201 {
		t.Fatalf("dated care event failed: %d %s", res.Code, res.Body.String())
	}
	var event storage.Activity
	if err := json.Unmarshal(res.Body.Bytes(), &event); err != nil || event.ID == "" {
		t.Fatalf("care event ID missing: %v", err)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/plants/"+p.ID+"/activities", strings.NewReader(`{"type":"watering","occurred_at":"2026-10-05T09:00:00Z","note":""}`))
	req.Header.Set("Idempotency-Key", "backdate-event-001")
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	var repeated storage.Activity
	if err := json.Unmarshal(res.Body.Bytes(), &repeated); err != nil || repeated.ID != event.ID {
		t.Fatalf("duplicate activity submission was not idempotent: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodPut, "/api/activities/"+event.ID, strings.NewReader(`{"occurred_at":"2026-09-29T09:00:00Z","note":"Corrected date"}`))
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 {
		t.Fatalf("activity correction failed: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodDelete, "/api/activities/"+event.ID, nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 204 {
		t.Fatalf("activity deletion failed: %d", res.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/today", nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if !strings.Contains(res.Body.String(), "2026-09-10") {
		t.Fatalf("deleting latest care did not restore the care-start anchor: %s", res.Body.String())
	}
	var invalidForm bytes.Buffer
	invalidWriter := multipart.NewWriter(&invalidForm)
	invalidPart, _ := invalidWriter.CreateFormFile("image", "invalid.png")
	_, _ = invalidPart.Write([]byte("not an image"))
	_ = invalidWriter.Close()
	req = httptest.NewRequest(http.MethodPost, "/api/plants/"+p.ID+"/photos", &invalidForm)
	req.Header.Set("Content-Type", invalidWriter.FormDataContentType())
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 400 {
		t.Fatalf("invalid photo status=%d: %s", res.Code, res.Body.String())
	}
	plantBeforePhoto, err := store.GetPlant(context.Background(), p.ID)
	if err != nil || plantBeforePhoto.CoverPhotoID != "" {
		t.Fatalf("failed upload changed cover photo: %#v %v", plantBeforePhoto, err)
	}
	activitiesBeforePhoto, err := store.ListActivities(context.Background(), p.ID)
	if err != nil || len(activitiesBeforePhoto) != 0 {
		t.Fatalf("failed upload created a photo activity: %#v %v", activitiesBeforePhoto, err)
	}
	var imageBytes bytes.Buffer
	if err := png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 16, 16))); err != nil {
		t.Fatal(err)
	}
	var form bytes.Buffer
	multipartWriter := multipart.NewWriter(&form)
	part, _ := multipartWriter.CreateFormFile("image", "plant.png")
	_, _ = part.Write(imageBytes.Bytes())
	_ = multipartWriter.Close()
	req = httptest.NewRequest(http.MethodPost, "/api/plants/"+p.ID+"/photos", &form)
	req.Header.Set("Content-Type", multipartWriter.FormDataContentType())
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 201 {
		t.Fatalf("photo upload failed: %d %s", res.Code, res.Body.String())
	}
	var photo storage.Photo
	if err := json.Unmarshal(res.Body.Bytes(), &photo); err != nil || photo.ID == "" {
		t.Fatalf("invalid photo response %#v: %v", photo, err)
	}
	if _, err := os.Stat(store.MediaFile(photo, false)); err != nil {
		t.Fatalf("normalized photo was not persisted: %v", err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	store, err = storage.Open(context.Background(), cfg, loc)
	if err != nil {
		t.Fatalf("reopen storage after photo upload: %v", err)
	}
	api = newAPI(store)
	req = httptest.NewRequest(http.MethodGet, "/api/plants/"+p.ID+"/photos", nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 || !strings.Contains(res.Body.String(), photo.ID) {
		t.Fatalf("photo metadata missing after restart: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/media/"+photo.ID+"/original.jpg", nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 || !bytes.HasPrefix(res.Body.Bytes(), []byte{0xff, 0xd8, 0xff}) {
		t.Fatalf("persisted original was not readable after restart: %d %q", res.Code, res.Body.Bytes()[:min(3, res.Body.Len())])
	}
	req = httptest.NewRequest(http.MethodPut, "/api/plants/"+p.ID+"/cover", strings.NewReader(`{"photo_id":"`+photo.ID+`"}`))
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 {
		t.Fatalf("set cover failed: %d %s", res.Code, res.Body.String())
	}
	saved, err := store.GetPlant(context.Background(), p.ID)
	if err != nil || saved.CoverPhotoID != photo.ID {
		t.Fatalf("cover selection was not persisted: %#v %v", saved, err)
	}
	req = httptest.NewRequest(http.MethodDelete, "/api/plants/"+p.ID+"/photos/"+photo.ID, nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 204 {
		t.Fatalf("photo removal failed: %d %s", res.Code, res.Body.String())
	}
	if _, err := os.Stat(store.MediaFile(photo, false)); !os.IsNotExist(err) {
		t.Fatalf("deleted photo file remains: %v", err)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/calendar?month=2026-09", nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 || !strings.Contains(res.Body.String(), "activities") {
		t.Fatalf("calendar read failed: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/plants/"+p.ID, nil)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 200 || !strings.Contains(res.Body.String(), "id=\"root\"") {
		t.Fatalf("detail-route shell fallback failed: %d", res.Code)
	}
	for _, path := range []string{"/api/missing", "/media/not-an-id/original.jpg"} {
		req = httptest.NewRequest(http.MethodGet, path, nil)
		res = httptest.NewRecorder()
		api.ServeHTTP(res, req)
		if res.Code != 404 || strings.Contains(res.Header().Get("Content-Type"), "text/html") {
			t.Errorf("unknown route %s returned %d %s", path, res.Code, res.Header().Get("Content-Type"))
		}
	}
	bad := bytes.NewBufferString(`{"name":"","care_start_date":"bad","watering_interval_days":0}`)
	req = httptest.NewRequest(http.MethodPost, "/api/plants", bad)
	res = httptest.NewRecorder()
	api.ServeHTTP(res, req)
	if res.Code != 400 {
		t.Errorf("invalid plant status %d", res.Code)
	}
}

func TestExplicitPlantNetIdentificationIsOneShot(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Query().Get("api-key") != "secret-test-key" {
			t.Errorf("api key missing from upstream request")
		}
		file, _, err := r.FormFile("images")
		if err != nil {
			t.Errorf("missing normalized image: %v", err)
			return
		}
		defer file.Close()
		head := make([]byte, 3)
		_, _ = file.Read(head)
		if !bytes.Equal(head, []byte{0xff, 0xd8, 0xff}) {
			t.Errorf("PlantNet did not receive JPEG bytes: %v", head)
		}
		_, _ = io.WriteString(w, `{"results":[{"score":0.91,"species":{"scientificNameWithoutAuthor":"Monstera deliciosa","commonNames":["Swiss cheese plant"]}}]}`)
	}))
	defer upstream.Close()
	dir := t.TempDir()
	cfg := config.Config{DatabaseDriver: "sqlite", DatabaseURL: filepath.Join(dir, "db.sqlite"), DataDir: dir, MediaDir: filepath.Join(dir, "media"), AuthMode: "no", Timezone: "UTC", PlantNetKey: "secret-test-key", PlantNetURL: upstream.URL, MaxUploadBytes: 1 << 20, MaxImagePixels: 10000}
	store, err := storage.Open(context.Background(), cfg, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	plant := storage.Plant{Name: "Unknown plant", CareStartDate: "2026-01-01", WateringIntervalDays: 7}
	if err := store.SavePlant(context.Background(), plant); err != nil {
		t.Fatal(err)
	}
	plants, err := store.ListPlants(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	id := plants[0].ID
	if _, _, err := store.BeginIdentification(context.Background(), "direct-test-key"); err != nil {
		t.Fatalf("begin durable attempt: %v", err)
	}
	var pngData bytes.Buffer
	if err := png.Encode(&pngData, image.NewRGBA(image.Rect(0, 0, 8, 8))); err != nil {
		t.Fatal(err)
	}
	api := (&Server{Store: store, Config: cfg, Location: time.UTC}).Handler()
	var ordinary bytes.Buffer
	ordinaryWriter := multipart.NewWriter(&ordinary)
	ordinaryPart, _ := ordinaryWriter.CreateFormFile("image", "leaf.png")
	_, _ = ordinaryPart.Write(pngData.Bytes())
	_ = ordinaryWriter.Close()
	ordinaryRequest := httptest.NewRequest(http.MethodPost, "/api/plants/"+id+"/photos", &ordinary)
	ordinaryRequest.Header.Set("Content-Type", ordinaryWriter.FormDataContentType())
	ordinaryResponse := httptest.NewRecorder()
	api.ServeHTTP(ordinaryResponse, ordinaryRequest)
	if ordinaryResponse.Code != 201 || calls.Load() != 0 {
		t.Fatalf("ordinary photo upload invoked identification: status=%d calls=%d", ordinaryResponse.Code, calls.Load())
	}
	request := func() *httptest.ResponseRecorder {
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		part, _ := mw.CreateFormFile("image", "plant.png")
		_, _ = part.Write(pngData.Bytes())
		_ = mw.Close()
		req := httptest.NewRequest(http.MethodPost, "/api/plants/"+id+"/photos/identify", &body)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req.Header.Set("Idempotency-Key", "attempt-123456")
		res := httptest.NewRecorder()
		api.ServeHTTP(res, req)
		return res
	}
	first := request()
	if first.Code != 200 || !strings.Contains(first.Body.String(), "Monstera deliciosa") || strings.Contains(first.Body.String(), cfg.PlantNetKey) {
		t.Fatalf("identify failed: %d %s", first.Code, first.Body.String())
	}
	second := request()
	if second.Code != 200 || calls.Load() != 1 {
		t.Fatalf("duplicate attempt retried upstream: status=%d calls=%d body=%s", second.Code, calls.Load(), second.Body.String())
	}
	saved, err := store.GetPlant(context.Background(), id)
	if err != nil || saved.ScientificName != "" {
		t.Fatalf("identification changed species before confirmation: %#v %v", saved, err)
	}
}

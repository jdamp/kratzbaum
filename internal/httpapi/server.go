package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/auth"
	"github.com/kratzbaum/kratzbaum/internal/care"
	"github.com/kratzbaum/kratzbaum/internal/config"
	"github.com/kratzbaum/kratzbaum/internal/media"
	"github.com/kratzbaum/kratzbaum/internal/storage"
)

type Server struct {
	Store    *storage.Store
	Config   config.Config
	Location *time.Location
	Assets   http.Handler
	Auth     *auth.Manager
}

var idPattern = regexp.MustCompile(`^[a-f0-9-]{36}$`)

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { jsonOut(w, 200, map[string]any{"status": "ok"}) })
	mux.HandleFunc("GET /api/bootstrap", s.bootstrap)
	mux.HandleFunc("GET /api/plants", s.plants)
	mux.HandleFunc("POST /api/plants", s.plants)
	mux.HandleFunc("GET /api/plants/{id}", s.plant)
	mux.HandleFunc("PUT /api/plants/{id}", s.plant)
	mux.HandleFunc("DELETE /api/plants/{id}", s.plant)
	mux.HandleFunc("GET /api/plants/{id}/activities", s.activities)
	mux.HandleFunc("POST /api/plants/{id}/activities", s.activities)
	mux.HandleFunc("GET /api/plants/{id}/photos", s.photos)
	mux.HandleFunc("POST /api/plants/{id}/photos", s.photos)
	mux.HandleFunc("DELETE /api/plants/{id}/photos/{photoID}", s.deletePhoto)
	mux.HandleFunc("PUT /api/plants/{id}/cover", s.setCover)
	mux.HandleFunc("POST /api/identifications", s.identify)
	mux.HandleFunc("POST /api/plants/{id}/photos/identify", s.identify)
	mux.HandleFunc("POST /api/plants/{id}/photos/{photoID}/identify", s.identifySavedPhoto)
	mux.HandleFunc("GET /media/{id}/{filename}", s.serveMedia)
	mux.HandleFunc("DELETE /api/activities/{id}", s.deleteActivity)
	mux.HandleFunc("PUT /api/activities/{id}", s.updateActivity)
	mux.HandleFunc("GET /api/today", s.today)
	mux.HandleFunc("GET /api/calendar", s.calendar)
	if s.Assets != nil {
		mux.Handle("/", s.spa(s.Assets))
	}
	if s.Auth != nil {
		s.Auth.Register(mux)
		return recoverer(s.Auth.Middleware(mux))
	}
	return recoverer(mux)
}
func (s *Server) bootstrap(w http.ResponseWriter, r *http.Request) {
	identity := auth.FromContext(r.Context())
	authenticated := s.Config.AuthMode == "no" || identity.Authenticated
	key, name, csrf := "shared", "", ""
	if identity.Authenticated {
		key, name, csrf = storage.HashSecret(identity.Key)[:32], identity.Name, identity.CSRF
	}
	jsonOut(w, 200, map[string]any{"name": "kratzbaum", "auth_mode": s.Config.AuthMode, "authenticated": authenticated, "identity": key, "display_name": name, "csrf_token": csrf, "login_url": "/auth/login", "plantnet_available": s.Config.PlantNetKey != "", "timezone": s.Config.Timezone, "offline": false})
}
func (s *Server) plants(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		list, err := s.Store.ListPlants(r.Context(), r.URL.Query().Get("q"))
		if err != nil {
			fail(w, 500, "Could not load plants")
			return
		}
		jsonOut(w, 200, map[string]any{"plants": list})
		return
	}
	var in storage.Plant
	if !decode(w, r, &in) {
		return
	}
	if err := validPlant(in); err != "" {
		fail(w, 400, err)
		return
	}
	in.ID = storage.NewID()
	if err := s.Store.SavePlant(r.Context(), in); err != nil {
		fail(w, 500, "Could not save plant")
		return
	}
	jsonOut(w, 201, in)
}
func (s *Server) plant(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		fail(w, 400, "Invalid plant ID")
		return
	}
	if r.Method == http.MethodGet {
		p, err := s.Store.GetPlant(r.Context(), id)
		if err != nil {
			fail(w, 404, "Plant not found")
			return
		}
		activities, _ := s.Store.ListActivities(r.Context(), id)
		jsonOut(w, 200, map[string]any{"plant": p, "activities": activities})
		return
	}
	if r.Method == http.MethodDelete {
		photos, _ := s.Store.ListPhotos(r.Context(), id)
		if err := s.Store.DeletePlant(r.Context(), id); err != nil {
			fail(w, 404, "Plant not found")
			return
		}
		for _, photo := range photos {
			_ = os.Remove(s.Store.MediaFile(photo, false))
			_ = os.Remove(s.Store.MediaFile(photo, true))
		}
		w.WriteHeader(204)
		return
	}
	var in storage.Plant
	if !decode(w, r, &in) {
		return
	}
	if err := validPlant(in); err != "" {
		fail(w, 400, err)
		return
	}
	in.ID = id
	if err := s.Store.SavePlant(r.Context(), in); err != nil {
		fail(w, 500, "Could not update plant")
		return
	}
	jsonOut(w, 200, in)
}
func (s *Server) activities(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		fail(w, 400, "Invalid plant ID")
		return
	}
	if r.Method == http.MethodGet {
		a, err := s.Store.ListActivities(r.Context(), id)
		if err != nil {
			fail(w, 500, "Could not load timeline")
			return
		}
		jsonOut(w, 200, map[string]any{"activities": a})
		return
	}
	var input struct {
		Type       string    `json:"type"`
		OccurredAt time.Time `json:"occurred_at"`
		Note       string    `json:"note"`
	}
	if !decode(w, r, &input) {
		return
	}
	if input.Type != "watering" && input.Type != "fertilizing" && input.Type != "note" {
		fail(w, 400, "Activity type must be watering, fertilizing, or note")
		return
	}
	if input.Type == "note" && strings.TrimSpace(input.Note) == "" {
		fail(w, 400, "Care note cannot be empty")
		return
	}
	if input.OccurredAt.IsZero() {
		input.OccurredAt = time.Now()
	}
	actor := auth.FromContext(r.Context())
	actorName := actor.Name
	if actorName == "" {
		actorName = "Shared collection"
	}
	a, err := s.Store.AddActivity(r.Context(), storage.Activity{PlantID: id, Type: input.Type, OccurredAt: input.OccurredAt, Note: strings.TrimSpace(input.Note)}, r.Header.Get("Idempotency-Key"), actor.Issuer, actor.Subject, actorName)
	if err != nil {
		fail(w, 500, "Could not save activity")
		return
	}
	jsonOut(w, 201, a)
}
func (s *Server) deleteActivity(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		fail(w, 400, "Invalid activity ID")
		return
	}
	if err := s.Store.DeleteActivity(r.Context(), id); err != nil {
		fail(w, 404, "Activity not found")
		return
	}
	w.WriteHeader(204)
}
func (s *Server) updateActivity(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		fail(w, 400, "Invalid activity ID")
		return
	}
	var input struct {
		OccurredAt time.Time `json:"occurred_at"`
		Note       string    `json:"note"`
	}
	if !decode(w, r, &input) {
		return
	}
	if input.OccurredAt.IsZero() {
		fail(w, 400, "Activity date and time are required")
		return
	}
	if len(input.Note) > 4000 {
		fail(w, 400, "Activity note is too long")
		return
	}
	if err := s.Store.UpdateActivity(r.Context(), id, input.OccurredAt, strings.TrimSpace(input.Note)); err != nil {
		fail(w, 404, "Activity not found")
		return
	}
	jsonOut(w, 200, map[string]any{"id": id, "occurred_at": input.OccurredAt, "note": strings.TrimSpace(input.Note)})
}

func (s *Server) photos(w http.ResponseWriter, r *http.Request) {
	plantID := r.PathValue("id")
	if !idPattern.MatchString(plantID) {
		fail(w, 400, "Invalid plant ID")
		return
	}
	if _, err := s.Store.GetPlant(r.Context(), plantID); err != nil {
		fail(w, 404, "Plant not found")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.Store.ListPhotos(r.Context(), plantID)
		if err != nil {
			fail(w, 500, "Could not load photos")
			return
		}
		for i := range items {
			items[i].Filename = "/media/" + items[i].ID + "/thumb.jpg"
		}
		jsonOut(w, 200, map[string]any{"photos": items})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, s.Config.MaxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(s.Config.MaxUploadBytes); err != nil {
		fail(w, 400, "Upload exceeds the configured size limit")
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		fail(w, 400, "Choose an image to upload")
		return
	}
	defer file.Close()
	result, err := media.Normalize(r.Context(), file, header.Filename, s.Config.MaxUploadBytes, s.Config.MaxImagePixels, s.Config.HEIFDecoder, filepath.Join(s.Config.MediaDir, ".tmp"))
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	id := storage.NewID()
	original := filepath.Join(s.Config.MediaDir, id+".jpg")
	thumb := filepath.Join(s.Config.MediaDir, id+"_thumb.jpg")
	if err := writeMedia(original, result.Original); err != nil {
		fail(w, 500, "Could not store image")
		return
	}
	if err := writeMedia(thumb, result.Thumbnail); err != nil {
		_ = os.Remove(original)
		fail(w, 500, "Could not store image thumbnail")
		return
	}
	actor := auth.FromContext(r.Context())
	actorName := actor.Name
	if actorName == "" {
		actorName = "Shared collection"
	}
	photo, err := s.Store.SavePhoto(r.Context(), id, plantID, filepath.Base(header.Filename), result.Width, result.Height, actor.Issuer, actor.Subject, actorName)
	if err != nil {
		_ = os.Remove(original)
		_ = os.Remove(thumb)
		fail(w, 500, "Could not save photo")
		return
	}
	photo.Filename = "/media/" + photo.ID + "/thumb.jpg"
	jsonOut(w, 201, photo)
}

func failCode(w http.ResponseWriter, status int, code, message string) {
	jsonOut(w, status, map[string]string{"error": message, "code": code})
}
func identificationMessage(code string) string {
	switch code {
	case "plantnet_not_configured":
		return "PlantNet identification is not configured"
	case "plantnet_no_match":
		return "PlantNet found no likely species"
	case "plantnet_quota":
		return "PlantNet quota is exhausted"
	case "plantnet_timeout":
		return "PlantNet did not respond in time"
	default:
		return "PlantNet service is unavailable"
	}
}
func writeMedia(path string, data []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".stage-*.tmp")
	if err != nil {
		return err
	}
	temp := f.Name()
	defer os.Remove(temp)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(temp, path)
}
func (s *Server) serveMedia(w http.ResponseWriter, r *http.Request) {
	id, filename := r.PathValue("id"), r.PathValue("filename")
	if !idPattern.MatchString(id) || (filename != "thumb.jpg" && filename != "original.jpg") {
		http.NotFound(w, r)
		return
	}
	p, err := s.Store.GetPhoto(r.Context(), id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	path := s.Store.MediaFile(p, filename == "thumb.jpg")
	http.ServeFile(w, r, path)
}
func (s *Server) setCover(w http.ResponseWriter, r *http.Request) {
	plantID := r.PathValue("id")
	var input struct {
		PhotoID string `json:"photo_id"`
	}
	if !idPattern.MatchString(plantID) || !decode(w, r, &input) {
		return
	}
	if input.PhotoID != "" && !idPattern.MatchString(input.PhotoID) {
		fail(w, 400, "Invalid photo ID")
		return
	}
	if err := s.Store.SetCover(r.Context(), plantID, input.PhotoID); err != nil {
		fail(w, 400, "Photo does not belong to this plant")
		return
	}
	jsonOut(w, 200, map[string]any{"plant_id": plantID, "photo_id": input.PhotoID})
}
func (s *Server) deletePhoto(w http.ResponseWriter, r *http.Request) {
	plantID, photoID := r.PathValue("id"), r.PathValue("photoID")
	if !idPattern.MatchString(plantID) || !idPattern.MatchString(photoID) {
		fail(w, 400, "Invalid photo ID")
		return
	}
	photo, err := s.Store.DeletePhoto(r.Context(), plantID, photoID)
	if err != nil {
		fail(w, 404, "Photo not found")
		return
	}
	_ = os.Remove(s.Store.MediaFile(photo, false))
	_ = os.Remove(s.Store.MediaFile(photo, true))
	w.WriteHeader(204)
}
func (s *Server) today(w http.ResponseWriter, r *http.Request) {
	now := time.Now().In(s.Location)
	all, err := s.calculateDue(r.Context(), now)
	if err != nil {
		fail(w, 500, "Could not load care schedule")
		return
	}
	due, next := []map[string]any{}, []map[string]any{}
	for _, item := range all {
		if item["days_until"].(int) > 0 {
			next = append(next, item)
		} else {
			due = append(due, item)
		}
	}
	jsonOut(w, 200, map[string]any{"date": now.Format("2006-01-02"), "computed_at": time.Now().UTC(), "timezone": s.Config.Timezone, "season": care.Season(now), "due": due, "next": next})
}

func (s *Server) calculateDue(ctx context.Context, now time.Time) ([]map[string]any, error) {
	plants, err := s.Store.ListPlants(ctx, "")
	if err != nil {
		return nil, err
	}
	var due []map[string]any
	for _, p := range plants {
		acts, activityErr := s.Store.ListActivities(ctx, p.ID)
		if activityErr != nil {
			return nil, activityErr
		}
		var water, feed *time.Time
		for i := range acts {
			a := &acts[i]
			switch a.Type {
			case "watering":
				if water == nil {
					water = &a.OccurredAt
				}
			case "fertilizing":
				if feed == nil {
					feed = &a.OccurredAt
				}
			}
		}
		start, _ := time.ParseInLocation("2006-01-02", p.CareStartDate, s.Location)
		items := care.Calculate(care.PlantSchedule{CareStart: start, WaterDays: p.WateringIntervalDays, SummerFeedDays: p.SummerFertilizingIntervalDays, WinterFeedDays: p.WinterFertilizingIntervalDays, SummerFeedPaused: p.SummerFertilizingPaused, WinterFeedPaused: p.WinterFertilizingPaused, LastWater: water, LastFeed: feed}, now, s.Location)
		for _, d := range items {
			diff := calendarDayDiff(now, d.DueAt, s.Location)
			due = append(due, map[string]any{"plant_id": p.ID, "plant_name": p.Name, "type": d.Type, "due_date": d.DueAt, "days_overdue": max(0, diff), "days_until": max(0, -diff)})
		}
	}
	sort.SliceStable(due, func(i, j int) bool {
		left := due[i]["due_date"].(time.Time)
		right := due[j]["due_date"].(time.Time)
		return left.Before(right)
	})
	return due, nil
}

func calendarDayDiff(now, due time.Time, loc *time.Location) int {
	ny, nm, nd := now.In(loc).Date()
	dy, dm, dd := due.In(loc).Date()
	today := time.Date(ny, nm, nd, 0, 0, 0, 0, time.UTC)
	dueDate := time.Date(dy, dm, dd, 0, 0, 0, 0, time.UTC)
	return int(today.Sub(dueDate).Hours() / 24)
}

func (s *Server) calendar(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	first, err := time.ParseInLocation("2006-01", month, s.Location)
	if err != nil {
		fail(w, 400, "Month must use YYYY-MM")
		return
	}
	start := time.Date(first.Year(), first.Month(), 1, 0, 0, 0, 0, s.Location)
	end := start.AddDate(0, 1, 0)
	activities, err := s.Store.ListCalendarActivities(r.Context(), start, end)
	if err != nil {
		fail(w, 500, "Could not load calendar")
		return
	}
	due, err := s.calculateDue(r.Context(), time.Now().In(s.Location))
	if err != nil {
		fail(w, 500, "Could not load care schedule")
		return
	}
	monthDue := []map[string]any{}
	for _, item := range due {
		if at, ok := item["due_date"].(time.Time); ok && !at.Before(start) && at.Before(end) {
			monthDue = append(monthDue, item)
		}
	}
	jsonOut(w, 200, map[string]any{"month": month, "timezone": s.Config.Timezone, "activities": activities, "due": monthDue})
}
func validPlant(p storage.Plant) string {
	if strings.TrimSpace(p.Name) == "" || len(p.Name) > 120 {
		return "Plant name is required and must be under 120 characters"
	}
	if _, err := time.Parse("2006-01-02", p.CareStartDate); err != nil {
		return "Care start date must use YYYY-MM-DD"
	}
	if p.WateringIntervalDays < 1 || p.WateringIntervalDays > 365 {
		return "Watering interval must be between 1 and 365 days"
	}
	for _, v := range []*int{p.SummerFertilizingIntervalDays, p.WinterFertilizingIntervalDays} {
		if v != nil && (*v < 1 || *v > 365) {
			return "Fertilizing intervals must be between 1 and 365 days"
		}
	}
	return ""
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		fail(w, 400, "Invalid request body")
		return false
	}
	if d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "Request must contain one JSON value")
		return false
	}
	return true
}
func jsonOut(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string) {
	jsonOut(w, status, map[string]string{"error": msg})
}
func (s *Server) spa(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/media/") {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("request panic", "error", v)
				fail(w, 500, "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

var _ = errors.Is

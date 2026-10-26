package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kratzbaum/kratzbaum/internal/storage"
)

func runCareRoomsAPI(t *testing.T, api http.Handler, store *storage.Store) {
	t.Helper()
	call := func(method, path string, body any, status int) map[string]any {
		t.Helper()
		data, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, strings.NewReader(string(data)))
		if method == "POST" && strings.HasSuffix(path, "/activities") {
			req.Header.Set("Idempotency-Key", "room-"+string(data))
		}
		res := httptest.NewRecorder()
		api.ServeHTTP(res, req)
		if res.Code != status {
			t.Fatalf("%s %s: %d want %d: %s", method, path, res.Code, status, res.Body.String())
		}
		var result map[string]any
		if status != 204 {
			if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	room := call("POST", "/api/rooms", map[string]any{"name": " Arbeitszimmer "}, 201)
	roomID := room["id"].(string)
	if room["name"] != "Arbeitszimmer" {
		t.Fatal(room)
	}
	call("POST", "/api/rooms", map[string]any{"name": "ARBEITSZIMMER"}, 400)
	for _, name := range []string{" ", strings.Repeat("ä", 121)} {
		call("POST", "/api/rooms", map[string]any{"name": name}, 400)
	}
	call("PUT", "/api/rooms/bad", map[string]any{"name": "Room"}, 400)
	call("PUT", "/api/rooms/"+storage.NewID(), map[string]any{"name": "Missing"}, 404)
	call("DELETE", "/api/rooms/"+storage.NewID(), nil, 404)
	room = call("PUT", "/api/rooms/"+roomID, map[string]any{"name": "Wohnzimmer"}, 200)
	if room["name"] != "Wohnzimmer" {
		t.Fatal(room)
	}
	if rooms := call("GET", "/api/rooms", nil, 200)["rooms"].([]any); len(rooms) != 1 {
		t.Fatal(rooms)
	}
	payload := map[string]any{"name": "Unstarted fern", "watering_interval_days": 7, "summer_fertilizing_interval_days": 14, "winter_fertilizing_interval_days": 28, "room_id": roomID}
	p := call("POST", "/api/plants", payload, 201)
	id := p["id"].(string)
	t.Cleanup(func() {
		_ = store.DeletePlant(context.Background(), id)
		_ = store.DeleteRoom(context.Background(), roomID)
	})
	if p["care_start_date"] != "" || p["room_id"] != roomID {
		t.Fatal(p)
	}
	path := "/api/plants/" + id
	items := func(key string) []map[string]any {
		t.Helper()
		today := call("GET", "/api/today", nil, 200)
		result := []map[string]any{}
		for _, item := range today[key].([]any) {
			m := item.(map[string]any)
			if m["plant_id"] == id {
				result = append(result, m)
			}
		}
		return result
	}
	if got := items("not_started"); len(got) != 2 || got[0]["room_id"] != roomID || got[0]["due_date"] != nil || got[0]["days_overdue"] != nil {
		t.Fatalf("not started: %#v", got)
	}
	if len(items("due"))+len(items("next")) != 0 {
		t.Fatal("fabricated deadlines")
	}
	for _, item := range call("GET", "/api/calendar?month=2026-06", nil, 200)["due"].([]any) {
		if item.(map[string]any)["plant_id"] == id {
			t.Fatal("undated schedule in calendar")
		}
	}
	call("POST", path+"/activities", map[string]any{"type": "note", "note": "No care yet", "occurred_at": "2026-06-01T12:00:00Z"}, 201)
	photo, err := store.SavePhoto(context.Background(), storage.NewID(), id, "cover.jpg", 2, 2, "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if got := items("not_started"); len(got) != 2 || got[0]["photo_url"] != "/media/"+photo.ID+"/thumb.jpg" {
		t.Fatalf("photo metadata/anchor: %#v", got)
	}
	// Species confirmation reads the latest plant and sends it back with species
	// fields changed. New optional fields must survive that existing client flow.
	species := call("GET", path, nil, 200)["plant"].(map[string]any)
	species["scientific_name"] = "Monstera deliciosa"
	species["common_name"] = "Swiss cheese plant"
	confirmed := call("PUT", path, species, 200)
	if confirmed["room_id"] != roomID || confirmed["care_start_date"] != "" {
		t.Fatal("species confirmation lost room or anchor state", confirmed)
	}
	if current := call("GET", path, nil, 200)["plant"].(map[string]any); current["cover_photo_id"] != photo.ID {
		t.Fatal("species confirmation lost cover", current)
	}
	activityInput := map[string]any{"type": "watering", "occurred_at": "2026-06-08T12:00:00Z"}
	activity := call("POST", path+"/activities", activityInput, 201)
	duplicate := call("POST", path+"/activities", activityInput, 201)
	if activity["id"] != duplicate["id"] {
		t.Fatal("duplicate care")
	}
	if got := items("not_started"); len(got) != 1 || got[0]["type"] != "fertilizing" {
		t.Fatal(got)
	}
	if got := items("due"); len(got) != 1 || !strings.HasPrefix(got[0]["due_date"].(string), "2026-06-15") {
		t.Fatal(got)
	}
	activityPath := "/api/activities/" + activity["id"].(string)
	call("PUT", activityPath, map[string]any{"occurred_at": "2026-06-09T12:00:00Z"}, 200)
	if got := items("due"); len(got) != 1 || !strings.HasPrefix(got[0]["due_date"].(string), "2026-06-16") {
		t.Fatal(got)
	}
	call("DELETE", activityPath, nil, 204)
	if len(items("not_started")) != 2 {
		t.Fatal("deleting sole care did not return to not started")
	}
	// Older clients can omit date and room without losing saved values.
	payload["care_start_date"] = "2026-06-01"
	call("PUT", path, payload, 200)
	delete(payload, "room_id")
	delete(payload, "care_start_date")
	p = call("PUT", path, payload, 200)
	if p["room_id"] != roomID || p["care_start_date"] != "2026-06-01" {
		t.Fatal(p)
	}
	payload["care_start_date"] = ""
	payload["room_id"] = nil
	call("PUT", path, payload, 200)
	if len(items("not_started")) != 2 {
		t.Fatal("clear date failed")
	}
	payload["care_start_date"] = "bad"
	call("PUT", path, payload, 400)
	payload["care_start_date"] = ""
	payload["room_id"] = storage.NewID()
	call("PUT", path, payload, 400)
	payload["room_id"] = "bad"
	call("PUT", path, payload, 400)
	payload["room_id"] = roomID
	payload["summer_fertilizing_paused"] = true
	payload["winter_fertilizing_paused"] = true
	call("PUT", path, payload, 200)
	if got := items("not_started"); len(got) != 1 || got[0]["type"] != "watering" {
		t.Fatal(got)
	}
	call("DELETE", "/api/rooms/"+roomID, nil, 204)
	current := call("GET", path, nil, 200)
	saved := current["plant"].(map[string]any)
	if saved["room_id"] != nil || saved["cover_photo_id"] != photo.ID || len(current["activities"].([]any)) != 2 {
		t.Fatal("room deletion damaged plant", current)
	}
	payload["room_id"] = roomID
	call("PUT", path, payload, 400)
}

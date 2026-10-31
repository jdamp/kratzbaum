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

func TestWikipediaURL(t *testing.T) {
	for _, value := range []string{"http://de.wikipedia.org/wiki/Fern", "javascript:alert(1)", "https://de.wikipedia.org.evil.test/wiki/Fern", "https://user@de.wikipedia.org/wiki/Fern", "https://de.wikipedia.org:444/wiki/Fern", "https://de.wikipedia.org/wiki/", "https://de.wikipedia.org/w/index.php", "https://de.wikipedia.org/wiki/Fern?x=1", "https://de.wikipedia.org/wiki/Fern?", "https://de.wikipedia.org/wiki/%0aFern"} {
		if _, err := normalizeWikipediaURL(value); err == nil {
			t.Errorf("accepted %q", value)
		}
	}
	for input, want := range map[string]string{
		"": "", "  ": "",
		" https://de.m.wikipedia.org:443/wiki/Schwertfarne#Pflege ":  "https://de.wikipedia.org/wiki/Schwertfarne#Pflege",
		"https://en.wikipedia.org/wiki/Fern":                         "https://en.wikipedia.org/wiki/Fern",
		"https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt": "https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt",
	} {
		if got, err := normalizeWikipediaURL(input); err != nil || got != want {
			t.Errorf("normalize %q: %q %v", input, got, err)
		}
	}
}

// Called by the existing SQLite and PostgreSQL API contract runners.
func runWikipediaAPI(t *testing.T, api http.Handler, store *storage.Store) {
	t.Helper()
	call := func(method, path, body string, status int) map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		api.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		if w.Code != status {
			t.Fatalf("%s %s: %d %s", method, path, w.Code, w.Body.String())
		}
		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	p := call("POST", "/api/plants", `{"name":"Reference fern","watering_interval_days":7}`, 201)
	id := p["id"].(string)
	t.Cleanup(func() { _ = store.DeletePlant(context.Background(), id) })
	path := "/api/plants/" + id
	if p["wikipedia_url"] != "" {
		t.Fatal("new plant lost automatic default", p)
	}
	const manual = "https://de.wikipedia.org/wiki/Schwertfarne#Pflege"
	p = call("PUT", path, `{"name":"Reference fern","watering_interval_days":7,"wikipedia_url":" https://de.m.wikipedia.org/wiki/Schwertfarne#Pflege "}`, 200)
	if p["wikipedia_url"] != manual {
		t.Fatal("override not normalized", p)
	}
	p = call("PUT", path, `{"name":"Updated reference fern","scientific_name":"Nephrolepis exaltata","watering_interval_days":7}`, 200)
	if p["wikipedia_url"] != manual {
		t.Fatal("omitted override lost", p)
	}
	for _, value := range []string{"javascript:alert(1)", "https://evil.test/wiki/Fern"} {
		body, _ := json.Marshal(map[string]any{"name": "Must not save", "watering_interval_days": 9, "wikipedia_url": value})
		err := call("PUT", path, string(body), 400)
		if !strings.Contains(err["error"].(string), "HTTPS-Artikellink") {
			t.Fatal(err)
		}
	}
	p = call("GET", path, "", 200)["plant"].(map[string]any)
	if p["name"] != "Updated reference fern" || p["wikipedia_url"] != manual {
		t.Fatal("invalid save changed plant", p)
	}
	list := call("GET", "/api/plants?q=Updated%20reference", "", 200)["plants"].([]any)
	if len(list) != 1 || list[0].(map[string]any)["wikipedia_url"] != manual {
		t.Fatal("list lost override", list)
	}
	p = call("PUT", path, `{"name":"Reference fern","watering_interval_days":7,"wikipedia_url":""}`, 200)
	if p["wikipedia_url"] != "" {
		t.Fatal("explicit reset failed", p)
	}
	acts, err := store.ListActivities(context.Background(), id)
	if err != nil || len(acts) != 0 {
		t.Fatal("reference edit created activity", acts, err)
	}
}

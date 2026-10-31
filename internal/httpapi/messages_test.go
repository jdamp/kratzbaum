package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGermanErrorResponses(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"A room with this name already exists", "Ein Raum mit diesem Namen ist bereits vorhanden."},
		{"image exceeds upload size limit", "Das Bild überschreitet die zulässige Uploadgröße."},
		{"private technical detail", "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut."},
	} {
		if got := userMessage(tc.input); got != tc.want {
			t.Errorf("userMessage(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
	w := httptest.NewRecorder()
	failCode(w, 400, "invalid_image", "image is empty")
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if w.Code != 400 || w.Header().Get("Content-Language") != "de" || body["code"] != "invalid_image" || !strings.Contains(body["error"], "Bild") {
		t.Fatalf("unexpected localized error: status=%d headers=%v body=%v", w.Code, w.Header(), body)
	}
}

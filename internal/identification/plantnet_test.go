package identification

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestTimeoutIsClassifiedAndNotRetried(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		time.Sleep(80 * time.Millisecond)
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	client := Client{Key: "test-secret", Endpoint: server.URL, HTTP: &http.Client{Timeout: 200 * time.Millisecond}}
	_, err := client.Identify(ctx, []byte{0xff, 0xd8, 0xff})
	if err == nil || ErrorCode(err) != "plantnet_timeout" {
		t.Fatalf("timeout error = %v", err)
	}
	time.Sleep(100 * time.Millisecond)
	if calls.Load() != 1 {
		t.Fatalf("timed-out attempt retried %d times", calls.Load())
	}
}

func TestQuotaErrorIsDistinct(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTooManyRequests) }))
	defer server.Close()
	client := Client{Key: "never-log-this", Endpoint: server.URL}
	_, err := client.Identify(context.Background(), []byte{0xff, 0xd8, 0xff})
	if ErrorCode(err) != "plantnet_quota" {
		t.Fatalf("quota classification: %v", err)
	}
}

func TestHTTPClientTimeoutIsClassifiedAndNotRetried(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		time.Sleep(80 * time.Millisecond)
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))
	defer server.Close()
	client := Client{Key: "private-test-key", Endpoint: server.URL, HTTP: &http.Client{Timeout: 20 * time.Millisecond}}
	_, err := client.Identify(context.Background(), []byte{0xff, 0xd8, 0xff})
	if ErrorCode(err) != "plantnet_timeout" || calls.Load() != 1 {
		t.Fatalf("timeout code=%s calls=%d", ErrorCode(err), calls.Load())
	}
}

func TestMissingKeyAndNoMatchAreDistinct(t *testing.T) {
	if _, err := (Client{Endpoint: "http://example.invalid"}).Identify(context.Background(), []byte{0xff, 0xd8, 0xff}); ErrorCode(err) != "plantnet_not_configured" {
		t.Fatalf("missing configuration code=%q error=%v", ErrorCode(err), err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"results":[{"score":0.5,"species":{"scientificNameWithoutAuthor":""}}]}`))
	}))
	defer server.Close()
	candidates, err := (Client{Key: "private-test-key", Endpoint: server.URL}).Identify(context.Background(), []byte{0xff, 0xd8, 0xff})
	if err == nil || ErrorCode(err) != "plantnet_no_match" || len(candidates) != 0 {
		t.Fatalf("no-match result=%#v error=%v", candidates, err)
	}
	if strings.Contains(ErrorMessage(err), "private-test-key") {
		t.Fatal("error exposed PlantNet key")
	}
}

func TestCandidatesStayRankedAndAreLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, `{"results":[{"score":0.99,"species":{"scientificNameWithoutAuthor":"Species 1"}},{"score":0.88,"species":{"scientificNameWithoutAuthor":"Species 2"}},{"score":0.77,"species":{"scientificNameWithoutAuthor":"Species 3"}},{"score":0.66,"species":{"scientificNameWithoutAuthor":"Species 4"}},{"score":0.55,"species":{"scientificNameWithoutAuthor":"Species 5"}},{"score":0.44,"species":{"scientificNameWithoutAuthor":"Species 6"}}]}`)
	}))
	defer server.Close()
	candidates, err := (Client{Key: "private-test-key", Endpoint: server.URL}).Identify(context.Background(), []byte{0xff, 0xd8, 0xff})
	if err != nil {
		t.Fatal(err)
	}
	if len(candidates) != 5 || candidates[0].ScientificName != "Species 1" || candidates[0].Score != 0.99 || candidates[4].ScientificName != "Species 5" {
		t.Fatalf("candidate ordering/limit = %#v", candidates)
	}
}

func TestUpstreamFailuresNeverExposeKey(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"quota", http.StatusTooManyRequests, ""},
		{"rejected credentials", http.StatusUnauthorized, ""},
		{"service error", http.StatusBadGateway, "private-test-key"},
		{"invalid response", http.StatusOK, "private-test-key"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if tc.status != http.StatusOK {
					w.WriteHeader(tc.status)
				}
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			_, err := (Client{Key: "private-test-key", Endpoint: server.URL}).Identify(context.Background(), []byte{0xff, 0xd8, 0xff})
			if err == nil || strings.Contains(err.Error(), "private-test-key") {
				t.Fatalf("upstream error exposed credentials or succeeded: %v", err)
			}
		})
	}
}

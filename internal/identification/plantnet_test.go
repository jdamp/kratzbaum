package identification

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
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

func TestProviderRequestContract(t *testing.T) {
	for _, query := range []string{"", "?project=legacy&lang=de&include-related-images=true"} {
		t.Run(query, func(t *testing.T) {
			calls := 0
			image := []byte{0xff, 0xd8, 0xff, 0x42}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.URL.Query().Has("project") {
					w.WriteHeader(400)
					t.Error("unsupported project parameter")
					return
				}
				if r.Method != "POST" || r.URL.Path != "/v2/identify/all" || r.URL.Query().Get("api-key") != "private-test-key" {
					t.Error("invalid endpoint or credential placement")
				}
				if query != "" && (r.URL.Query().Get("lang") != "de" || r.URL.Query().Get("include-related-images") != "true") {
					t.Error("custom query lost")
				}
				file, header, err := r.FormFile("images")
				if err != nil {
					t.Error(err)
					w.WriteHeader(400)
					return
				}
				defer file.Close()
				got, _ := io.ReadAll(file)
				if !bytes.Equal(got, image) || header.Header.Get("Content-Type") != "image/jpeg" {
					t.Error("invalid image payload")
				}
				_, _ = io.WriteString(w, `{"results":[{"score":0.9,"species":{"scientificNameWithoutAuthor":"Monstera deliciosa"}}]}`)
			}))
			defer server.Close()
			candidates, err := (Client{Key: "private-test-key", Endpoint: server.URL + "/v2/identify/all" + query}).Identify(context.Background(), image)
			if err != nil || len(candidates) != 1 || calls != 1 {
				t.Fatalf("result=%v err=%v calls=%d", candidates, err, calls)
			}
		})
	}
}

func TestHTTPFailureCategories(t *testing.T) {
	for _, tc := range []struct {
		status int
		code   string
	}{
		{400, "plantnet_request_rejected"}, {422, "plantnet_request_rejected"},
		{401, "plantnet_auth"}, {403, "plantnet_auth"}, {404, "plantnet_no_match"},
		{429, "plantnet_quota"}, {500, "plantnet_unavailable"}, {502, "plantnet_unavailable"}, {302, "plantnet_unavailable"},
	} {
		t.Run(fmt.Sprint(tc.status), func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				calls++
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, "private-test-key provider-body")
			}))
			defer server.Close()
			_, err := (Client{Key: "private-test-key", Endpoint: server.URL}).Identify(context.Background(), []byte{0xff})
			var failure Failure
			if !errors.As(err, &failure) || failure.Code != tc.code || failure.Status != tc.status || calls != 1 {
				t.Fatalf("failure=%v calls=%d", err, calls)
			}
			if strings.Contains(err.Error(), "private-test-key") || strings.Contains(err.Error(), "provider-body") {
				t.Fatal("unsafe failure")
			}
		})
	}
}

type failingTransport func(*http.Request) (*http.Response, error)

func (f failingTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestTransportDiagnosticsAreBoundedAndSafe(t *testing.T) {
	for _, tc := range []struct {
		category string
		err      error
	}{
		{"dns", &net.DNSError{Err: "private-test-key", Name: "private-test-key"}},
		{"connection", &net.OpError{Op: "dial", Err: errors.New("private-test-key")}},
		{"tls", &tls.CertificateVerificationError{Err: errors.New("private-test-key")}},
		{"tls", tls.RecordHeaderError{Msg: "private-test-key"}},
		{"timeout", context.DeadlineExceeded},
		{"other", errors.New("private-test-key")},
	} {
		t.Run(tc.category+fmt.Sprintf("-%T", tc.err), func(t *testing.T) {
			calls := 0
			client := Client{Key: "private-test-key", Endpoint: "https://example.invalid/v2/identify/all", HTTP: &http.Client{Transport: failingTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				return nil, &url.Error{Op: "Post", URL: r.URL.String(), Err: tc.err}
			})}}
			_, err := client.Identify(context.Background(), []byte{0xff})
			var failure Failure
			if !errors.As(err, &failure) || failure.Transport != tc.category || failure.Status != 0 || calls != 1 {
				t.Fatalf("failure=%#v calls=%d", failure, calls)
			}
			if strings.Contains(fmt.Sprintf("%#v %s", failure, ErrorMessage(err)), "private-test-key") {
				t.Fatal("secret retained in diagnostic metadata")
			}
		})
	}
	if strings.Contains(ErrorMessage(errors.New("private-test-key")), "private-test-key") {
		t.Fatal("unknown error exposed")
	}
}

package identification

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/textproto"
	"net/url"
	"time"
)

type Candidate struct {
	ScientificName string   `json:"scientific_name"`
	CommonNames    []string `json:"common_names"`
	Score          float64  `json:"score"`
}
type Client struct {
	Key, Endpoint string
	HTTP          *http.Client
}
type upstream struct {
	Results []struct {
		Score   float64 `json:"score"`
		Species struct {
			Scientific string   `json:"scientificNameWithoutAuthor"`
			Common     []string `json:"commonNames"`
		} `json:"species"`
	} `json:"results"`
}

// Failure contains only safe, bounded diagnostic fields. Never retain raw errors or URLs.
type Failure struct {
	Code      string
	Status    int
	Transport string
}

func (f Failure) Error() string { return Message(f.Code) }

func (c Client) Identify(ctx context.Context, jpeg []byte) ([]Candidate, error) {
	if c.Key == "" {
		return nil, Failure{Code: "plantnet_not_configured"}
	}
	endpoint, err := url.Parse(c.Endpoint)
	if err != nil {
		return nil, Failure{Code: "plantnet_unavailable"}
	}
	query := endpoint.Query()
	query.Set("api-key", c.Key)
	query.Del("project")
	if !query.Has("include-related-images") {
		query.Set("include-related-images", "false")
	}
	endpoint.RawQuery = query.Encode()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="images"; filename="plant.jpg"`},
		"Content-Type":        {"image/jpeg"},
	})
	if err != nil {
		return nil, err
	}
	if _, err = part.Write(jpeg); err != nil {
		return nil, err
	}
	if err = writer.Close(); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), &body)
	if err != nil {
		return nil, Failure{Code: "plantnet_unavailable"}
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 25 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, transportFailure(ctx, err, 0)
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusNotFound:
		return nil, Failure{Code: "plantnet_no_match", Status: resp.StatusCode}
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, Failure{Code: "plantnet_auth", Status: resp.StatusCode}
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return nil, Failure{Code: "plantnet_request_rejected", Status: resp.StatusCode}
	case http.StatusTooManyRequests:
		return nil, Failure{Code: "plantnet_quota", Status: resp.StatusCode}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, Failure{Code: "plantnet_unavailable", Status: resp.StatusCode}
	}
	var response upstream
	decoder := json.NewDecoder(io.LimitReader(resp.Body, 2<<20))
	if err := decoder.Decode(&response); err != nil {
		var timeout net.Error
		if errors.Is(ctx.Err(), context.DeadlineExceeded) || (errors.As(err, &timeout) && timeout.Timeout()) {
			return nil, transportFailure(ctx, err, resp.StatusCode)
		}
		return nil, Failure{Code: "plantnet_invalid_response", Status: resp.StatusCode}
	}
	results := make([]Candidate, 0, 5)
	for _, item := range response.Results {
		if item.Species.Scientific == "" {
			continue
		}
		results = append(results, Candidate{ScientificName: item.Species.Scientific, CommonNames: item.Species.Common, Score: item.Score})
		if len(results) == 5 {
			break
		}
	}
	if len(results) == 0 {
		return []Candidate{}, Failure{Code: "plantnet_no_match", Status: resp.StatusCode}
	}
	return results, nil
}

func ErrorCode(err error) string {
	var failure Failure
	if errors.As(err, &failure) {
		return failure.Code
	}
	return "plantnet_unavailable"
}
func ErrorMessage(err error) string { return Message(ErrorCode(err)) }

func Message(code string) string {
	switch code {
	case "plantnet_not_configured":
		return "PlantNet identification is not configured"
	case "plantnet_no_match":
		return "PlantNet found no likely species"
	case "plantnet_auth":
		return "PlantNet rejected the configured API key or account"
	case "plantnet_request_rejected":
		return "PlantNet rejected the identification request"
	case "plantnet_quota":
		return "PlantNet quota is exhausted"
	case "plantnet_timeout":
		return "PlantNet did not respond in time"
	case "plantnet_invalid_response":
		return "PlantNet returned an invalid response"
	default:
		return "PlantNet service is unavailable"
	}
}

func transportFailure(ctx context.Context, err error, status int) Failure {
	failure := Failure{Code: "plantnet_unavailable", Status: status, Transport: "other"}
	var timeout net.Error
	var dns *net.DNSError
	var certificate *tls.CertificateVerificationError
	var record tls.RecordHeaderError
	var authority x509.UnknownAuthorityError
	var invalid x509.CertificateInvalidError
	var hostname x509.HostnameError
	var connection *net.OpError
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded) || (errors.As(err, &timeout) && timeout.Timeout()):
		failure.Code, failure.Transport = "plantnet_timeout", "timeout"
	case errors.As(err, &dns):
		failure.Transport = "dns"
	case errors.As(err, &certificate), errors.As(err, &record), errors.As(err, &authority), errors.As(err, &invalid), errors.As(err, &hostname):
		failure.Transport = "tls"
	case errors.As(err, &connection):
		failure.Transport = "connection"
	}
	return failure
}

func Encode(candidates []Candidate) []byte {
	data, err := json.Marshal(candidates)
	if err != nil {
		return []byte("[]")
	}
	return data
}

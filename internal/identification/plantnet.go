package identification

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
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
type Failure struct{ Code, Message string }

func (f Failure) Error() string { return f.Message }

func (c Client) Identify(ctx context.Context, jpeg []byte) ([]Candidate, error) {
	if c.Key == "" {
		return nil, Failure{"plantnet_not_configured", "PlantNet identification is not configured"}
	}
	endpoint, err := url.Parse(c.Endpoint)
	if err != nil {
		return nil, Failure{"plantnet_unavailable", "PlantNet service is unavailable"}
	}
	query := endpoint.Query()
	query.Set("api-key", c.Key)
	query.Set("project", "all")
	query.Set("include-related-images", "false")
	endpoint.RawQuery = query.Encode()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("images", "plant.jpg")
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
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 25 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	}
	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, Failure{"plantnet_timeout", "PlantNet did not respond in time"}
		}
		return nil, Failure{"plantnet_unavailable", "PlantNet service is unavailable"}
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, Failure{"plantnet_quota", "PlantNet quota is exhausted"}
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, Failure{"plantnet_quota", "PlantNet rejected the configured account or quota"}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, Failure{"plantnet_unavailable", "PlantNet service is unavailable"}
	}
	var response upstream
	decoder := json.NewDecoder(io.LimitReader(resp.Body, 2<<20))
	if err := decoder.Decode(&response); err != nil {
		return nil, Failure{"plantnet_invalid_response", "PlantNet returned an invalid response"}
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
		return []Candidate{}, Failure{"plantnet_no_match", "PlantNet found no likely species"}
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
func ErrorMessage(err error) string {
	var failure Failure
	if errors.As(err, &failure) {
		return failure.Message
	}
	return fmt.Sprint(err)
}
func Encode(candidates []Candidate) []byte {
	data, err := json.Marshal(candidates)
	if err != nil {
		return []byte("[]")
	}
	return data
}

package httpapi

import (
	"errors"
	"net/url"
	"strings"
)

var errWikipediaURL = errors.New("Invalid Wikipedia URL")

// normalizeWikipediaURL validates the destination without making a network request.
func normalizeWikipediaURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	u, err := url.Parse(value)
	if err != nil || !strings.EqualFold(u.Scheme, "https") || u.Opaque != "" || u.User != nil || u.RawQuery != "" || u.ForceQuery || (u.Port() != "" && u.Port() != "443") {
		return "", errWikipediaURL
	}
	host := strings.ToLower(u.Hostname())
	switch host {
	case "de.wikipedia.org", "en.wikipedia.org":
	case "de.m.wikipedia.org":
		host = "de.wikipedia.org"
	case "en.m.wikipedia.org":
		host = "en.wikipedia.org"
	default:
		return "", errWikipediaURL
	}
	if !strings.HasPrefix(u.Path, "/wiki/") || strings.TrimSpace(strings.TrimPrefix(u.Path, "/wiki/")) == "" || strings.ContainsAny(u.Path+u.Fragment, "\x00\r\n\t") {
		return "", errWikipediaURL
	}
	u.Host = host
	u.Scheme = "https"
	return u.String(), nil
}

package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image/jpeg"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kratzbaum/kratzbaum/internal/identification"
	"github.com/kratzbaum/kratzbaum/internal/media"
)

func (s *Server) identificationReady(w http.ResponseWriter, r *http.Request) bool {
	if plantID := r.PathValue("id"); plantID != "" {
		if !idPattern.MatchString(plantID) {
			fail(w, 400, "Invalid plant ID")
			return false
		}
		if _, err := s.Store.GetPlant(r.Context(), plantID); err != nil {
			fail(w, 404, "Plant not found")
			return false
		}
	}
	if s.Config.PlantNetKey == "" {
		failCode(w, 503, "plantnet_not_configured", "PlantNet identification is not configured")
		return false
	}
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if len(key) < 8 || len(key) > 128 {
		fail(w, 400, "A unique identification attempt key is required")
		return false
	}
	return true
}

func (s *Server) identify(w http.ResponseWriter, r *http.Request) {
	if !s.identificationReady(w, r) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, s.Config.MaxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(s.Config.MaxUploadBytes); err != nil {
		failCode(w, 400, "invalid_image", "Upload exceeds the configured size limit or is invalid")
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, header, err := r.FormFile("image")
	if err != nil {
		failCode(w, 400, "invalid_image", "Choose an image to identify")
		return
	}
	defer file.Close()
	normalized, err := media.Normalize(r.Context(), file, header.Filename, s.Config.MaxUploadBytes, s.Config.MaxImagePixels, s.Config.HEIFDecoder, filepath.Join(s.Config.MediaDir, ".tmp"))
	if err != nil {
		failCode(w, 400, "invalid_image", err.Error())
		return
	}
	s.runIdentification(w, r, normalized.Original)
}

func (s *Server) identifySavedPhoto(w http.ResponseWriter, r *http.Request) {
	if !s.identificationReady(w, r) {
		return
	}
	photoID := r.PathValue("photoID")
	if !idPattern.MatchString(photoID) {
		fail(w, 400, "Invalid photo ID")
		return
	}
	photo, err := s.Store.GetPhoto(r.Context(), photoID)
	if err != nil || photo.PlantID != r.PathValue("id") {
		fail(w, 404, "Plant photo not found")
		return
	}
	file, err := os.Open(s.Store.MediaFile(photo, false))
	if err != nil {
		failCode(w, 400, "invalid_image", "The saved photograph is unavailable")
		return
	}
	defer file.Close()
	// Quality-88 normalized JPEGs can exceed their compressed upload size.
	// Bound by the configured decoded pixel limit plus JPEG header overhead.
	limit := s.Config.MaxImagePixels*6 + (1 << 20)
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil || int64(len(data)) > limit {
		failCode(w, 400, "invalid_image", "The saved photograph exceeds the image size limit")
		return
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > s.Config.MaxImagePixels {
		failCode(w, 400, "invalid_image", "The saved photograph is invalid or oversized")
		return
	}
	if _, err := jpeg.Decode(bytes.NewReader(data)); err != nil {
		failCode(w, 400, "invalid_image", "The saved photograph could not be decoded")
		return
	}
	s.runIdentification(w, r, data)
}

func (s *Server) runIdentification(w http.ResponseWriter, r *http.Request, image []byte) {
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	attempt, created, err := s.Store.BeginIdentification(r.Context(), key)
	if err != nil {
		fail(w, 500, "Could not save identification attempt")
		return
	}
	if !created {
		if attempt.Status == "pending" {
			failCode(w, 409, "attempt_in_progress", "This identification attempt is already being processed; start a new attempt only if you want to try again")
			return
		}
		result := map[string]any{"attempt_id": attempt.ID, "status": attempt.Status, "candidates": json.RawMessage(attempt.Candidates)}
		if attempt.ErrorCode != "" {
			result["error_code"] = attempt.ErrorCode
			result["error"] = identificationMessage(attempt.ErrorCode)
		}
		jsonOut(w, 200, result)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 26*time.Second)
	defer cancel()
	client := identification.Client{Key: s.Config.PlantNetKey, Endpoint: s.Config.PlantNetURL}
	candidates, err := client.Identify(ctx, image)
	status, code := "succeeded", ""
	if err != nil {
		code = identification.ErrorCode(err)
		status = "failed"
		attrs := []any{"attempt_id", attempt.ID, "failure_code", code}
		var failure identification.Failure
		if errors.As(err, &failure) {
			if failure.Status != 0 {
				attrs = append(attrs, "upstream_status", failure.Status)
			}
			if failure.Transport != "" {
				attrs = append(attrs, "transport", failure.Transport)
			}
		}
		if code == "plantnet_no_match" {
			slog.Info("PlantNet identification failed", attrs...)
		} else {
			slog.Warn("PlantNet identification failed", attrs...)
		}
		if code == "plantnet_no_match" {
			status = "no_match"
		}
	}
	// Persist a terminal result even if the caller disconnected during the request.
	completion, completeCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
	defer completeCancel()
	if saveErr := s.Store.CompleteIdentification(completion, key, status, code, identification.Encode(candidates)); saveErr != nil {
		fail(w, 500, "Could not store identification result")
		return
	}
	result := map[string]any{"attempt_id": attempt.ID, "status": status, "candidates": candidates}
	if err != nil {
		result["error_code"] = code
		result["error"] = identification.ErrorMessage(err)
	}
	jsonOut(w, 200, result)
}

package media

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNormalizeFlattensTransparencyAndProducesJPEG(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 24, 12))
	for y := 0; y < 12; y++ {
		for x := 0; x < 24; x++ {
			src.Set(x, y, color.NRGBA{R: 255, A: 128})
		}
	}
	var input bytes.Buffer
	if err := png.Encode(&input, src); err != nil {
		t.Fatal(err)
	}
	result, err := Normalize(context.Background(), &input, "leaf.png", 1<<20, 1000, "", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 24 || result.Height != 12 {
		t.Fatalf("dimensions %dx%d", result.Width, result.Height)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(result.Original))
	if err != nil {
		t.Fatalf("normalized output is not JPEG: %v", err)
	}
	r, g, b, _ := decoded.At(12, 6).RGBA()
	if r < g || r < b {
		t.Fatalf("transparent area was not composited on white: %#v", []uint32{r, g, b})
	}
}

func TestNormalizeRejectsUnsupportedAndOversizedImages(t *testing.T) {
	for _, tc := range []struct {
		name  string
		data  []byte
		limit int64
	}{{"bad.jpg", []byte("no image"), 100}, {"huge.png", pngBytes(t), 10}} {
		if _, err := Normalize(context.Background(), bytes.NewReader(tc.data), tc.name, 1<<20, tc.limit, "", t.TempDir()); err == nil {
			t.Errorf("accepted %s", tc.name)
		}
	}
}

func TestExifOrientationRotatesPixelData(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.RGBA{R: 255, A: 255})
	src.Set(1, 0, color.RGBA{G: 255, A: 255})
	got := applyOrientation(src, 6)
	if got.Bounds().Dx() != 1 || got.Bounds().Dy() != 2 {
		t.Fatalf("rotated bounds %v", got.Bounds())
	}
	top := got.At(0, 0)
	bottom := got.At(0, 1)
	tr, _, _, _ := top.RGBA()
	_, bg, _, _ := bottom.RGBA()
	if tr < bg {
		t.Fatalf("orientation did not rotate clockwise: top=%v bottom=%v", top, bottom)
	}
}

func TestParsesExifOrientation(t *testing.T) {
	tiff := []byte{'I', 'I', 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0}
	if got := tiffOrientation(tiff); got != 6 {
		t.Fatalf("orientation=%d, want 6", got)
	}
}

func TestNormalizeAppliesExifOrientationToJPEG(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.RGBA{R: 255, A: 255})
	src.Set(1, 0, color.RGBA{G: 255, A: 255})
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, src, nil); err != nil {
		t.Fatal(err)
	}
	tiff := []byte{'I', 'I', 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0}
	exif := append([]byte("Exif\x00\x00"), tiff...)
	segment := []byte{0xff, 0xe1, byte((len(exif) + 2) >> 8), byte(len(exif) + 2)}
	segment = append(segment, exif...)
	jpegBytes := append(append(append([]byte{}, encoded.Bytes()[:2]...), segment...), encoded.Bytes()[2:]...)
	result, err := Normalize(context.Background(), bytes.NewReader(jpegBytes), "rotated.jpg", 1<<20, 1000, "", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 1 || result.Height != 2 {
		t.Fatalf("oriented dimensions=%dx%d, want 1x2", result.Width, result.Height)
	}
}

func TestNormalizeWebPProducesJPEG(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "leaf.webp"))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Normalize(context.Background(), bytes.NewReader(data), "leaf.webp", 1<<20, 1000, "", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 2 || result.Height != 3 {
		t.Fatalf("WebP dimensions=%dx%d, want 2x3", result.Width, result.Height)
	}
	if _, err := jpeg.Decode(bytes.NewReader(result.Original)); err != nil {
		t.Fatalf("normalized WebP is not JPEG: %v", err)
	}
}

func TestHEICDecoderTimeoutCleansTemporaryFiles(t *testing.T) {
	temp := t.TempDir()
	decoder := filepath.Join(temp, "slow-decoder")
	if err := os.WriteFile(decoder, []byte("#!/bin/sh\nexec sleep 30\n"), 0700); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	if _, err := Normalize(ctx, bytes.NewReader([]byte("fake heic")), "leaf.heic", 1024, 100, decoder, temp); err == nil {
		t.Fatal("timed-out decoder returned success")
	}
	entries, err := os.ReadDir(temp)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != "slow-decoder" {
		t.Fatalf("decoder temporaries were not cleaned up: %v", entries)
	}
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	var out bytes.Buffer
	if err := png.Encode(&out, image.NewRGBA(image.Rect(0, 0, 8, 8))); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

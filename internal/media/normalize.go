package media

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

type Result struct {
	Original, Thumbnail []byte
	Width, Height       int
}

var decodeSlots = make(chan struct{}, 4)

func Normalize(ctx context.Context, input io.Reader, filename string, maxBytes, pixelLimit int64, decoder, tempDir string) (Result, error) {
	select {
	case decodeSlots <- struct{}{}:
		defer func() { <-decodeSlots }()
	case <-ctx.Done():
		return Result{}, ctx.Err()
	}
	data, err := io.ReadAll(io.LimitReader(input, maxBytes+1))
	if err != nil {
		return Result{}, err
	}
	if int64(len(data)) > maxBytes {
		return Result{}, errors.New("image exceeds upload size limit")
	}
	if len(data) == 0 {
		return Result{}, errors.New("image is empty")
	}
	format := imageFormat(data, filename)
	var src image.Image
	if format == "heic" {
		if decoder == "" {
			return Result{}, errors.New("HEIC decoder is not configured")
		}
		if err := os.MkdirAll(tempDir, 0700); err != nil {
			return Result{}, err
		}
		in, err := os.CreateTemp(tempDir, "upload-*.heic")
		if err != nil {
			return Result{}, err
		}
		defer os.Remove(in.Name())
		if _, err = in.Write(data); err != nil {
			in.Close()
			return Result{}, err
		}
		in.Close()
		out := in.Name() + ".png"
		defer os.Remove(out)
		decodeCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		cmd := exec.CommandContext(decodeCtx, decoder, in.Name(), out)
		cmd.Env = []string{"PATH=/usr/local/bin:/usr/bin:/bin"}
		if output, err := cmd.CombinedOutput(); err != nil {
			return Result{}, fmt.Errorf("HEIC conversion failed: %w (%s)", err, strings.TrimSpace(string(output)))
		}
		f, err := os.Open(out)
		if err != nil {
			return Result{}, err
		}
		defer f.Close()
		converted, err := io.ReadAll(io.LimitReader(f, maxBytes*5+1))
		if err != nil {
			return Result{}, err
		}
		if int64(len(converted)) > maxBytes*5 {
			return Result{}, errors.New("decoded HEIC exceeds temporary image size limit")
		}
		src, _, err = decodeBounded(converted, pixelLimit)
		if err != nil {
			return Result{}, errors.New("HEIC decoder produced an invalid or oversized image")
		}
	} else {
		if format == "" {
			return Result{}, errors.New("only JPG, PNG, WebP, and HEIC images are supported")
		}
		src, _, err = decodeBounded(data, pixelLimit)
		if err != nil {
			return Result{}, errors.New("image data is invalid, truncated, or oversized")
		}
	}
	if format == "jpeg" {
		src = applyOrientation(src, jpegOrientation(data))
	}
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w < 1 || h < 1 || int64(w)*int64(h) > pixelLimit {
		return Result{}, errors.New("image dimensions exceed the pixel limit")
	}
	var original bytes.Buffer
	encErr := jpeg.Encode(&original, flatten(src), &jpeg.Options{Quality: 88})
	if encErr != nil {
		return Result{}, encErr
	}
	thumb := thumbnail(src, 640)
	var small bytes.Buffer
	if err := jpeg.Encode(&small, flatten(thumb), &jpeg.Options{Quality: 82}); err != nil {
		return Result{}, err
	}
	return Result{Original: original.Bytes(), Thumbnail: small.Bytes(), Width: w, Height: h}, nil
}

func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xff || data[1] != 0xd8 {
		return 1
	}
	offset := 2
	for offset+4 <= len(data) && data[offset] == 0xff {
		marker := data[offset+1]
		offset += 2
		if marker == 0xd9 || marker == 0xda {
			return 1
		}
		length := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		offset += 2
		if length < 2 || offset+length-2 > len(data) {
			return 1
		}
		segment := data[offset : offset+length-2]
		if marker == 0xe1 && len(segment) > 6 && string(segment[:6]) == "Exif\x00\x00" {
			if v := tiffOrientation(segment[6:]); v >= 1 && v <= 8 {
				return v
			}
		}
		offset += length - 2
	}
	return 1
}
func tiffOrientation(data []byte) int {
	if len(data) < 8 {
		return 1
	}
	var order binary.ByteOrder
	switch string(data[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	if order.Uint16(data[2:4]) != 42 {
		return 1
	}
	offset := int(order.Uint32(data[4:8]))
	if offset < 0 || offset+2 > len(data) {
		return 1
	}
	count := int(order.Uint16(data[offset : offset+2]))
	offset += 2
	for i := 0; i < count; i++ {
		entry := offset + i*12
		if entry+12 > len(data) {
			return 1
		}
		if order.Uint16(data[entry:entry+2]) == 0x0112 && order.Uint16(data[entry+2:entry+4]) == 3 && order.Uint32(data[entry+4:entry+8]) >= 1 {
			return int(order.Uint16(data[entry+8 : entry+10]))
		}
	}
	return 1
}
func applyOrientation(src image.Image, orientation int) image.Image {
	if orientation <= 1 || orientation > 8 {
		return src
	}
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dw, dh := w, h
	if orientation >= 5 {
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch orientation {
			case 2:
				dx, dy = w-1-x, y
			case 3:
				dx, dy = w-1-x, h-1-y
			case 4:
				dx, dy = x, h-1-y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = h-1-y, x
			case 7:
				dx, dy = h-1-y, w-1-x
			case 8:
				dx, dy = y, w-1-x
			}
			dst.Set(dx, dy, src.At(src.Bounds().Min.X+x, src.Bounds().Min.Y+y))
		}
	}
	return dst
}

func decodeBounded(data []byte, pixelLimit int64) (image.Image, string, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}
	if cfg.Width < 1 || cfg.Height < 1 || int64(cfg.Width)*int64(cfg.Height) > pixelLimit {
		return nil, "", errors.New("image dimensions exceed the pixel limit")
	}
	img, decodedFormat, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}
	return img, decodedFormat, nil
}

func imageFormat(data []byte, name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return "jpeg"
	}
	if len(data) >= 8 && bytes.Equal(data[:8], []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
		return "png"
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "webp"
	}
	if len(data) >= 12 && string(data[4:8]) == "ftyp" && (strings.Contains(string(data[:32]), "heic") || strings.Contains(string(data[:32]), "heif") || strings.Contains(string(data[:32]), "mif1")) {
		return "heic"
	}
	if ext == ".heic" || ext == ".heif" {
		return "heic"
	}
	return ""
}
func flatten(src image.Image) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, src.Bounds().Dx(), src.Bounds().Dy()))
	for y := 0; y < dst.Bounds().Dy(); y++ {
		for x := 0; x < dst.Bounds().Dx(); x++ {
			r, g, b, a := src.At(src.Bounds().Min.X+x, src.Bounds().Min.Y+y).RGBA()
			dst.Set(x, y, color.RGBA{uint8((r + 65535 - a) >> 8), uint8((g + 65535 - a) >> 8), uint8((b + 65535 - a) >> 8), 255})
		}
	}
	return dst
}
func thumbnail(src image.Image, max int) image.Image {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	if w <= max && h <= max {
		return src
	}
	scale := float64(max) / float64(maxInt(w, h))
	nw, nh := int(float64(w)*scale), int(float64(h)*scale)
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

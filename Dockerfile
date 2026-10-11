FROM node:22-bookworm AS frontend
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM frontend AS frontend-tests
RUN npm test

FROM frontend-tests AS frontend-tests-artifact
RUN touch /frontend-tests-passed

FROM scratch AS frontend-tests-result
COPY --from=frontend-tests-artifact /frontend-tests-passed /frontend-tests-passed

FROM golang:1.27.1-bookworm AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
COPY --from=frontend /src/cmd/kratzbaum/web/dist ./cmd/kratzbaum/web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kratzbaum ./cmd/kratzbaum

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl libheif-examples && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 --home-dir /app kratzbaum && mkdir -p /data/media && chown -R 10001:10001 /data
RUN command -v heif-convert
COPY --from=backend /out/kratzbaum /usr/local/bin/kratzbaum
ENV LISTEN_ADDR=:8080 DATA_DIR=/data MEDIA_DIR=/data/media DATABASE_DRIVER=sqlite DATABASE_URL=/data/kratzbaum.db HEIF_CONVERT=heif-convert
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD ["curl", "-fsS", "http://127.0.0.1:8080/healthz"]
ENTRYPOINT ["/usr/local/bin/kratzbaum"]

FROM golang:1.27.1-bookworm AS smoke-fixture
RUN cat > /tmp/make-jpeg.go <<'GO'
package main

import (
	"image"
	"image/color"
	"image/jpeg"
	"os"
)

func main() {
	img := image.NewNRGBA(image.Rect(0, 0, 2, 3))
	colors := []color.NRGBA{{R: 240, A: 255}, {G: 220, A: 255}, {B: 210, A: 255}, {R: 220, G: 240, A: 255}, {G: 220, B: 240, A: 255}, {R: 240, B: 220, A: 255}}
	for i, value := range colors {
		img.SetNRGBA(i%2, i/2, value)
	}
	file, err := os.Create("/tmp/plant.jpg")
	if err != nil { panic(err) }
	if err := jpeg.Encode(file, img, nil); err != nil { panic(err) }
	if err := file.Close(); err != nil { panic(err) }
}
GO
RUN go run /tmp/make-jpeg.go

FROM smoke-fixture AS webp-fixture
RUN apt-get update && apt-get install -y --no-install-recommends webp && rm -rf /var/lib/apt/lists/*
RUN cwebp -quiet /tmp/plant.jpg -o /tmp/plant.webp

FROM scratch AS webp-fixture-export
COPY --from=webp-fixture /tmp/plant.webp /leaf.webp

FROM runtime AS smoke
ENV LISTEN_ADDR=127.0.0.1:18080 DATA_DIR=/tmp/kratzbaum-smoke MEDIA_DIR=/tmp/kratzbaum-smoke/media DATABASE_URL=/tmp/kratzbaum-smoke/kratzbaum.db
COPY --from=smoke-fixture /tmp/plant.jpg /tmp/plant.jpg
RUN <<'SCRIPT'
set -eu
command -v heif-convert
command -v heif-enc
if HEIF_CONVERT=kratzbaum-missing-decoder /usr/local/bin/kratzbaum >/tmp/decoder-check.log 2>&1; then
  echo 'server accepted a missing HEIC decoder' >&2
  exit 1
fi
grep -q 'configured HEIC decoder is unavailable' /tmp/decoder-check.log
mkdir -p "$DATA_DIR/media"
heif-enc -o /tmp/plant.heic /tmp/plant.jpg
heif-convert /tmp/plant.heic /tmp/decoded.png
/usr/local/bin/kratzbaum >/tmp/kratzbaum-smoke.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
ready=0
for attempt in $(seq 1 50); do
  if curl -fsS http://127.0.0.1:18080/healthz >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.1
done
test "$ready" = 1
plant_status=$(curl -sS -o /tmp/plant-response.json -w '%{http_code}' -H 'Content-Type: application/json' -d '{"name":"Smoke fern","care_start_date":"2026-01-01","watering_interval_days":7}' http://127.0.0.1:18080/api/plants)
if [ "$plant_status" != 201 ]; then cat /tmp/plant-response.json; cat /tmp/kratzbaum-smoke.log; exit 1; fi
plant_json=$(cat /tmp/plant-response.json)
plant_id=$(printf '%s' "$plant_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$plant_id"
photo_status=$(curl -sS -o /tmp/photo-response.json -w '%{http_code}' -F image=@/tmp/plant.heic http://127.0.0.1:18080/api/plants/$plant_id/photos)
if [ "$photo_status" != 201 ]; then cat /tmp/photo-response.json; cat /tmp/kratzbaum-smoke.log; exit 1; fi
photo_json=$(cat /tmp/photo-response.json)
photo_id=$(printf '%s' "$photo_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$photo_id"
curl -fsS -o /tmp/normalized.jpg http://127.0.0.1:18080/media/$photo_id/original.jpg
signature=$(od -An -tx1 -N3 /tmp/normalized.jpg | tr -d ' \n')
test "$signature" = ffd8ff
echo 'container startup, decoder validation, and HEIC-to-JPEG upload passed'
SCRIPT

FROM node:22-bookworm AS playwright-deps
WORKDIR /tmp/playwright
RUN npm install --no-save --package-lock=false @playwright/test@1.56.1
RUN npx playwright install --with-deps chromium

FROM playwright-deps AS browser-tests
USER root
COPY --from=frontend /src/web /src/web
WORKDIR /src/web
COPY --from=backend /out/kratzbaum /usr/local/bin/kratzbaum
COPY --from=smoke-fixture /tmp/plant.jpg /tmp/plant.jpg
ENV LISTEN_ADDR=127.0.0.1:8080 DATA_DIR=/tmp/kratzbaum-e2e MEDIA_DIR=/tmp/kratzbaum-e2e/media DATABASE_URL=/tmp/kratzbaum-e2e/kratzbaum.db HEIF_CONVERT=/bin/true
RUN <<'SCRIPT'
set -eu
mkdir -p "$DATA_DIR/media"
/usr/local/bin/kratzbaum >/tmp/kratzbaum-e2e.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
ready=0
for attempt in $(seq 1 50); do
  if node -e 'fetch("http://127.0.0.1:8080/healthz").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.1
done
test "$ready" = 1
KRATZBAUM_BASE_URL=http://127.0.0.1:8080 npm run test:ui
touch /tmp/browser-tests-passed
SCRIPT

FROM scratch AS browser-tests-result
COPY --from=browser-tests /tmp/browser-tests-passed /browser-tests-passed

FROM runtime AS production

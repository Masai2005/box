BINARY  ?= ekilie-box
VERSION ?= $(patsubst v%,%,$(shell git describe --tags --always --dirty 2>/dev/null || echo dev))

LDFLAGS := -s -w -X github.com/ekilie/box/internal/app.Version=$(VERSION)

.PHONY: all ui build run dev-ui test tidy clean release update-pocketone

REF ?= main

all: build

# Build the superuser UI into internal/ui/dist, which is embedded in the binary.
ui:
	cd web && npm install --no-audit --no-fund && npm run build

# Vite dev server with /api and /_ proxied to the running Go process.
dev-ui:
	cd web && npm run dev

build: ui
	CGO_ENABLED=0 go build -tags no_ui -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/box

run: ui
	CGO_ENABLED=0 go run -tags no_ui -ldflags "$(LDFLAGS)" ./cmd/box serve

test:
	go test ./...

tidy:
	go mod tidy

# Move every PocketOne replace to the latest commit of the fork's main (or REF=branch/tag).
update-pocketone:
	sh scripts/update-pocketone.sh $(REF)

clean:
	rm -f $(BINARY) $(BINARY).exe
	rm -rf .builds web/node_modules

# Requires goreleaser, npm and the PocketOne checkout referenced by go.mod's replace directives.
release:
	goreleaser release --clean

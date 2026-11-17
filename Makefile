BINARY  ?= ekilie-box
VERSION ?= $(patsubst v%,%,$(shell git describe --tags --always --dirty 2>/dev/null || echo dev))

LDFLAGS := -s -w -X github.com/ekilie/box/internal/app.Version=$(VERSION)

.PHONY: all build run test tidy clean release

all: build

build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/base

run:
	CGO_ENABLED=0 go run -ldflags "$(LDFLAGS)" ./cmd/base serve

test:
	go test ./...

tidy:
	go mod tidy

clean:
	rm -f $(BINARY) $(BINARY).exe
	rm -rf .builds

# Requires goreleaser and the PocketOne checkout referenced by go.mod's replace directives.
release:
	goreleaser release --clean

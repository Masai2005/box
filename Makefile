BINARY  ?= ekilie-box
VERSION ?= $(patsubst v%,%,$(shell git describe --tags --always --dirty 2>/dev/null || echo dev))

LDFLAGS := -s -w -X github.com/ekilie/box/internal/app.Version=$(VERSION)

.PHONY: all build run test tidy clean release update-pocketone

REF ?= main

all: build

build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/box

run:
	CGO_ENABLED=0 go run -ldflags "$(LDFLAGS)" ./cmd/box serve

test:
	go test ./...

tidy:
	go mod tidy

# Move every PocketOne replace to the latest commit of the fork's main (or REF=branch/tag).
update-pocketone:
	sh scripts/update-pocketone.sh $(REF)

clean:
	rm -f $(BINARY) $(BINARY).exe
	rm -rf .builds

# Requires goreleaser and the PocketOne checkout referenced by go.mod's replace directives.
release:
	goreleaser release --clean

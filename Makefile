BINARY  ?= ekilie-box
VERSION ?= $(patsubst v%,%,$(shell git describe --tags --always --dirty 2>/dev/null || echo dev))

LDFLAGS := -s -w -X github.com/ekilie/box/internal/app.Version=$(VERSION)

.PHONY: all ui build run dev-ui test test-superuser tidy clean tag release update-pocketone

REF ?= main
BUMP ?= patch

all: build

# Build the superuser UI into internal/ui/dist, which is embedded in the binary.
ui:
	cd web && bun install --frozen-lockfile && bun run build

# Vite dev server with /api and /_ proxied to the running Go process.
dev-ui:
	cd web && bun run dev

build: ui
	CGO_ENABLED=0 go build -tags no_ui -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/box

run: ui
	CGO_ENABLED=0 go run -tags no_ui -ldflags "$(LDFLAGS)" ./cmd/box serve

test:
	@test -d internal/ui/dist || $(MAKE) ui
	go test ./...

# Create or update the local test superuser. Keep the password out of git:
#   make test-superuser TEST_SUPERUSER_PASSWORD='your-password'
#   make test-superuser TEST_SUPERUSER_EMAIL=you@example.com TEST_SUPERUSER_PASSWORD='your-password'
# Changing the password rotates the account token key, so sign in again in open browser sessions.
TEST_SUPERUSER_EMAIL ?= test@example.com
TEST_SUPERUSER_PASSWORD ?=
test-superuser:
	@test -n "$(TEST_SUPERUSER_PASSWORD)" || { \
		echo "Set TEST_SUPERUSER_PASSWORD, e.g. make test-superuser TEST_SUPERUSER_PASSWORD='...'"; \
		exit 1; \
	}
	go run -tags no_ui ./cmd/box superuser upsert "$(TEST_SUPERUSER_EMAIL)" "$(TEST_SUPERUSER_PASSWORD)"

tidy:
	go mod tidy

# Move every PocketOne replace to the latest commit of the fork's main (or REF=branch/tag).
update-pocketone:
	sh scripts/update-pocketone.sh $(REF)

clean:
	rm -f $(BINARY) $(BINARY).exe
	rm -rf .builds internal/ui/dist web/node_modules

# Create and push a semantic version tag for HEAD.
#   make tag                  bump the patch version
#   make tag BUMP=minor       bump the minor version
#   make tag BUMP=major       bump the major version
#   make tag VERSION=1.2.3    use an explicit version
tag:
	@set -eu; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "working tree is dirty; commit or stash changes before tagging" >&2; \
		exit 1; \
	fi; \
	if [ -n "$(VERSION)" ] && [ "$(origin VERSION)" != "file" ]; then \
		tag="v$${VERSION#v}"; \
	else \
		head_tag=$$(git tag --points-at HEAD --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$$' | head -n 1 || true); \
		if [ -n "$$head_tag" ]; then \
			tag="$$head_tag"; \
		else \
			latest=$$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$$' | head -n 1 || true); \
			if [ -z "$$latest" ]; then \
				tag="v0.1.0"; \
			else \
				base=$${latest#v}; \
				major=$${base%%.*}; \
				rest=$${base#*.}; \
				minor=$${rest%%.*}; \
				patch=$${rest#*.}; \
				case "$(BUMP)" in \
					major) major=$$((major + 1)); minor=0; patch=0 ;; \
					minor) minor=$$((minor + 1)); patch=0 ;; \
					patch) patch=$$((patch + 1)) ;; \
					*) echo "BUMP must be major, minor, or patch" >&2; exit 1 ;; \
				esac; \
				tag="v$$major.$$minor.$$patch"; \
			fi; \
		fi; \
	fi; \
	if ! printf '%s' "$$tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "invalid version: $$tag (expected vMAJOR.MINOR.PATCH)" >&2; \
		exit 1; \
	fi; \
	if git rev-parse -q --verify "refs/tags/$$tag" >/dev/null; then \
		echo "tag $$tag already exists"; \
	else \
		git tag -a "$$tag" -m "$$tag"; \
	fi; \
	git push origin "$$tag"; \
	echo "tagged $$tag"

# Requires goreleaser, bun and either GITHUB_TOKEN in the environment or an authenticated gh CLI.
release: tag
	@GITHUB_TOKEN="$${GITHUB_TOKEN:-$$(gh auth token 2>/dev/null)}" goreleaser release --clean

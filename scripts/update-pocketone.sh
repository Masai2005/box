#!/bin/sh
# Point every PocketOne replace at the latest commit of the fork's main branch (or another ref).
#
# Go modules do not support a moving branch in go.mod: a branch name is resolved to an immutable commit
# pseudo-version. This script resolves the fork at REF for you and rewrites all replace directives, then runs
# go mod tidy. Update the fork, run `make update-pocketone`, and commit go.mod/go.sum.
set -eu

cd "$(dirname "$0")/.."

FORK=${POCKETONE_FORK:-github.com/ekilie/pocketone}
REF=${1:-main}

# PocketOne's extension modules. Keep this list in sync with https://github.com/ekilie/pocketone/tree/main/ext.
EXTS="
api-tokens
autotls
backups
bulkmail
bundle
cache
config
contracts
deploy
desktop
desktop/runtime
devusers
docker
edge
extkit
firewall
jsvm
kv
llm
llm-chat
llm-search
mailrelay
mailtrap
mcp
mothership
multisite
pages
pitr
pocker
remotes
s3-fallback
s3redirect
sandbox
servertiming
settings
standard
stats
templates
uicache
upgrade
vacuum
wasm
"

version() {
	GOFLAGS=-mod=mod go list -m -f '{{.Version}}' "$1@$REF"
}

echo "PocketOne: $FORK@$REF"

core=$(version "$FORK")
echo "  core      $core"
go mod edit -replace="ganigeorgiev.com/pocketbase/pocketbase=$FORK@$core"

# Drop replaces and requires from the old github.com/pockethost/pocketone module paths.
legacy=$(sed -n 's|.*github.com/pockethost/pocketone/ext/\([a-zA-Z0-9_/-]*\) =>.*|\1|p' go.mod | sort -u)
for name in $legacy; do
	go mod edit -dropreplace="github.com/pockethost/pocketone/ext/$name"
	go mod edit -droprequire="github.com/pockethost/pocketone/ext/$name" 2>/dev/null || true
done

for name in $EXTS; do
	v=$(version "$FORK/ext/$name")
	echo "  ext/$name $v"
	go mod edit -replace="pocketone.dev/ext/$name=$FORK/ext/$name@$v"
done

go mod tidy

echo "done. commit go.mod and go.sum."

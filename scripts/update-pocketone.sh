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

version() {
	go list -m -f '{{.Version}}' "$1@$REF"
}

echo "PocketOne: $FORK@$REF"

core=$(version "$FORK")
echo "  core      $core"
go mod edit -replace="ganigeorgiev.com/pocketbase/pocketbase=$FORK@$core"

# Keep this list in sync with go.mod's ext replace block.
for name in $(sed -n 's|.*github.com/pockethost/pocketone/ext/\([a-zA-Z0-9_-]*\) =>.*|\1|p' go.mod | sort -u); do
	v=$(version "$FORK/ext/$name")
	echo "  ext/$name $v"
	go mod edit -replace="github.com/pockethost/pocketone/ext/$name=$FORK/ext/$name@$v"
done

go mod tidy

echo "done. commit go.mod and go.sum."

// Package ui embeds the Ekilie Box superuser UI (the built Vite app).
//
// The UI is served at / by internal/app. Build it into dist with `make ui` (or `cd web && bun run build`).
package ui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// FS returns the embedded SPA rooted at dist/index.html.
func FS() fs.FS {
	sub, err := fs.Sub(files, "dist")
	if err != nil {
		panic("ui: embedded dist is missing: " + err.Error())
	}
	return sub
}

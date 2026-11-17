// Package extensions is Ekilie Box's extension registry.
//
// The standard PocketOne set (settings, tokens/OAuth, remotes, MCP, pages, S3 redirects, PITR, backups, bulk mail and
// deploy) is already on every app. This package is where Ekilie Box's own extras are added, so the composition root
// stays a list of product decisions rather than extension wiring.
package extensions

import (
	"github.com/pockethost/pocketone/ext/mailtrap"
	"github.com/pockethost/pocketone/ext/vacuum"

	"github.com/ekilie/box/internal/app"
)

// Register adds Ekilie Box's built-in extensions to the app.
func Register(box *app.App) {
	box.Add(
		// Compact SQLite databases on a schedule (Settings → Backups → Vacuum).
		vacuum.New(),
		// In dev mode with SMTP off, catch mail at http://127.0.0.1:8025 instead of using the host's sendmail.
		mailtrap.New(),
	)
}

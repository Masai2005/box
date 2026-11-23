// Command ekilie-box is Ekilie Box: a single-file, all-in-one backend-in-a-box built on PocketOne/PocketBase.
//
// This file is the composition root. It decides what the product is:
//
//   - app.New wires PocketOne/PocketBase, the config file and the optional static public directory;
//   - extensions.Register adds the built-in extras (vacuum, dev mail trap);
//   - commands.Register adds `info` and `upgrade`;
//   - Start registers the standard PocketOne extension set and runs the command tree.
//
// The console is the embedded SPA in internal/ui, served at /. Release builds use -tags no_ui, so PocketBase's
// stock dashboard is not included.
package main

import (
	"log"

	"github.com/pockethost/pocketone/ext/extkit"

	"github.com/ekilie/box/internal/app"
	"github.com/ekilie/box/internal/commands"
	"github.com/ekilie/box/internal/extensions"
	"github.com/ekilie/box/internal/pkg/ascii"
)

func main() {
	extkit.Command = app.Slug
	extkit.Version = app.Version

	ascii.PrintAscii()

	box, err := app.New()
	if err != nil {
		log.Fatal(err)
	}

	extensions.Register(box)
	commands.Register(box)

	if err := box.Start(); err != nil {
		log.Fatal(err)
	}
}

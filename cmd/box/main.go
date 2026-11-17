// Command ekilie-box is Ekilie Box: a single-file, all-in-one backend-in-a-box built on PocketOne/PocketBase.
//
// This file is the composition root. It decides what the product is:
//
//   - app.New wires PocketOne/PocketBase, the config file and the optional static public directory;
//   - extensions.Register adds the built-in extras (vacuum, dev mail trap);
//   - commands.Register adds `info` and `upgrade`;
//   - Start registers the standard PocketOne extension set and runs the command tree.
//
// The UI is PocketBase's stock superuser dashboard at /_/, so it is not listed here.
package main

import (
	"log"

	"github.com/pockethost/pocketone/ext/extkit"

	"github.com/ekilie/box/internal/app"
	"github.com/ekilie/box/internal/commands"
	"github.com/ekilie/box/internal/extensions"
)

func main() {
	extkit.Command = app.Slug
	extkit.Version = app.Version

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

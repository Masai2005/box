// Package commands adds Ekilie Box's product commands to the app's command tree.
//
// PocketOne adds its extension commands (contract operations, `pages`, `pitr`, ...) when the set is registered, and
// PocketBase's own commands (serve, superuser, migrate) are added by internal/app. This package owns the ones that are
// about the product itself.
package commands

import (
	"encoding/json"
	"fmt"
	"runtime"
	"strings"

	"github.com/spf13/cobra"

	"github.com/pockethost/pocketone/ext/config"
	"github.com/pockethost/pocketone/ext/pocker"
	"github.com/pockethost/pocketone/ext/upgrade"

	"github.com/ekilie/box/internal/app"
)

// Register adds info and upgrade.
func Register(box *app.App) {
	root := box.PB.RootCmd
	root.AddCommand(infoCommand(box))
	upgrade.MustRegister(box.PB, root, upgrade.Config{
		Owner:             "ekilie",
		Repo:              "box",
		ArchivePrefix:     app.Slug,
		ArchiveExecutable: app.Slug,
	})
}

type info struct {
	Product    string `json:"product"`
	Version    string `json:"version"`
	Commit     string `json:"commit,omitempty"`
	Engine     string `json:"engine"`
	Go         string `json:"go"`
	OS         string `json:"os"`
	Arch       string `json:"arch"`
	Dev        bool   `json:"dev"`
	DataDir    string `json:"dataDir"`
	ConfigFile string `json:"configFile,omitempty"`
	PublicSite string `json:"publicSite"`
	Dashboard  string `json:"dashboard"`
}

func infoCommand(box *app.App) *cobra.Command {
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "info",
		Short: "Print this build's version, paths and embedded components",
		RunE: func(cmd *cobra.Command, _ []string) error {
			i := info{
				Product:    box.Product.Name,
				Version:    box.Product.Version,
				Commit:     box.Product.Commit,
				Engine:     "PocketOne " + pocker.Version(),
				Go:         runtime.Version(),
				OS:         runtime.GOOS,
				Arch:       runtime.GOARCH,
				Dev:        box.PB.IsDev(),
				DataDir:    box.DataDir(),
				ConfigFile: box.Config.Path,
				PublicSite: box.PublicSource(),
				Dashboard:  dashboardURL(),
			}

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(i)
			}

			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "%s %s\n", i.Product, i.Version)
			if i.Commit != "" {
				fmt.Fprintf(out, "  commit     %s\n", i.Commit)
			}
			fmt.Fprintf(out, "  engine     %s\n", i.Engine)
			fmt.Fprintf(out, "  go         %s %s/%s\n", i.Go, i.OS, i.Arch)
			fmt.Fprintf(out, "  data       %s\n", i.DataDir)
			if i.ConfigFile == "" {
				fmt.Fprintf(out, "  config     defaults (no pocketone.yaml)\n")
			} else {
				fmt.Fprintf(out, "  config     %s\n", i.ConfigFile)
			}
			fmt.Fprintf(out, "  public     %s\n", i.PublicSite)
			fmt.Fprintf(out, "  dev        %v\n", i.Dev)
			fmt.Fprintln(out)
			fmt.Fprintf(out, "  start      %s serve\n", box.Product.Slug)
			fmt.Fprintf(out, "  dashboard  %s\n", i.Dashboard)
			return nil
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "print the information as JSON")
	return cmd
}

// dashboardURL guesses the dashboard address from the serve section (the real address is printed by `serve`).
func dashboardURL() string {
	srv, _ := config.Server.Get()
	scheme, addr := "http", srv.HTTP
	if srv.HTTPS != "" {
		scheme, addr = "https", srv.HTTPS
	}
	if addr == "" {
		addr = "127.0.0.1:8090"
	}
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	return scheme + "://" + addr + "/_/"
}

// Package app builds Ekilie Box's PocketOne/PocketBase application.
//
// It is the wiring layer: configuration, the standard PocketOne extension set, the optional static public directory, and
// the serve/execute lifecycle. The superuser console is the embedded SPA in internal/ui, served at /; product
// commands live in internal/commands and are added from the composition root (cmd/box/main.go).
package app

import (
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"ganigeorgiev.com/pocketbase/pocketbase"
	"ganigeorgiev.com/pocketbase/pocketbase/apis"
	"ganigeorgiev.com/pocketbase/pocketbase/cmd"
	"ganigeorgiev.com/pocketbase/pocketbase/core"
	"ganigeorgiev.com/pocketbase/pocketbase/plugins/migratecmd"
	"ganigeorgiev.com/pocketbase/pocketbase/tools/hook"
	"ganigeorgiev.com/pocketbase/pocketbase/tools/osutils"
	"github.com/spf13/cobra"

	"github.com/ekilie/box/internal/ui"
	"github.com/pockethost/pocketone/ext/config"
	"github.com/pockethost/pocketone/ext/extkit"
	"github.com/pockethost/pocketone/ext/jsvm"
	"github.com/pockethost/pocketone/ext/pages"
	"github.com/pockethost/pocketone/ext/standard"
)

const (
	// ConfigFileName is the default config file. PocketOne's loader defaults to pocketone.yaml, so Ekilie Box resolves
	// this name first and hands the path to the loader.
	ConfigFileName = "ekiliebox.yaml"
	// LegacyConfigFileName is still read when ekiliebox.yaml isn't present, so existing installs keep working.
	LegacyConfigFileName = "pocketone.yaml"
)

// Build identity. GoReleaser stamps Version and Commit with -X.
var (
	Name    = "Ekilie Box"
	Slug    = "ekilie-box"
	Version = "dev"
	Commit  = ""
	Website = "https://ekilie.cloud"
	Docs    = "https://ekilie.cloud/docs"
	Repo    = "https://github.com/ekilie/box"
)

// Product is the build's identity.
type Product struct {
	Name    string // "Ekilie Box"
	Slug    string // "ekilie-box": binary name, command name
	Version string // release version, or "dev"
	Commit  string // optional short commit
	Website string
	Docs    string
	Repo    string
}

// PoweredBy is the value of X-Powered-By ("Ekilie Box 0.1.0").
func (p Product) PoweredBy() string {
	version := p.Version
	if version == "" {
		version = "dev"
	}
	return p.Name + " " + version
}

// DefaultProduct returns the build identity from the stamped package variables.
func DefaultProduct() Product {
	return Product{
		Name:    Name,
		Slug:    Slug,
		Version: Version,
		Commit:  Commit,
		Website: Website,
		Docs:    Docs,
		Repo:    Repo,
	}
}

// App is one Ekilie Box application: the PocketBase instance plus the PocketOne extension set being assembled on it.
type App struct {
	PB      *pocketbase.PocketBase
	Set     *standard.Set
	Product Product
	Config  *config.Config

	StartedAt time.Time

	HooksDir      string
	HooksWatch    bool
	MigrationsDir string
	Automigrate   bool
	PagesDir      string
	PublicDir     string
	IndexFallback bool
}

// New builds the app from the command line and the optional ekiliebox.yaml.
//
// It does not start serving: extensions are added to App.Set by the composition root, and Start registers them
// (contracts, JS APIs, dashboard screens) before executing the command tree.
func New() (*App, error) {
	product := DefaultProduct()

	// ekiliebox.yaml, and its .env. FromArgs reads --config/--env-file before the full flag parse, because the app
	// section supplies the defaults of the flags below.
	cfgOpts := resolveConfigOptions(config.FromArgs(os.Args[1:]))
	cfg, err := config.Load(cfgOpts)
	if err != nil {
		return nil, err
	}
	appCfg, _ := config.App.Get()
	if err := cfg.AllowEnv(appCfg.EnvAllow); err != nil {
		return nil, err
	}

	pb := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDev:           or(appCfg.Dev, osutils.IsProbablyGoRun()),
		DefaultDataDir:       cfg.ResolvePath(appCfg.Dir),
		DefaultEncryptionEnv: appCfg.EncryptionEnv,
		DefaultQueryTimeout:  appCfg.QueryTimeout,
	})

	pb.RootCmd.Use = product.Slug
	pb.RootCmd.Short = product.Name + " is a single-file, all-in-one backend-in-a-box"
	pb.RootCmd.Version = product.Version
	pb.RootCmd.SetVersionTemplate("{{.Version}}\n")

	var cfgPath, envPath string
	pb.RootCmd.PersistentFlags().StringVar(&cfgPath, "config", cfgOpts.ConfigPath,
		"the config file (default ./ekiliebox.yaml, else next to the executable; pocketone.yaml is still read as a fallback)")
	pb.RootCmd.PersistentFlags().StringVar(&envPath, "env-file", cfgOpts.EnvPath,
		"secrets for $VAR references in the config file (default .env beside it); never passed to the app")
	pb.RootCmd.AddCommand(configCommand(cfgOpts))

	a := &App{
		PB:      pb,
		Set:     standard.New(),
		Product: product,
		Config:  cfg,
	}
	a.Set.Providers = standard.ConfiguredProviders()

	// ---------------------------------------------------------------
	// Flags whose defaults come from ekiliebox.yaml's app section.
	// ---------------------------------------------------------------

	pb.RootCmd.PersistentFlags().StringVar(
		&a.HooksDir,
		"hooksDir",
		cfg.ResolvePath(appCfg.HooksDir),
		"the directory with the JS app hooks (default ekilie_box_hooks next to ekilie_box_data)",
	)
	pb.RootCmd.PersistentFlags().BoolVar(
		&a.HooksWatch,
		"hooksWatch",
		or(appCfg.HooksWatch, true),
		"auto restart the app on ekilie_box_hooks file change; it has no effect on Windows",
	)
	pb.RootCmd.PersistentFlags().StringVar(
		&a.MigrationsDir,
		"migrationsDir",
		cfg.ResolvePath(appCfg.MigrationsDir),
		"the directory with the user defined migrations (default ekilie_box_migrations next to ekilie_box_data)",
	)
	pb.RootCmd.PersistentFlags().BoolVar(
		&a.Automigrate,
		"automigrate",
		or(appCfg.Automigrate, true),
		"enable/disable auto migrations",
	)

	publicDir := cfg.ResolvePath(appCfg.PublicDir)
	if publicDir == "" {
		publicDir = defaultPublicDir()
	}
	pb.RootCmd.PersistentFlags().StringVar(
		&a.PublicDir,
		"publicDir",
		publicDir,
		"the directory to serve static files (default ekilie_box_public next to the executable)",
	)
	pb.RootCmd.PersistentFlags().BoolVar(
		&a.IndexFallback,
		"indexFallback",
		or(appCfg.IndexFallback, true),
		"fallback the request to index.html on missing static path, e.g. when pretty urls are used with an SPA",
	)
	pb.RootCmd.PersistentFlags().StringVar(
		&a.PagesDir,
		"pagesDir",
		"",
		"the directory with the PocketPages app (default ekilie_box_pages next to ekilie_box_data); served when it exists",
	)

	// Defaults are in; read the actual flags now, before Start registers the set with these values.
	_ = pb.RootCmd.ParseFlags(os.Args[1:])

	a.bindBase()

	return a, nil
}

// Add registers extensions on every start, after the standard PocketOne members.
func (a *App) Add(extensions ...extkit.Extension) {
	a.Set.Add(extensions...)
}

// Start registers the standard set and the extensions added to it, then runs the command.
func (a *App) Start() error {
	a.StartedAt = time.Now()

	// pages can be pointed elsewhere with --pagesDir; everything else is configured in the set already.
	if a.PagesDir != "" {
		a.Set.Pages = pages.New(pages.Config{Dir: a.PagesDir})
	}

	// the extensions: contracts, routes, JS APIs, dashboard screens
	if err := a.Set.Register(a.PB, jsvm.Config{
		MigrationsDir: a.MigrationsDir,
		HooksDir:      a.HooksDir,
		HooksWatch:    a.HooksWatch,
	}); err != nil {
		return err
	}

	// `ekilie-box migrate ...`, with JS templates for ekilie_box_hooks/ekilie_box_migrations
	migratecmd.MustRegister(a.PB, a.PB.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  a.Automigrate,
		Dir:          a.MigrationsDir,
	})

	// system commands: superuser and serve, with the ekiliebox.yaml server section as serve's defaults
	serveCmd := cmd.NewServeCommand(a.PB, true)
	srv, _ := config.Server.Get()
	for flag, value := range map[string]string{
		"http":    srv.HTTP,
		"https":   srv.HTTPS,
		"origins": strings.Join(srv.Origins, ","),
	} {
		if value == "" {
			continue
		}
		if err := serveCmd.PersistentFlags().Set(flag, value); err != nil {
			return fmt.Errorf("server.%s: %w", flag, err)
		}
	}
	a.PB.RootCmd.AddCommand(cmd.NewSuperuserCommand(a.PB), serveCmd)

	return a.PB.Execute()
}

// DataDir is the resolved data directory (valid before bootstrap).
func (a *App) DataDir() string {
	return a.PB.DataDir()
}

// PublicSource describes the optional static directory, for the info command.
func (a *App) PublicSource() string {
	if a.PublicDir == "" {
		return "none"
	}
	return a.PublicDir
}

// bindBase installs the product-level HTTP behavior: the X-Powered-By header and the optional static directory.
// The superuser UI is PocketBase's own dashboard at /_/.
func (a *App) bindBase() {
	a.PB.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Priority: 999, // after user routes, so a custom GET /{path...} wins
		Func: func(se *core.ServeEvent) error {
			se.Router.BindFunc(func(re *core.RequestEvent) error {
				re.Response.Header().Set("X-Powered-By", a.Product.PoweredBy())
				return re.Next()
			})

			if !se.Router.HasRoute(http.MethodGet, "/{path...}") {
				// --publicDir (e.g. the Vite dev output) wins; otherwise serve the UI embedded in the binary.
				var fsys fs.FS
				if a.PublicDir != "" {
					if info, err := os.Stat(a.PublicDir); err == nil && info.IsDir() {
						fsys = os.DirFS(a.PublicDir)
					}
				}
				if fsys == nil {
					fsys = ui.FS()
				}

				static := apis.Static(fsys, a.IndexFallback)
				se.Router.GET("/{path...}", func(re *core.RequestEvent) error {
					p := re.Request.URL.Path
					// never let the SPA swallow unknown API or stock dashboard paths
					if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/_/") {
						return re.NotFoundError("", nil)
					}
					return static(re)
				})
			}

			return se.Next()
		},
	})
}

// defaultPublicDir is ekilie_box_public next to the executable (or the working directory for go run).
func defaultPublicDir() string {
	if osutils.IsProbablyGoRun() {
		return "./ekilie_box_public"
	}
	exe, err := os.Executable()
	if err != nil {
		return "ekilie_box_public"
	}
	return filepath.Join(filepath.Dir(exe), "ekilie_box_public")
}

// resolveConfigOptions picks ekiliebox.yaml (or the legacy pocketone.yaml) when --config wasn't given. The path is
// handed to PocketOne's loader explicitly, because the loader's own default file name is pocketone.yaml.
func resolveConfigOptions(opts config.Options) config.Options {
	if opts.ConfigPath != "" {
		return opts
	}
	for _, name := range []string{ConfigFileName, LegacyConfigFileName} {
		if path := findConfigFile(name); path != "" {
			opts.ConfigPath = path
			return opts
		}
	}
	return opts
}

// findConfigFile looks in the working directory, then next to the executable.
func findConfigFile(name string) string {
	if _, err := os.Stat(name); err == nil {
		return name
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	path := filepath.Join(filepath.Dir(exe), name)
	if _, err := os.Stat(path); err == nil {
		return path
	}
	return ""
}

// configCommand wraps PocketOne's config command and updates its help text to the Ekilie Box file name.
func configCommand(opts config.Options) *cobra.Command {
	cmd := config.NewCommand(func() config.Options { return opts })
	cmd.Short = strings.ReplaceAll(cmd.Short, LegacyConfigFileName, ConfigFileName)
	cmd.Long = strings.ReplaceAll(cmd.Long, LegacyConfigFileName, ConfigFileName)
	for _, sub := range cmd.Commands() {
		sub.Short = strings.ReplaceAll(sub.Short, LegacyConfigFileName, ConfigFileName)
		sub.Long = strings.ReplaceAll(sub.Long, LegacyConfigFileName, ConfigFileName)
	}
	return cmd
}

// or returns *v when set, else def.
func or(v *bool, def bool) bool {
	if v != nil {
		return *v
	}
	return def
}

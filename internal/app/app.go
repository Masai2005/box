// Package app builds Ekilie Box's PocketOne/PocketBase application.
//
// It is the wiring layer: configuration, the standard PocketOne extension set, the optional static public directory, and
// the serve/execute lifecycle. The UI is the stock PocketBase superuser dashboard; product commands live in
// internal/commands and are added from the composition root (cmd/base/main.go).
package app

import (
	"fmt"
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

	"github.com/pockethost/pocketone/ext/config"
	"github.com/pockethost/pocketone/ext/extkit"
	"github.com/pockethost/pocketone/ext/jsvm"
	"github.com/pockethost/pocketone/ext/pages"
	"github.com/pockethost/pocketone/ext/standard"
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

// New builds the app from the command line and the optional pocketone.yaml.
//
// It does not start serving: extensions are added to App.Set by the composition root, and Start registers them
// (contracts, JS APIs, dashboard screens) before executing the command tree.
func New() (*App, error) {
	product := DefaultProduct()

	// pocketone.yaml, and its .env. FromArgs reads --config/--env-file before the full flag parse, because the app
	// section supplies the defaults of the flags below.
	cfgOpts := config.FromArgs(os.Args[1:])
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
		"the config file (default ./pocketone.yaml, else next to the executable)")
	pb.RootCmd.PersistentFlags().StringVar(&envPath, "env-file", cfgOpts.EnvPath,
		"secrets for $VAR references in the config file (default .env beside it); never passed to the app")
	pb.RootCmd.AddCommand(config.NewCommand(func() config.Options { return cfgOpts }))

	a := &App{
		PB:      pb,
		Set:     standard.New(),
		Product: product,
		Config:  cfg,
	}
	a.Set.Providers = standard.ConfiguredProviders()

	// ---------------------------------------------------------------
	// Flags whose defaults come from pocketone.yaml's app section.
	// ---------------------------------------------------------------

	pb.RootCmd.PersistentFlags().StringVar(
		&a.HooksDir,
		"hooksDir",
		cfg.ResolvePath(appCfg.HooksDir),
		"the directory with the JS app hooks (default pb_hooks next to pb_data)",
	)
	pb.RootCmd.PersistentFlags().BoolVar(
		&a.HooksWatch,
		"hooksWatch",
		or(appCfg.HooksWatch, true),
		"auto restart the app on pb_hooks file change; it has no effect on Windows",
	)
	pb.RootCmd.PersistentFlags().StringVar(
		&a.MigrationsDir,
		"migrationsDir",
		cfg.ResolvePath(appCfg.MigrationsDir),
		"the directory with the user defined migrations (default pb_migrations next to pb_data)",
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
		"the directory to serve static files (default pb_public next to the executable)",
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
		"the directory with the PocketPages app (default pb_pages next to pb_data); served when it exists",
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

	// `ekilie-box migrate ...`, with JS templates for pb_hooks/pb_migrations
	migratecmd.MustRegister(a.PB, a.PB.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  a.Automigrate,
		Dir:          a.MigrationsDir,
	})

	// system commands: superuser and serve, with the pocketone.yaml server section as serve's defaults
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

			if !se.Router.HasRoute(http.MethodGet, "/{path...}") && a.PublicDir != "" {
				if info, err := os.Stat(a.PublicDir); err == nil && info.IsDir() {
					se.Router.GET("/{path...}", apis.Static(os.DirFS(a.PublicDir), a.IndexFallback))
				}
			}

			return se.Next()
		},
	})
}

// defaultPublicDir is pb_public next to the executable (or the working directory for go run).
func defaultPublicDir() string {
	if osutils.IsProbablyGoRun() {
		return "./pb_public"
	}
	exe, err := os.Executable()
	if err != nil {
		return "pb_public"
	}
	return filepath.Join(filepath.Dir(exe), "pb_public")
}

// or returns *v when set, else def.
func or(v *bool, def bool) bool {
	if v != nil {
		return *v
	}
	return def
}

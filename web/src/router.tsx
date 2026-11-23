import { Navigate, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { LogsPage } from "@/pages/LogsPage";
import { BulkMailPage } from "@/pages/BulkMailPage";
import { SettingsApplicationPage } from "@/pages/SettingsApplicationPage";
import { SettingsMailPage } from "@/pages/SettingsMailPage";
import { SettingsStoragePage } from "@/pages/SettingsStoragePage";
import { SettingsBackupsPage } from "@/pages/SettingsBackupsPage";
import { SettingsCronsPage } from "@/pages/SettingsCronsPage";
import { SettingsTokensPage } from "@/pages/SettingsTokensPage";
import { SettingsSqlPage } from "@/pages/SettingsSqlPage";
import { SettingsExportPage } from "@/pages/SettingsExportPage";
import { SettingsImportPage } from "@/pages/SettingsImportPage";
import { SchemaPage } from "@/pages/SchemaPage";
import { ApiExplorerPage } from "@/pages/ApiExplorerPage";
import { RealtimePage } from "@/pages/RealtimePage";
import { SecurityPage } from "@/pages/SecurityPage";
import { RuntimePage } from "@/pages/RuntimePage";
import { MigrationsPage } from "@/pages/MigrationsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function Loading() {
  return (
    <div className="dot-grid-bg flex min-h-screen items-center justify-center bg-background">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function RootComponent() {
  return <Outlet />;
}

function AuthedLayout() {
  const { ready, superuser } = useAuth();
  if (!ready) return <Loading />;
  if (!superuser) return <Navigate to="/login" />;
  return <AppShell />;
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });

// Pathless layout: login stays outside it, every console route only mounts for a ready superuser.
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  component: AuthedLayout,
});

const overviewRoute = createRoute({ getParentRoute: () => authedRoute, path: "/", component: OverviewPage });
const collectionsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/collections",
  validateSearch: (search: Record<string, unknown>) => {
    const result: { collection?: string; record?: string } = {};
    if (typeof search.collection === "string") result.collection = search.collection;
    if (typeof search.record === "string") result.record = search.record;
    return result;
  },
  component: CollectionsPage,
});
const logsRoute = createRoute({ getParentRoute: () => authedRoute, path: "/logs", component: LogsPage });
const bulkMailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/bulkmail",
  component: BulkMailPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings",
  component: SettingsApplicationPage,
});
const settingsMailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/mail",
  component: SettingsMailPage,
});
const settingsStorageRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/storage",
  component: SettingsStoragePage,
});
const settingsBackupsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/backups",
  component: SettingsBackupsPage,
});
const settingsCronsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/crons",
  component: SettingsCronsPage,
});
const settingsTokensRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/tokens",
  component: SettingsTokensPage,
});
const settingsSqlRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/sql",
  component: SettingsSqlPage,
});
const settingsExportRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/export",
  component: SettingsExportPage,
});
const settingsImportRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings/import",
  component: SettingsImportPage,
});
const schemaRoute = createRoute({ getParentRoute: () => authedRoute, path: "/schema", component: SchemaPage });
const apiExplorerRoute = createRoute({ getParentRoute: () => authedRoute, path: "/api-explorer", component: ApiExplorerPage });
const realtimeRoute = createRoute({ getParentRoute: () => authedRoute, path: "/realtime", component: RealtimePage });
const securityRoute = createRoute({ getParentRoute: () => authedRoute, path: "/security", component: SecurityPage });
const runtimeRoute = createRoute({ getParentRoute: () => authedRoute, path: "/runtime", component: RuntimePage });
const migrationsRoute = createRoute({ getParentRoute: () => authedRoute, path: "/migrations", component: MigrationsPage });

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    overviewRoute,
    collectionsRoute,
    logsRoute,
    bulkMailRoute,
    settingsRoute,
    settingsMailRoute,
    settingsStorageRoute,
    settingsBackupsRoute,
    settingsCronsRoute,
    settingsTokensRoute,
    settingsSqlRoute,
    settingsExportRoute,
    settingsImportRoute,
    schemaRoute,
    apiExplorerRoute,
    realtimeRoute,
    securityRoute,
    runtimeRoute,
    migrationsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

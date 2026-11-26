import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { NotFoundPage } from "@/pages/NotFoundPage";

const LoginPage = lazyRouteComponent(() => import("@/pages/LoginPage"), "LoginPage");
const OverviewPage = lazyRouteComponent(() => import("@/pages/OverviewPage"), "OverviewPage");
const CollectionsPage = lazyRouteComponent(() => import("@/pages/CollectionsPage"), "CollectionsPage");
const LogsPage = lazyRouteComponent(() => import("@/pages/LogsPage"), "LogsPage");
const BulkMailPage = lazyRouteComponent(() => import("@/pages/BulkMailPage"), "BulkMailPage");
const SettingsApplicationPage = lazyRouteComponent(
  () => import("@/pages/SettingsApplicationPage"),
  "SettingsApplicationPage",
);
const SettingsMailPage = lazyRouteComponent(
  () => import("@/pages/SettingsMailPage"),
  "SettingsMailPage",
);
const SettingsStoragePage = lazyRouteComponent(
  () => import("@/pages/SettingsStoragePage"),
  "SettingsStoragePage",
);
const SettingsBackupsPage = lazyRouteComponent(
  () => import("@/pages/SettingsBackupsPage"),
  "SettingsBackupsPage",
);
const SettingsCronsPage = lazyRouteComponent(
  () => import("@/pages/SettingsCronsPage"),
  "SettingsCronsPage",
);
const SettingsTokensPage = lazyRouteComponent(
  () => import("@/pages/SettingsTokensPage"),
  "SettingsTokensPage",
);
const SettingsSqlPage = lazyRouteComponent(
  () => import("@/pages/SettingsSqlPage"),
  "SettingsSqlPage",
);
const SettingsExportPage = lazyRouteComponent(
  () => import("@/pages/SettingsExportPage"),
  "SettingsExportPage",
);
const SettingsImportPage = lazyRouteComponent(
  () => import("@/pages/SettingsImportPage"),
  "SettingsImportPage",
);
const SchemaPage = lazyRouteComponent(() => import("@/pages/SchemaPage"), "SchemaPage");
const ApiExplorerPage = lazyRouteComponent(
  () => import("@/pages/ApiExplorerPage"),
  "ApiExplorerPage",
);
const ApiDocsPage = lazyRouteComponent(() => import("@/pages/ApiDocsPage"), "ApiDocsPage");
const ObservabilityPage = lazyRouteComponent(
  () => import("@/pages/ObservabilityPage"),
  "ObservabilityPage",
);
const StatusPage = lazyRouteComponent(() => import("@/pages/StatusPage"), "StatusPage");
const AuditPage = lazyRouteComponent(() => import("@/pages/AuditPage"), "AuditPage");
const AuthPage = lazyRouteComponent(() => import("@/pages/AuthPage"), "AuthPage");
const RealtimePage = lazyRouteComponent(() => import("@/pages/RealtimePage"), "RealtimePage");
const SecurityPage = lazyRouteComponent(() => import("@/pages/SecurityPage"), "SecurityPage");
const RuntimePage = lazyRouteComponent(() => import("@/pages/RuntimePage"), "RuntimePage");
const MigrationsPage = lazyRouteComponent(() => import("@/pages/MigrationsPage"), "MigrationsPage");

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
    const result: {
      collection?: string;
      record?: string;
      filter?: string;
      sort?: string;
      page?: number;
      perPage?: number;
      columns?: string;
      density?: "comfortable" | "compact";
      view?: string;
    } = {};
    if (typeof search.collection === "string") result.collection = search.collection;
    if (typeof search.record === "string") result.record = search.record;
    if (typeof search.filter === "string") result.filter = search.filter;
    if (typeof search.sort === "string") result.sort = search.sort;
    if (typeof search.columns === "string") result.columns = search.columns;
    if (search.density === "compact" || search.density === "comfortable") {
      result.density = search.density;
    }
    if (typeof search.view === "string") result.view = search.view;
    const page = Number(search.page);
    if (Number.isFinite(page) && page > 0) result.page = Math.floor(page);
    const perPage = Number(search.perPage);
    if (Number.isFinite(perPage) && perPage > 0) result.perPage = Math.floor(perPage);
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
const apiDocsRoute = createRoute({ getParentRoute: () => authedRoute, path: "/api-docs", component: ApiDocsPage });
const observabilityRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/observability",
  component: ObservabilityPage,
});
const statusRoute = createRoute({ getParentRoute: () => authedRoute, path: "/status", component: StatusPage });
const auditRoute = createRoute({ getParentRoute: () => authedRoute, path: "/audit", component: AuditPage });
const authRoute = createRoute({ getParentRoute: () => authedRoute, path: "/auth", component: AuthPage });
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
    apiDocsRoute,
    observabilityRoute,
    statusRoute,
    auditRoute,
    authRoute,
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

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Database,
  HardDrive,
  Key,
  Mail,
  RefreshCw,
  Terminal,
  Users,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatBytes, formatDate } from "@/lib/utils";

type Collection = { id: string; name: string; type: string; system?: boolean };
type Log = { id: string; level: number; message: string; created: string };
type Backup = { key: string; size: number; modified: string };

const LEVELS: Record<number, { label: string; variant: "default" | "secondary" | "warning" | "danger" }> = {
  [-4]: { label: "DEBUG", variant: "secondary" },
  0: { label: "INFO", variant: "default" },
  4: { label: "WARN", variant: "warning" },
  8: { label: "ERROR", variant: "danger" },
};

export function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [superusers, setSuperusers] = useState(0);
  const [crons, setCrons] = useState(0);
  const [dbSize, setDbSize] = useState(0);
  const [errorsCount, setErrorsCount] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const health = await fetch("/api/health", { cache: "no-store" });
      const poweredBy = health.headers.get("X-Powered-By") || "";
      const match = /^Ekilie Box\s+(.+)$/i.exec(poweredBy);
      setVersion(match ? match[1] : "");

      const [
        settingsResult,
        collectionsResult,
        logsResult,
        backupsResult,
        superusersResult,
        cronsResult,
        sqlResult,
        errorsResult,
      ] = await Promise.allSettled([
        pb.settings.getAll(),
        pb.collections.getFullList({ sort: "name" }),
        pb.logs.getList(1, 6, { sort: "-created" }),
        pb.backups.getFullList(),
        pb.collection("_superusers").getList(1, 1),
        pb.crons.getFullList(),
        pb.send("/api/sql", {
          method: "POST",
          body: {
            query:
              "SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS size",
          },
        }),
        pb.logs.getList(1, 1, { filter: "level >= 4" }),
      ]);

      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);
      if (collectionsResult.status === "fulfilled") setCollections(collectionsResult.value as Collection[]);
      if (logsResult.status === "fulfilled") setLogs(logsResult.value.items as unknown as Log[]);
      if (backupsResult.status === "fulfilled") setBackups(backupsResult.value as Backup[]);
      if (superusersResult.status === "fulfilled") setSuperusers(superusersResult.value.totalItems);
      if (cronsResult.status === "fulfilled") setCrons(cronsResult.value.length);
      if (sqlResult.status === "fulfilled") {
        setDbSize(Number((sqlResult.value as any)?.rows?.[0]?.[0]) || 0);
      }
      if (errorsResult.status === "fulfilled") setErrorsCount(errorsResult.value.totalItems);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const userCollections = collections.filter((collection) => !collection.name.startsWith("_"));

  return (
    <>
      <PageHeader
        title="Overview"
        description={settings?.meta?.appName || "Ekilie Box"}
        eyebrow="console"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw />
              Refresh
            </Button>
            <Link to="/collections" search={{ collection: undefined }}>
              <Button size="sm">
                Collections
                <ArrowUpRight />
              </Button>
            </Link>
          </>
        }
      />

      <PageBody className="space-y-6">
        {error ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-px border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-background p-5">
                <Skeleton className="mb-3 h-2.5 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          ) : (
            <>
              <Kpi label="Collections" value={String(collections.length)} icon={Database} />
              <Kpi label="Superusers" value={String(superusers)} icon={Users} />
              <Kpi label="Database" value={formatBytes(dbSize)} icon={HardDrive} />
              <Kpi label="Backups" value={String(backups.length)} icon={Archive} />
              <Kpi label="Cron jobs" value={String(crons)} icon={Terminal} />
              <Kpi label="Errors" value={String(errorsCount)} icon={AlertTriangle} />
            </>
          )}
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Collections</CardTitle>
              <Badge variant="accent">{collections.length} total</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : userCollections.length ? (
                <div className="divide-y divide-border">
                  {userCollections.slice(0, 8).map((collection) => (
                    <Link
                      key={collection.id}
                      to="/collections"
                      search={{ collection: collection.name }}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate font-mono text-xs font-semibold">{collection.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={collection.type === "auth" ? "accent" : "outline"}>
                          {collection.type}
                        </Badge>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="No collections yet" description="Create your first collection to get started." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>System</CardTitle>
              <Badge variant={version ? "success" : "outline"}>
                {version ? (/^\d/.test(version) ? `v${version}` : version) : "dev"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 text-xs sm:grid-cols-2">
              <Info label="Application" value={settings?.meta?.appName || "Ekilie Box"} />
              <Info label="Application URL" value={settings?.meta?.appURL || window.location.origin} mono />
              <Info label="Engine" value="PocketBase / PocketOne" />
              <Info label="Access" value="Superuser only" />
            </CardContent>
          </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Recent logs</CardTitle>
                <Link to="/logs" className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <>
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </>
                ) : logs.length ? (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <Badge variant={LEVELS[log.level]?.variant || "secondary"}>
                        {LEVELS[log.level]?.label || log.level}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[11px] text-foreground/80">{log.message}</p>
                        <p className="mt-1 font-mono text-[9px] text-muted-foreground">{formatDate(log.created)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No logs yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Quick to="/settings/backups" icon={Archive} label="Backups" />
                <Quick to="/settings/tokens" icon={Key} label="API tokens" />
                <Quick to="/settings/sql" icon={Terminal} label="SQL console" />
                <Quick to="/bulkmail" icon={Mail} label="Bulk mail" />
              </CardContent>
            </Card>
          </div>
        </div>

      </PageBody>
    </>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Database;
}) {
  return (
    <div className="bg-background p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-mono text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function Quick({ to, icon: Icon, label }: { to: string; icon: typeof Database; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 border border-border px-3 py-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}>{value}</p>
    </div>
  );
}

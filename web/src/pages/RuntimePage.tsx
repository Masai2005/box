import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Box, Cpu, Globe, HardDrive, Layers, ServerCog } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { pb } from "@/lib/pb";
import { formatBytes } from "@/lib/utils";

export function RuntimePage() {
  const [settings, setSettings] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [version, setVersion] = useState("");
  const [backups, setBackups] = useState(0);
  const [crons, setCrons] = useState(0);
  const [dbSize, setDbSize] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const healthRes = await fetch("/api/health", { cache: "no-store" });
        const poweredBy = healthRes.headers.get("X-Powered-By") || "";
        const match = /^Ekilie Box\s+(.+)$/i.exec(poweredBy);
        setVersion(match ? match[1] : "");
        setHealth(await healthRes.json().catch(() => null));

        const [settingsValue, backupList, cronList, sql] = await Promise.all([
          pb.settings.getAll().catch(() => null),
          pb.backups.getFullList().catch(() => []),
          pb.crons.getFullList().catch(() => []),
          pb
            .send("/api/sql", {
              method: "POST",
              body: {
                query:
                  "SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS size",
              },
            })
            .catch(() => null),
        ]);
        setSettings(settingsValue);
        setBackups((backupList as any[]).length);
        setCrons((cronList as any[]).length);
        const size = (sql as any)?.rows?.[0]?.[0];
        setDbSize(Number(size) || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Runtime"
        description="The single app this binary is running"
        eyebrow="operations/runtime"
        actions={<Badge variant="success">ONLINE</Badge>}
      />
      <PageBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Box} label="Version" value={version || "dev"} />
          <Stat icon={HardDrive} label="Database" value={formatBytes(dbSize)} />
          <Stat icon={Layers} label="Backups" value={String(backups)} />
          <Stat icon={Cpu} label="Cron jobs" value={String(crons)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>Identity and public address.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-xs sm:grid-cols-2">
            {loading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              <>
                <Info label="Name" value={settings?.meta?.appName || "Ekilie Box"} icon={Box} />
                <Info label="URL" value={settings?.meta?.appURL || window.location.origin} icon={Globe} mono />
                <Info label="Engine" value="PocketBase / PocketOne" icon={ServerCog} />
                <Info label="Health" value={health?.message || "API is healthy"} icon={Activity} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Single-node mode</CardTitle>
              <CardDescription>
                This binary runs one app. Fleet management is a separate control plane.
              </CardDescription>
            </div>
            <Badge variant="outline">SINGLE NODE</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Multi-instance hosting, deploy pipelines, per-service environment groups, domains and rollbacks are
              provided by PocketOne&apos;s <code>pocker</code>, <code>multisite</code>, <code>deploy</code> and{" "}
              <code>mothership</code> extensions. They need a control-plane UI and a host process — not a single-app
              binary.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/settings/backups">
                <Button variant="outline" size="sm">
                  <ArchiveIcon />
                  Backups
                </Button>
              </Link>
              <Link to="/settings/crons">
                <Button variant="outline" size="sm">
                  <Cpu className="h-4 w-4" />
                  Crons
                </Button>
              </Link>
              <Link to="/api-explorer">
                <Button variant="outline" size="sm">
                  API explorer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function ArchiveIcon() {
  return <Layers className="h-4 w-4" />;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Box;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border bg-card/50 p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="truncate font-mono text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string;
  value: string;
  icon: typeof Box;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={`break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

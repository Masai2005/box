import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatBytes, formatDate } from "@/lib/utils";

type Component = {
  id: string;
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
};

export function StatusPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [healthResponse, settingsResult, backupsResult, cronsResult, logsResult, scheduledResult, sqlResult] =
        await Promise.allSettled([
          fetch(pb.buildURL("/api/health"), { cache: "no-store" }),
          pb.settings.getAll(),
          pb.backups.getFullList(),
          pb.crons.getFullList(),
          pb.logs.getList(1, 1, { filter: "level >= 8" }),
          pb.collection("_ekilie_scheduled_requests").getFullList({ sort: "-created" }),
          pb.send("/api/sql", {
            method: "POST",
            body: {
              query:
                "SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS size",
            },
          }),
        ]);

      const list: Component[] = [];
      const issues: string[] = [];

      if (healthResponse.status === "fulfilled" && healthResponse.value.ok) {
        list.push({
          id: "api",
          name: "API",
          status: "ok",
          detail: healthResponse.value.headers.get("X-Powered-By") || "responding",
        });
      } else {
        list.push({ id: "api", name: "API", status: "error", detail: "health check failed" });
        issues.push("The API health check failed.");
      }

      if (sqlResult.status === "fulfilled") {
        const size = Number((sqlResult.value as any)?.rows?.[0]?.[0]) || 0;
        list.push({
          id: "database",
          name: "Database",
          status: "ok",
          detail: `${formatBytes(size)} SQLite`,
        });
      } else {
        list.push({ id: "database", name: "Database", status: "warning", detail: "size unavailable" });
      }

      const backups = backupsResult.status === "fulfilled" ? backupsResult.value : [];
      const lastBackup = (backups as any[])
        .slice()
        .sort((a, b) => String(b.modified).localeCompare(String(a.modified)))[0];
      list.push({
        id: "backups",
        name: "Backups",
        status: backups.length ? "ok" : "warning",
        detail: backups.length
          ? `${backups.length} archive(s), latest ${lastBackup ? formatDate(lastBackup.modified) : "unknown"}`
          : "no backups yet",
      });
      if (!backups.length) issues.push("No backups have been created.");

      const settings: any = settingsResult.status === "fulfilled" ? settingsResult.value : {};
      list.push({
        id: "mail",
        name: "Mail",
        status: settings.smtp?.enabled ? "ok" : "warning",
        detail: settings.smtp?.enabled ? String(settings.smtp.host || "SMTP configured") : "SMTP is off",
      });
      if (!settings.smtp?.enabled) issues.push("SMTP is not configured, so auth emails fall back to sendmail.");

      const crons = cronsResult.status === "fulfilled" ? cronsResult.value : [];
      list.push({
        id: "crons",
        name: "Crons",
        status: "ok",
        detail: `${crons.length} registered job(s)`,
      });

      const scheduled = scheduledResult.status === "fulfilled" ? (scheduledResult.value as any[]) : [];
      const scheduledErrors = scheduled.filter((item) => item.lastStatus >= 400 || item.lastError);
      list.push({
        id: "scheduled",
        name: "Scheduled requests",
        status: scheduledErrors.length ? "warning" : "ok",
        detail: `${scheduled.length} defined, ${scheduledErrors.length} reporting errors`,
      });
      if (scheduledErrors.length) issues.push(`${scheduledErrors.length} scheduled request(s) reported errors.`);

      const errors = logsResult.status === "fulfilled" ? logsResult.value.totalItems : 0;
      list.push({
        id: "errors",
        name: "Error log",
        status: errors ? "warning" : "ok",
        detail: `${errors} error entr${errors === 1 ? "y" : "ies"}`,
      });
      if (errors) issues.push(`${errors} error log entr${errors === 1 ? "y" : "ies"} recorded.`);

      setComponents(list);
      setWarnings(issues);
      setCheckedAt(new Date());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hasError = components.some((item) => item.status === "error");

  return (
    <>
      <PageHeader
        title="Status"
        description="Health and readiness checks for this instance"
        eyebrow="operations/status"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-5">
        <div
          className={`flex items-center gap-3 border p-4 ${
            hasError
              ? "border-destructive/30 bg-destructive/10"
              : warnings.length
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          {hasError ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : warnings.length ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em]">
              {hasError ? "Degraded" : warnings.length ? "Operational with warnings" : "All systems operational"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {checkedAt ? `Checked ${formatDate(checkedAt)}` : "Checking…"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>Local checks, not external uptime probes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : components.length ? (
              <div className="divide-y divide-border">
                {components.map((component) => (
                  <div key={component.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{component.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{component.detail}</span>
                    </div>
                    <Badge
                      variant={
                        component.status === "error"
                          ? "danger"
                          : component.status === "warning"
                            ? "warning"
                            : "success"
                      }
                    >
                      {component.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No status data" />
            )}
          </CardContent>
        </Card>

        {warnings.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Warnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {warnings.map((warning) => (
                <p key={warning} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}

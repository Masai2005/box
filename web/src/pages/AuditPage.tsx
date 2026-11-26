import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ExternalLink, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Select, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

type Log = {
  id: string;
  level: number;
  message: string;
  created: string;
  data?: Record<string, any>;
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await pb.logs.getList(1, 400, { sort: "-created" });
      setLogs(result.items as unknown as Log[]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const entries = useMemo(
    () =>
      logs
        .filter((log) => {
          const requestMethod = String(log.data?.method || "").toUpperCase();
          return MUTATING.has(requestMethod) && Boolean(log.data?.authId || log.data?.url);
        })
        .filter((log) => (method ? String(log.data?.method).toUpperCase() === method : true))
        .filter((log) =>
          query
            ? JSON.stringify(log).toLowerCase().includes(query.toLowerCase())
            : true,
        ),
    [logs, method, query],
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Mutating requests recorded in the app log"
        eyebrow="operations/audit"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <PageBody className="space-y-5">
        <div className="flex items-start gap-2 border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            This view is derived from request logs. It shows create, update and delete calls, including the
            authenticated account when the log recorded one. Increase log retention if you need a longer history.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search path, actor or message…"
              aria-label="Search audit entries"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select value={method} onChange={(event) => setMethod(event.target.value)} className="w-[160px]" aria-label="Filter method">
            <option value="">All methods</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </Select>
          <Badge variant="accent">{entries.length}</Badge>
          <Link to="/logs">
            <Button variant="outline" size="sm">
              Open logs
              <ExternalLink />
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent mutations</CardTitle>
            <CardDescription>Newest first, limited to the last 400 log entries.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : entries.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Method</th>
                      <th className="px-4 py-2">Path</th>
                      <th className="px-4 py-2">Actor</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((log) => (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <Badge variant={log.data?.method === "DELETE" ? "danger" : "outline"}>
                            {log.data?.method || "-"}
                          </Badge>
                        </td>
                        <td className="max-w-[360px] truncate px-4 py-2 font-mono text-[10px]" title={log.data?.url}>
                          {log.data?.url || log.message}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                          {log.data?.authId || "anonymous"}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px]">
                          {log.data?.status || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-[10px] text-muted-foreground">
                          {formatDate(log.created)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No audit entries" description="Mutating requests will appear here." />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

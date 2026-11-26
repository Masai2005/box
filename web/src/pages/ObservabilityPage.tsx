import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity, Clock3, Gauge, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

type Log = {
  id: string;
  level: number;
  message: string;
  created: string;
  data?: Record<string, any>;
};

const WINDOW = 500;

export function ObservabilityPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await pb.logs.getList(1, WINDOW, { sort: "-created" });
      setLogs(result.items as unknown as Log[]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const durations: number[] = [];
    let errors = 0;
    const slow: { log: Log; duration: number }[] = [];
    const buckets = new Map<string, { label: string; total: number; errors: number }>();

    for (const log of logs) {
      const duration = Number(log.data?.execTime);
      const status = Number(log.data?.status);
      const failed = log.level >= 8 || status >= 500;
      if (Number.isFinite(duration)) {
        durations.push(duration);
        if (duration >= 500) slow.push({ log, duration });
      }
      if (failed) errors++;
      const date = new Date(log.created);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getHours()}:${Math.floor(date.getMinutes() / 5) * 5}`;
      const bucket = buckets.get(key) || {
        label: `${String(date.getHours()).padStart(2, "0")}:${String(Math.floor(date.getMinutes() / 5) * 5).padStart(2, "0")}`,
        total: 0,
        errors: 0,
      };
      bucket.total++;
      if (failed) bucket.errors++;
      buckets.set(key, bucket);
    }

    durations.sort((a, b) => a - b);
    const percentile = (value: number) => {
      if (!durations.length) return 0;
      return durations[Math.min(durations.length - 1, Math.floor((value / 100) * durations.length))];
    };

    return {
      total: logs.length,
      errors,
      errorRate: logs.length ? (errors / logs.length) * 100 : 0,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      slow: slow.sort((a, b) => b.duration - a.duration).slice(0, 12),
      buckets: Array.from(buckets.values()).slice(-24).reverse(),
    };
  }, [logs]);

  const peak = Math.max(1, ...metrics.buckets.map((bucket) => bucket.total));

  return (
    <>
      <PageHeader
        title="Observability"
        description={`Metrics from the last ${WINDOW} log entries`}
        eyebrow="operations/observability"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <PageBody className="space-y-5">
        {error ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Requests" value={String(metrics.total)} icon={Activity} />
          <Metric label="Errors" value={String(metrics.errors)} icon={AlertTriangle} />
          <Metric label="Error rate" value={`${metrics.errorRate.toFixed(1)}%`} icon={Gauge} />
          <Metric label="p50" value={`${metrics.p50.toFixed(0)} ms`} icon={Clock3} />
          <Metric label="p95" value={`${metrics.p95.toFixed(0)} ms`} icon={Zap} />
        </div>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Request volume</CardTitle>
              <CardDescription>Five-minute buckets from the fetched log window.</CardDescription>
            </div>
            <Badge variant="accent">p99 {metrics.p99.toFixed(0)} ms</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : metrics.buckets.length ? (
              <VolumeChart buckets={metrics.buckets} peak={peak} />
            ) : (
              <EmptyState title="No request data" description="Generate some requests and refresh." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slow requests</CardTitle>
            <CardDescription>Requests taking 500 ms or more in this window.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : metrics.slow.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Method</th>
                      <th className="px-4 py-2">Path</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Duration</th>
                      <th className="px-4 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.slow.map(({ log, duration }) => (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-[10px]">{log.data?.method || "-"}</td>
                        <td className="max-w-[360px] truncate px-4 py-2 font-mono text-[10px]">
                          {log.data?.url || log.message}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={Number(log.data?.status) >= 400 ? "danger" : "outline"}>
                            {log.data?.status || "-"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-amber-600">{duration.toFixed(1)} ms</td>
                        <td className="whitespace-nowrap px-4 py-2 text-[10px] text-muted-foreground">
                          {formatDate(log.created)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No slow requests" description="Nothing crossed the 500 ms threshold." />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="bg-card/50 p-5">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function VolumeChart({
  buckets,
  peak,
}: {
  buckets: { label: string; total: number; errors: number }[];
  peak: number;
}) {
  const width = 100;
  const height = 100;
  const points = buckets.map((bucket, index) => {
    const x = buckets.length === 1 ? width / 2 : (index / (buckets.length - 1)) * width;
    const y = height - Math.max(2, (bucket.total / peak) * (height - 6));
    const ey = height - Math.max(2, (bucket.errors / peak) * (height - 6));
    return { x, y, ey };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const errorLine = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.ey.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible">
        <defs>
          <linearGradient id="observability-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#observability-fill)" />
        <path d={line} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={errorLine} fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{buckets[0]?.label}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 bg-accent" />requests</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 bg-destructive" />errors</span>
        </span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}

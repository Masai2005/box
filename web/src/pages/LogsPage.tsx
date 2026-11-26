import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, Radio, RefreshCw, Save, Search, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

type Log = { id: string; level: number; message: string; data?: Record<string, any>; created: string };

const LEVELS: Record<number, { label: string; variant: "default" | "secondary" | "warning" | "danger" }> = {
  [-4]: { label: "DEBUG", variant: "secondary" },
  0: { label: "INFO", variant: "default" },
  4: { label: "WARN", variant: "warning" },
  8: { label: "ERROR", variant: "danger" },
};

const LEVEL_FILTERS = [
  { value: "", label: "All levels" },
  { value: "level = 0", label: "Info" },
  { value: "level = 4", label: "Warning" },
  { value: "level = 8", label: "Error" },
  { value: "level = -4", label: "Debug" },
];

const PER_PAGE = 30;
const FILTERS_KEY = "ekilie-box-log-filters";

type SavedFilter = { name: string; filter: string; level: string };

function readSavedFilters(): SavedFilter[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function VolumeChart({ stats, peak }: { stats: { date: string; total: number }[]; peak: number }) {
  if (!stats.length) {
    return <p className="py-8 text-center text-xs text-muted-foreground">No stats yet.</p>;
  }

  const values = stats.slice(-60);
  const width = 100;
  const height = 100;
  const points = values.map((point, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - Math.max(2, (point.total / peak) * (height - 4));
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-24 w-full overflow-visible">
        <defs>
          <linearGradient id="log-volume-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#log-volume-fill)" />
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{values[0]?.date ? formatDate(values[0].date) : ""}</span>
        <span>peak {peak}</span>
        <span>{values[values.length - 1]?.date ? formatDate(values[values.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-[10px]" title={value}>{value}</p>
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("");
  const [stats, setStats] = useState<{ date: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Log | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [maxDays, setMaxDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(readSavedFilters);

  const combinedFilter = useMemo(() => {
    return [filter.trim(), level].filter(Boolean).join(" && ");
  }, [filter, level]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [list, chart] = await Promise.all([
        pb.logs.getList(page, PER_PAGE, {
          sort: "-created",
          filter: combinedFilter || undefined,
        }),
        pb.logs.getStats({ filter: combinedFilter || undefined }).catch(() => []),
      ]);
      setLogs(list.items as unknown as Log[]);
      setTotal(list.totalItems);
      setStats((chart as any[]) || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load(live && liveTick > 0);
  }, [page, combinedFilter, liveTick]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setLiveTick((value) => value + 1), 3000);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    setPage(1);
  }, [combinedFilter]);

  async function openSettings() {
    setSettingsOpen(true);
    try {
      const settings = await pb.settings.getAll();
      setMaxDays(String(settings.logs?.maxDays ?? 7));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      const settings = await pb.settings.getAll();
      await pb.settings.update({ logs: { ...settings.logs, maxDays: Number(maxDays) || 0 } });
      toast.success("Log settings saved.");
      setSettingsOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function truncate() {
    if (!window.confirm("Delete all logs? This cannot be undone.")) return;
    setBusy(true);
    try {
      await pb.send("/api/logs", { method: "DELETE" });
      toast.success("Logs deleted.");
      setSettingsOpen(false);
      setPage(1);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function saveFilter() {
    const name = window.prompt("Name this log filter");
    if (!name?.trim()) return;
    const next = [
      { name: name.trim(), filter, level },
      ...savedFilters.filter((item) => item.name !== name.trim()),
    ].slice(0, 25);
    setSavedFilters(next);
    localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
    toast.success("Filter saved.");
  }

  function applyFilter(name: string) {
    const saved = savedFilters.find((item) => item.name === name);
    if (!saved) return;
    setFilter(saved.filter);
    setLevel(saved.level);
  }

  function deleteFilter() {
    const saved = savedFilters.find((item) => item.name === filterName);
    if (!saved || !window.confirm(`Delete the saved filter "${saved.name}"?`)) return;
    const next = savedFilters.filter((item) => item.name !== saved.name);
    setSavedFilters(next);
    localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  }

  const filterName = savedFilters.find(
    (item) => item.filter === filter && item.level === level,
  )?.name || "";

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const peak = Math.max(1, ...stats.map((point) => point.total));

  return (
    <>
      <PageHeader
        title="Logs"
        description={`${total} entries`}
        eyebrow="observability"
        actions={
          <>
            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((value) => !value)}
            >
              <Radio />
              {live ? "Live" : "Go live"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
              <RefreshCw />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={openSettings}>
              <Settings2 />
              Settings
            </Button>
          </>
        }
      />

      <PageBody className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Volume
              </span>
              <Badge variant="accent">{total} total</Badge>
            </div>
            <VolumeChart stats={stats} peak={peak} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder='Filter, e.g. message ~ "error"'
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          <Select value={level} onChange={(event) => setLevel(event.target.value)} className="w-[160px]" aria-label="Log level">
            {LEVEL_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={filterName}
            onChange={(event) => applyFilter(event.target.value)}
            className="w-[180px]"
            aria-label="Saved log filters"
          >
            <option value="">Saved filters</option>
            {savedFilters.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={saveFilter}>
            <Save />
            Save filter
          </Button>
          {filterName ? (
            <Button variant="ghost" size="icon" onClick={deleteFilter} aria-label="Delete saved filter">
              <Trash2 />
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={LEVELS[log.level]?.variant || "secondary"}>
                          {LEVELS[log.level]?.label || log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[520px] truncate text-xs">{log.message}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                        {formatDate(log.created)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setPreview(log)}>
                          <Eye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState title="No logs found" description="Try clearing the filter." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </PageBody>

      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Log entry"
        description={preview ? formatDate(preview.created) : undefined}
        className="max-w-3xl"
        footer={
          preview ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(preview, null, 2));
                toast.success("Log copied.");
              }}
            >
              <Copy />
              Copy JSON
            </Button>
          ) : null
        }
      >
        {preview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={LEVELS[preview.level]?.variant || "secondary"}>
                {LEVELS[preview.level]?.label || preview.level}
              </Badge>
              <span className="text-xs">{preview.message}</span>
            </div>
            <div className="grid gap-2 border border-border p-3 text-xs sm:grid-cols-3">
              <Detail label="Request ID" value={preview.data?.requestId || preview.data?.request_id || "-"} />
              <Detail label="Method" value={preview.data?.method || preview.data?.request?.method || "-"} />
              <Detail label="Path" value={preview.data?.url || preview.data?.path || preview.data?.request?.url || "-"} />
              <Detail label="Status" value={String(preview.data?.status || preview.data?.response?.status || "-")} />
              <Detail label="Duration" value={preview.data?.execTime ? `${preview.data.execTime} ms` : "-"} />
              <Detail label="User" value={preview.data?.authId || preview.data?.user || "-"} />
            </div>
            <pre className="max-h-[50vh] overflow-auto border border-border bg-background p-4 font-mono text-[11px] scrollbar-thin">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Log settings"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={truncate} disabled={busy}>
              <Trash2 />
              Delete all logs
            </Button>
            <Button onClick={saveSettings} disabled={busy}>
              Save
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="maxDays">Keep logs for (days)</Label>
          <Input
            id="maxDays"
            type="number"
            min={0}
            value={maxDays}
            onChange={(event) => setMaxDays(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">0 keeps logs forever.</p>
        </div>
      </Dialog>
    </>
  );
}

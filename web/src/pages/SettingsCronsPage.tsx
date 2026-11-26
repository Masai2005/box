import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { discardChanges, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { formatDate } from "@/lib/utils";

type Cron = { id: string; expression: string };

type ScheduledRequest = {
  id: string;
  name: string;
  schedule: string;
  method: string;
  url: string;
  headers?: Record<string, string> | null;
  body?: string;
  timeout?: number;
  enabled?: boolean;
  lastRun?: string;
  lastStatus?: number;
  lastDuration?: number;
  lastError?: string;
  runCount?: number;
};

type Run = {
  id: string;
  requestId: string;
  name?: string;
  status?: number;
  duration?: number;
  error?: string;
  response?: string;
  created: string;
};

type Form = {
  name: string;
  schedule: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  timeout: number;
  enabled: boolean;
};

const COLLECTION = "_ekilie_scheduled_requests";
const RUNS_COLLECTION = "_ekilie_scheduled_runs";
const JOB_PREFIX = "ekilie-scheduled:";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const PRESETS = [
  ["Every 5 minutes", "*/5 * * * *"],
  ["Every hour", "0 * * * *"],
  ["Every day at 03:00", "0 3 * * *"],
  ["Every Monday at 09:00", "0 9 * * 1"],
];

const emptyForm = (): Form => ({
  name: "",
  schedule: "0 * * * *",
  method: "POST",
  url: "",
  headers: "{}",
  body: "",
  timeout: 30,
  enabled: true,
});

export function SettingsCronsPage() {
  const [crons, setCrons] = useState<Cron[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRequest[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState("");
  const [scheduledError, setScheduledError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledRequest | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setScheduledError("");
    try {
      const [native, requests, history] = await Promise.allSettled([
        pb.crons.getFullList(),
        pb.collection(COLLECTION).getFullList({ sort: "-created" }),
        pb.collection(RUNS_COLLECTION).getList(1, 50, { sort: "-created" }),
      ]);
      if (native.status === "fulfilled") {
        setCrons(native.value.filter((job) => !job.id.startsWith(JOB_PREFIX)));
      }
      else toast.error(errorMessage(native.reason));
      if (requests.status === "fulfilled") {
        setScheduled(requests.value as unknown as ScheduledRequest[]);
      } else {
        setScheduledError(errorMessage(requests.reason));
      }
      if (history.status === "fulfilled") {
        setRuns(history.value.items as unknown as Run[]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = dialogOpen && baseline !== "" && baseline !== JSON.stringify(form);
  useUnsavedChanges(dirty);

  function openCreate() {
    const next = emptyForm();
    setEditing(null);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(record: ScheduledRequest) {
    const next: Form = {
      name: record.name,
      schedule: record.schedule,
      method: record.method,
      url: record.url,
      headers: JSON.stringify(record.headers || {}, null, 2),
      body: record.body || "",
      timeout: record.timeout || 30,
      enabled: record.enabled !== false,
    };
    setEditing(record);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setFormError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    discardChanges(dirty, () => setDialogOpen(false));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");

    if (!form.name.trim()) {
      setFormError("A name is required.");
      return;
    }
    if (!form.schedule.trim()) {
      setFormError("A cron expression is required.");
      return;
    }
    let parsedURL: URL;
    try {
      parsedURL = new URL(form.url);
    } catch {
      setFormError("Enter an absolute http or https URL.");
      return;
    }
    if (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:") {
      setFormError("Enter an absolute http or https URL.");
      return;
    }

    let headers: Record<string, string> = {};
    try {
      const raw = form.headers.trim() ? JSON.parse(form.headers) : {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
      for (const value of Object.values(raw)) {
        if (typeof value !== "string") throw new Error("not strings");
      }
      headers = raw as Record<string, string>;
    } catch {
      setFormError('Headers must be a JSON object with string values, for example {"Authorization":"Bearer …"}.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      schedule: form.schedule.trim(),
      method: form.method,
      url: form.url.trim(),
      headers,
      body: form.body,
      timeout: Number(form.timeout) || 30,
      enabled: form.enabled,
    };

    setSaving(true);
    try {
      if (editing) {
        await pb.collection(COLLECTION).update(editing.id, payload);
        toast.success("Scheduled request updated.");
      } else {
        await pb.collection(COLLECTION).create(payload);
        toast.success("Scheduled request created.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function run(record: ScheduledRequest) {
    setRunning(record.id);
    try {
      const result = await pb.send(`/api/_c/scheduled-requests/v1/${record.id}/run`, {
        method: "POST",
      });
      if (result?.error) toast.error(result.error);
      else toast.success(`HTTP ${result?.status || "?"} in ${result?.duration || 0} ms.`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning("");
    }
  }

  async function toggle(record: ScheduledRequest) {
    try {
      await pb.collection(COLLECTION).update(record.id, { enabled: record.enabled === false });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(record: ScheduledRequest) {
    if (!window.confirm(`Delete the scheduled request "${record.name}"?`)) return;
    try {
      await pb.collection(COLLECTION).delete(record.id);
      toast.success("Scheduled request deleted.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function runNative(id: string) {
    setRunning(id);
    try {
      await pb.crons.run(id);
      toast.success(`Triggered ${id}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning("");
    }
  }

  const enabledCount = useMemo(
    () => scheduled.filter((item) => item.enabled !== false).length,
    [scheduled],
  );

  return (
    <>
      <PageHeader
        title="Crons"
        description="Scheduled HTTP requests and code-registered jobs"
        eyebrow="settings/crons"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New request
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Scheduled requests run from the server. Only superusers can create them, and they can reach private
            network addresses, so only point them at trusted endpoints.
          </span>
        </div>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Scheduled requests</CardTitle>
              <CardDescription>
                {scheduled.length
                  ? `${scheduled.length} total, ${enabledCount} enabled`
                  : "Call an HTTP endpoint on a cron schedule."}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus />
              New request
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {scheduledError ? (
              <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {scheduledError}
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : scheduled.length ? (
                  scheduled.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <p className="font-mono text-[11px] font-bold">{record.name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {record.runCount || 0} run{record.runCount === 1 ? "" : "s"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.schedule}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{record.method}</Badge>
                          <span className="truncate font-mono text-[10px] text-muted-foreground" title={record.url}>
                            {record.url}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RunStatus record={record} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {record.lastRun ? (
                          <span title={record.lastError || undefined}>
                            {formatDate(record.lastRun)}
                            {record.lastDuration ? ` · ${record.lastDuration} ms` : ""}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={record.enabled !== false}
                          onCheckedChange={() => toggle(record)}
                          label={`Enable ${record.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={running === record.id}
                            onClick={() => run(record)}
                            aria-label={`Run ${record.name} now`}
                          >
                            <Play />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(record)}
                            aria-label={`Edit ${record.name}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(record)}
                            aria-label={`Delete ${record.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        title="No scheduled requests"
                        description="Create a request to call an HTTP endpoint on a cron schedule."
                        action={
                          <Button onClick={openCreate}>
                            <Plus />
                            New request
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Latest executions with status, duration and response.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : runs.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Request</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Duration</th>
                      <th className="px-4 py-2">Response</th>
                      <th className="px-4 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const failed = Boolean(run.error) || Number(run.status) >= 400;
                      return (
                        <tr key={run.id} className="border-t border-border">
                          <td className="px-4 py-2 font-mono text-[10px]">{run.name || run.requestId}</td>
                          <td className="px-4 py-2">
                            <Badge variant={failed ? "danger" : "success"}>{run.status || (run.error ? "ERR" : "-")}</Badge>
                          </td>
                          <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                            {run.duration ? `${run.duration} ms` : "-"}
                          </td>
                          <td className="max-w-[320px] truncate px-4 py-2 font-mono text-[10px] text-muted-foreground" title={run.error || run.response}>
                            {run.error || run.response || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-[10px] text-muted-foreground">{formatDate(run.created)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No runs yet" description="Run a scheduled request to build a history." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Code-registered jobs
            </CardTitle>
            <CardDescription>
              Jobs added with <code>cronAdd()</code> in JS hooks or <code>app.Cron().Add()</code> in Go. They can be
              triggered here but are defined in code.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Expression</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : crons.length ? (
                  crons.map((cron) => (
                    <TableRow key={cron.id}>
                      <TableCell className="font-mono text-[11px]">{cron.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cron.expression}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={running === cron.id}
                          onClick={() => runNative(cron.id)}
                          aria-label={`Run ${cron.id}`}
                        >
                          <Play />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No code-registered jobs"
                        description="Add one with cronAdd() in a JS hook or app.Cron().Add() in Go."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? `Edit ${editing.name}` : "New scheduled request"}
        description="The request runs from this server on the schedule below."
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="scheduled-request-form" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create request"}
            </Button>
          </>
        }
      >
        <form id="scheduled-request-form" onSubmit={save} className="space-y-4">
          {formError ? (
            <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="request-name">Name</Label>
              <Input
                id="request-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nightly webhook"
              />
            </div>
            <div>
              <Label htmlFor="request-timeout">Timeout (seconds)</Label>
              <Input
                id="request-timeout"
                type="number"
                min={1}
                max={300}
                value={form.timeout}
                onChange={(event) => setForm({ ...form, timeout: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <Label htmlFor="request-schedule">Cron expression</Label>
              <Input
                id="request-schedule"
                value={form.schedule}
                onChange={(event) => setForm({ ...form, schedule: event.target.value })}
                placeholder="0 3 * * *"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Five fields: minute, hour, day of month, month, day of week.
              </p>
            </div>
            <div>
              <Label htmlFor="request-preset">Presets</Label>
              <Select
                id="request-preset"
                value=""
                onChange={(event) => {
                  if (event.target.value) setForm({ ...form, schedule: event.target.value });
                }}
              >
                <option value="">Choose a preset…</option>
                {PRESETS.map(([label, expression]) => (
                  <option key={expression} value={expression}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div>
              <Label htmlFor="request-method">Method</Label>
              <Select
                id="request-method"
                value={form.method}
                onChange={(event) => setForm({ ...form, method: event.target.value })}
              >
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="request-url">URL</Label>
              <Input
                id="request-url"
                type="url"
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
                placeholder="https://example.com/webhook"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="request-headers">Headers (JSON)</Label>
            <Textarea
              id="request-headers"
              rows={4}
              className="font-mono"
              value={form.headers}
              onChange={(event) => setForm({ ...form, headers: event.target.value })}
              placeholder='{"Authorization":"Bearer token"}'
            />
          </div>

          <div>
            <Label htmlFor="request-body">Body</Label>
            <Textarea
              id="request-body"
              rows={6}
              className="font-mono"
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder='{"event":"nightly"}'
              disabled={form.method === "GET" || form.method === "HEAD"}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Sent as the raw request body. GET and HEAD requests ignore it.
            </p>
          </div>

          <label className="flex items-center gap-3 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <Switch
              checked={form.enabled}
              onCheckedChange={(enabled) => setForm({ ...form, enabled })}
              label="Enable schedule"
            />
            Enabled
          </label>
        </form>
      </Dialog>
    </>
  );
}

function RunStatus({ record }: { record: ScheduledRequest }) {
  if (!record.lastRun) return <Badge variant="outline">Never run</Badge>;
  if (record.lastError) {
    return (
      <span title={record.lastError}>
        <Badge variant="danger">Error</Badge>
      </span>
    );
  }
  const status = Number(record.lastStatus) || 0;
  if (status >= 200 && status < 400) return <Badge variant="success">HTTP {status}</Badge>;
  if (status >= 400) return <Badge variant="danger">HTTP {status}</Badge>;
  return <Badge variant="warning">No response</Badge>;
}

import { useEffect, useMemo, useState } from "react";
import { Copy, Play, RefreshCw } from "lucide-react";
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
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "@/components/ui";
import { pb } from "@/lib/pb";

type Collection = { id: string; name: string; type: string; fields: any[] };

const RECORD_OPS = [
  { value: "list", label: "List" },
  { value: "view", label: "View" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

const SYSTEM_OPS = [
  { value: "health", label: "Health" },
  { value: "settings", label: "Settings" },
  { value: "logs", label: "Logs" },
  { value: "backups", label: "Backups" },
  { value: "crons", label: "Crons" },
  { value: "tokens", label: "API tokens" },
];

export function ApiExplorerPage() {
  const [tab, setTab] = useState("records");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collection, setCollection] = useState("");
  const [op, setOp] = useState("list");
  const [recordId, setRecordId] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("-created");
  const [page, setPage] = useState("1");
  const [perPage, setPerPage] = useState("30");
  const [body, setBody] = useState("{}");
  const [systemOp, setSystemOp] = useState("health");
  const [response, setResponse] = useState<any>(null);
  const [result, setResult] = useState<{ status: number; ms: number; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collections
      .getFullList({ sort: "name" })
      .then((list) => {
        setCollections(list as Collection[]);
        setCollection((current) => current || list[0]?.name || "");
      })
      .catch((err) => toast.error(err?.message || "Could not load collections."))
      .finally(() => setLoading(false));
  }, []);

  const selected = collections.find((item) => item.name === collection);

  const request = useMemo(() => {
    if (tab === "system") {
      const path =
        systemOp === "tokens"
          ? "/api/_c/tokens/v1"
          : systemOp === "settings"
            ? "/api/settings"
            : systemOp === "logs"
              ? "/api/logs?page=1&perPage=10&sort=-created"
              : systemOp === "backups"
                ? "/api/backups"
                : systemOp === "crons"
                  ? "/api/crons"
                  : "/api/health";
      return { method: "GET", path, auth: true, query: "" };
    }

    const base = `/api/collections/${encodeURIComponent(collection || "users")}/records`;
    const query = new URLSearchParams();
    if (op === "list") {
      if (filter.trim()) query.set("filter", filter.trim());
      if (sort.trim()) query.set("sort", sort.trim());
      query.set("page", page || "1");
      query.set("perPage", perPage || "30");
    }
    switch (op) {
      case "view":
        return { method: "GET", path: `${base}/${encodeURIComponent(recordId || "RECORD_ID")}`, auth: true, query: "" };
      case "create":
        return { method: "POST", path: base, auth: true, query: "" };
      case "update":
        return { method: "PATCH", path: `${base}/${encodeURIComponent(recordId || "RECORD_ID")}`, auth: true, query: "" };
      case "delete":
        return { method: "DELETE", path: `${base}/${encodeURIComponent(recordId || "RECORD_ID")}`, auth: true, query: "" };
      default:
        return { method: "GET", path: base, auth: true, query: query.toString() };
    }
  }, [tab, systemOp, op, collection, filter, sort, page, perPage, recordId]);

  async function send() {
    setBusy(true);
    setResponse(null);
    setResult(null);
    const started = performance.now();
    try {
      const path = request.query ? `${request.path}?${request.query}` : request.path;
      const headers: Record<string, string> = {};
      if (pb.authStore.token) headers.Authorization = pb.authStore.token;
      if (["POST", "PATCH", "PUT"].includes(request.method)) headers["Content-Type"] = "application/json";
      const res = await fetch(pb.buildURL(path), {
        method: request.method,
        headers,
        body: ["POST", "PATCH", "PUT"].includes(request.method) ? body : undefined,
      });
      const text = await res.text();
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // keep text
      }
      setResult({ status: res.status, ms: Math.round(performance.now() - started) });
      setResponse(parsed);
    } catch (err: any) {
      setResult({ status: 0, ms: Math.round(performance.now() - started), error: err?.message || String(err) });
      setResponse({ error: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  }

  const curl = useMemo(() => {
    const path = request.query ? `${request.path}?${request.query}` : request.path;
    const url = `${window.location.origin}${path}`;
    const bodyPart = ["POST", "PATCH", "PUT"].includes(request.method)
      ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`
      : "";
    return `curl -X ${request.method} "${url}" \\\n  -H "Authorization: $TOKEN"${bodyPart}`;
  }, [request, body]);

  return (
    <>
      <PageHeader
        title="API explorer"
        description="Same-origin REST requests with your superuser session"
        eyebrow="developer/api"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setBody("{}")}>
              Reset body
            </Button>
            <Button size="sm" onClick={send} disabled={busy}>
              <Play />
              {busy ? "Sending…" : "Send request"}
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <Tabs
          tabs={[
            { value: "records", label: "Records" },
            { value: "system", label: "System" },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request</CardTitle>
                <CardDescription>{request.method} {request.path}{request.query ? `?${request.query}` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tab === "records" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Collection</Label>
                        {loading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <Select value={collection} onChange={(event) => setCollection(event.target.value)}>
                            {collections.map((item) => (
                              <option key={item.id} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                      <div>
                        <Label>Operation</Label>
                        <Select value={op} onChange={(event) => setOp(event.target.value)}>
                          {RECORD_OPS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {["view", "update", "delete"].includes(op) ? (
                      <div>
                        <Label>Record ID</Label>
                        <Input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="record id" />
                      </div>
                    ) : null}

                    {op === "list" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Filter</Label>
                          <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder='title ~ "hello"' />
                        </div>
                        <div>
                          <Label>Sort</Label>
                          <Input value={sort} onChange={(event) => setSort(event.target.value)} placeholder="-created" />
                        </div>
                        <div>
                          <Label>Page</Label>
                          <Input type="number" min={1} value={page} onChange={(event) => setPage(event.target.value)} />
                        </div>
                        <div>
                          <Label>Per page</Label>
                          <Input type="number" min={1} max={500} value={perPage} onChange={(event) => setPerPage(event.target.value)} />
                        </div>
                      </div>
                    ) : null}

                    {["create", "update"].includes(op) ? (
                      <div>
                        <Label>JSON body</Label>
                        <Textarea
                          rows={10}
                          className="font-mono"
                          value={body}
                          onChange={(event) => setBody(event.target.value)}
                          placeholder='{"title":"hello"}'
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Fields: {selected?.fields?.filter((field) => !field.system).map((field) => field.name).join(", ") || "—"}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div>
                    <Label>System endpoint</Label>
                    <Select value={systemOp} onChange={(event) => setSystemOp(event.target.value)}>
                      {SYSTEM_OPS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Runs as the current superuser. Settings and logs require superuser auth.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>cURL</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(curl);
                    toast.success("Copied.");
                  }}
                >
                  <Copy />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto border border-border bg-background p-4 font-mono text-[11px] scrollbar-thin">
                  {curl}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Response</CardTitle>
                <CardDescription>
                  {result
                    ? result.error
                      ? result.error
                      : `HTTP ${result.status} · ${result.ms} ms`
                    : "Send a request to see the response."}
                </CardDescription>
              </div>
              {result ? (
                <Badge variant={result.status >= 200 && result.status < 300 ? "success" : "danger"}>
                  {result.status || "ERR"}
                </Badge>
              ) : (
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent className="p-0">
              {busy ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : response !== null ? (
                <pre className="max-h-[70vh] overflow-auto border-t border-border p-4 font-mono text-[11px] scrollbar-thin">
                  {typeof response === "string" ? response : JSON.stringify(response, null, 2)}
                </pre>
              ) : (
                <EmptyState
                  title="No response yet"
                  description="Choose an endpoint and press Send request."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

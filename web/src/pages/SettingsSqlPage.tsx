import { useState } from "react";
import { Download, Play, Trash2 } from "lucide-react";
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

type Result = {
  columns?: { name: string }[];
  rows?: any[][];
  affectedRows?: number;
};

const HISTORY_KEY = "ekilie-box-sql-history";

export function SettingsSqlPage() {
  const [query, setQuery] = useState("SELECT name, type FROM _collections ORDER BY name");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });

  async function run() {
    const sql = query.trim();
    if (!sql || busy) return;
    const readOnly = /^(select|pragma|explain|with)\b/i.test(sql);
    if (!readOnly && !window.confirm("This query can modify or delete data. Execute it?")) {
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = (await pb.send("/api/sql", { method: "POST", body: { query: sql } })) as Result;
      setResult(data);
      const next = [sql, ...history.filter((item) => item !== sql)].slice(0, 12);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      toast.success("Query executed.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  function exportCsv() {
    if (!result?.columns?.length || !result.rows?.length) return;
    const rows = [result.columns.map((column) => column.name), ...result.rows];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ekilie-box-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeader
        title="SQL console"
        description="Read-only recommended. Max 1000 rows, 3 minute timeout."
        eyebrow="settings/sql"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result?.rows?.length}>
              <Download />
              Export CSV
            </Button>
            <Button size="sm" onClick={run} disabled={busy}>
              <Play />
              {busy ? "Running…" : "Execute"}
            </Button>
          </>
        }
      />

      <PageBody className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_240px]">
          <Card>
            <CardHeader>
              <CardTitle>Query</CardTitle>
              <CardDescription>SQLite syntax. Writes are confirmed first.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={10}
                className="font-mono"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                spellCheck={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>History</CardTitle>
              <Button variant="ghost" size="icon" onClick={clearHistory} aria-label="Clear history">
                <Trash2 />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              {history.length ? (
                history.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="block w-full truncate border border-transparent px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground hover:border-border hover:text-foreground"
                    title={item}
                  >
                    {item.replace(/\s+/g, " ").slice(0, 48)}
                  </button>
                ))
              ) : (
                <p className="p-2 text-xs text-muted-foreground">No recent queries.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Result</CardTitle>
            {result ? (
              <div className="flex items-center gap-2">
                {typeof result.affectedRows === "number" ? (
                  <Badge variant="accent">{result.affectedRows} affected</Badge>
                ) : null}
                <Badge variant="outline">{result.rows?.length || 0} rows</Badge>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {busy ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : result?.columns?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((column) => (
                      <TableHead key={column.name}>{column.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result.rows || []).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((value, cellIndex) => (
                        <TableCell key={cellIndex} className="max-w-[320px] truncate font-mono text-[10px]">
                          {value === null || value === undefined ? (
                            <span className="text-muted-foreground">NULL</span>
                          ) : (
                            String(value)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!result.rows?.length ? (
                    <TableRow>
                      <TableCell colSpan={result.columns.length}>
                        <EmptyState title="No rows found" />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No result yet" description="Run a query to see its rows here." />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
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
  Input,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

export function MigrationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result: any = await pb.send("/api/sql", {
        method: "POST",
        body: { query: "SELECT file, applied FROM _migrations ORDER BY applied DESC" },
      });
      setColumns((result.columns || []).map((column: any) => column.name));
      setRows(result.rows || []);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        row.some((value: any) => String(value ?? "").toLowerCase().includes(query.toLowerCase())),
      ),
    [rows, query],
  );

  const latest = rows[0]?.[1];

  return (
    <>
      <PageHeader
        title="Migrations"
        description="Applied schema migrations"
        eyebrow="database/migrations"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border border-border bg-card/50 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Applied</p>
            <p className="mt-2 font-mono text-2xl font-bold">{rows.length}</p>
          </div>
          <div className="border border-border bg-card/50 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Latest</p>
            <p className="mt-2 truncate font-mono text-xs">{String(rows[0]?.[0] || "-")}</p>
          </div>
          <div className="border border-border bg-card/50 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Last applied</p>
            <p className="mt-2 font-mono text-xs">{latest ? formatDate(String(latest)) : "-"}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Applied migrations</CardTitle>
              <CardDescription>{rows.length} entries from the _migrations table</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-[220px] pl-9"
                  placeholder="Search migrations…"
                  aria-label="Search migrations"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Badge variant="accent">{filtered.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columns.length || 2}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length ? (
                  filtered.map((row, index) => (
                    <TableRow key={index}>
                      {row.map((value: any, cellIndex: number) => (
                        <TableCell
                          key={cellIndex}
                          className={cellIndex === 0 ? "font-mono text-[10px]" : "text-[10px] text-muted-foreground"}
                        >
                          {columns[cellIndex] === "applied" ? formatDate(value) : String(value ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length || 2}>
                      <EmptyState title="No migrations" description="No applied migration files found." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollback guidance</CardTitle>
            <CardDescription>How to undo or repair a migration safely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Migrations are applied in order. To roll back, add a new migration that reverses the change instead of
              editing an already-applied file.
            </p>
            <p>
              Run <code className="font-mono text-foreground">./ekilie-box migrate down</code> to revert one applied
              migration, or <code className="font-mono text-foreground">./ekilie-box migrate down 3</code> to revert
              three. Take a backup first if the migration changed or removed data.
            </p>
            <p>
              Migration files live in <code className="font-mono text-foreground">ekilie_box_migrations</code> unless
              configured otherwise. Keep them in version control and never rename a file that has already run.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

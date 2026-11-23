import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

export function MigrationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Applied migrations</CardTitle>
              <CardDescription>{rows.length} entries from the _migrations table</CardDescription>
            </div>
            <Badge variant="accent">{rows.length}</Badge>
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
                ) : rows.length ? (
                  rows.map((row, index) => (
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
      </PageBody>
    </>
  );
}

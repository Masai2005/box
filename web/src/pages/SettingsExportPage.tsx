import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

export function SettingsExportPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const list = await pb.collections.getFullList({ sort: "name" });
      setCollections(list);
      setSelected(Object.fromEntries(list.map((collection) => [collection.id, true])));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const chosen = useMemo(
    () => collections.filter((collection) => selected[collection.id]),
    [collections, selected],
  );

  function download() {
    const data = chosen.map((collection) => {
      const copy = JSON.parse(JSON.stringify(collection));
      delete copy.created;
      delete copy.updated;
      if (copy.oauth2) delete copy.oauth2.providers;
      return copy;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ekilie-box-schema.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggleAll(value: boolean) {
    setSelected(Object.fromEntries(collections.map((collection) => [collection.id, value])));
  }

  return (
    <>
      <PageHeader
        title="Export collections"
        description="Download a schema snapshot as JSON"
        eyebrow="settings/export"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw />
              Refresh
            </Button>
            <Button size="sm" onClick={download} disabled={!chosen.length}>
              <Download />
              Download JSON
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Collections</CardTitle>
              <CardDescription>Select what to include in the export.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"> </TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  collections.map((collection) => (
                    <TableRow key={collection.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[collection.id])}
                          onChange={(event) =>
                            setSelected((current) => ({
                              ...current,
                              [collection.id]: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[hsl(var(--accent))]"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{collection.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{collection.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(collection.fields || []).filter((field: any) => !field.system).length}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>{chosen.length} collections selected</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[40vh] overflow-auto border border-border bg-background p-4 font-mono text-[10px] scrollbar-thin">
              {JSON.stringify(
                chosen.map((collection) => ({
                  name: collection.name,
                  type: collection.type,
                  fields: (collection.fields || [])
                    .filter((field: any) => !field.system)
                    .map((field: any) => ({ name: field.name, type: field.type })),
                })),
                null,
                2,
              )}
            </pre>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

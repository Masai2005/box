import { useEffect, useMemo, useState } from "react";
import { FileUp, RefreshCw, Upload } from "lucide-react";
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
  Input,
  Label,
  Switch,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

export function SettingsImportPage() {
  const [current, setCurrent] = useState<any[]>([]);
  const [imported, setImported] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setCurrent(await pb.collections.getFullList({ sort: "name" }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Expected an array of collections.");
      setImported(data);
    } catch (err) {
      setImported(null);
      toast.error(errorMessage(err));
    }
  }

  const diff = useMemo(() => {
    if (!imported) return { added: [], changed: [], same: [], removed: [] };
    const byName = new Map(current.map((collection) => [collection.name, collection]));
    const importedNames = new Set<string>();
    const added: any[] = [];
    const changed: any[] = [];
    const same: any[] = [];

    for (const collection of imported) {
      importedNames.add(collection.name);
      const existing = byName.get(collection.name);
      if (!existing) {
        added.push(collection);
      } else if (JSON.stringify(existing.fields) !== JSON.stringify(collection.fields)) {
        changed.push(collection);
      } else {
        same.push(collection);
      }
    }

    const removed = current.filter((collection) => !importedNames.has(collection.name));
    return { added, changed, same, removed };
  }, [current, imported]);

  const fieldDiffs = useMemo(() => {
    if (!imported) return [];
    const byName = new Map(current.map((collection) => [collection.name, collection]));
    return imported
      .map((collection) => {
        const existing = byName.get(collection.name);
        if (!existing) return null;
        const oldFields = new Map((existing.fields || []).map((field: any) => [field.name, field]));
        const newFields = new Map((collection.fields || []).map((field: any) => [field.name, field]));
        const added = [...newFields.keys()].filter((name) => !oldFields.has(name));
        const removed = [...oldFields.keys()].filter((name) => !newFields.has(name));
        const changed = [...newFields.keys()].filter((name) => {
          const oldField = oldFields.get(name);
          const newField = newFields.get(name);
          return oldField && newField && JSON.stringify(oldField) !== JSON.stringify(newField);
        });
        if (!added.length && !removed.length && !changed.length) return null;
        return { name: collection.name, added, removed, changed };
      })
      .filter(Boolean);
  }, [current, imported]);

  async function apply() {
    if (!imported) return;
    if (
      !window.confirm(
        `Import ${imported.length} collections${deleteMissing ? " and delete missing collections" : ""}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await pb.collections.import(imported, deleteMissing);
      toast.success("Collections imported.");
      setImported(null);
      setFileName("");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Import collections"
        description="Apply a schema snapshot"
        eyebrow="settings/import"
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Schema file</CardTitle>
            <CardDescription>Select a JSON export from Ekilie Box or PocketBase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schema-file">JSON file</Label>
              <Input id="schema-file" type="file" accept="application/json,.json" onChange={pickFile} />
              {fileName ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Loaded <span className="text-foreground">{fileName}</span> with {imported?.length || 0}{" "}
                  collections.
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <Switch checked={deleteMissing} onCheckedChange={setDeleteMissing} />
              Delete collections not present in the file
            </label>
          </CardContent>
        </Card>

        {imported ? (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Detected changes</CardTitle>
                <CardDescription>Review before applying.</CardDescription>
              </div>
              <Button onClick={apply} disabled={busy}>
                <Upload />
                {busy ? "Importing…" : "Import"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Added" value={diff.added.length} variant="success" names={diff.added} />
                <Stat label="Changed" value={diff.changed.length} variant="warning" names={diff.changed} />
                <Stat label="Unchanged" value={diff.same.length} variant="outline" names={diff.same} />
                <Stat label="Removed" value={deleteMissing ? diff.removed.length : 0} variant="danger" names={deleteMissing ? diff.removed : []} />
              </div>

              {fieldDiffs.length ? (
                <div className="overflow-auto border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Collection</th>
                        <th className="px-3 py-2">Added fields</th>
                        <th className="px-3 py-2">Changed fields</th>
                        <th className="px-3 py-2">Removed fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldDiffs.map((entry: any) => (
                        <tr key={entry.name} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-[10px]">{entry.name}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-emerald-600">
                            {entry.added.join(", ") || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-amber-600">
                            {entry.changed.join(", ") || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-destructive">
                            {entry.removed.join(", ") || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em]">No file loaded</p>
              <p className="text-xs text-muted-foreground">Choose a schema JSON export above.</p>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
  variant,
  names,
}: {
  label: string;
  value: number;
  variant: "success" | "warning" | "outline" | "danger";
  names: any[];
}) {
  return (
    <div className="border border-border p-4">
      <Badge variant={variant}>{label}</Badge>
      <div className="mt-3 font-mono text-2xl font-bold">{value}</div>
      {names.length ? (
        <p className="mt-2 line-clamp-3 text-[10px] text-muted-foreground">
          {names.map((item) => item.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

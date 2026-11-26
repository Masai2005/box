import { useEffect, useMemo, useState } from "react";
import { Download, File, HardDrive, RefreshCw, Save, Trash2, Upload } from "lucide-react";
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { filterRedacted } from "@/lib/utils";
import { discardChanges, useUnsavedChanges } from "@/lib/useUnsavedChanges";

function get(object: any, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function set(object: any, path: string, value: any) {
  const next = JSON.parse(JSON.stringify(object || {}));
  const parts = path.split(".");
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] = cursor[parts[i]] || {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

export function SettingsStoragePage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [fileToken, setFileToken] = useState("");
  const [baseline, setBaseline] = useState("");
  const [usage, setUsage] = useState<{ collection: string; field: string; files: number; records: number }[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [settingsValue, collectionList] = await Promise.all([
        pb.settings.getAll(),
        pb.collections.getFullList({ sort: "name" }),
      ]);
      setSettings(settingsValue);
      setBaseline(JSON.stringify(settingsValue));
      const withFiles = (collectionList as any[]).filter((collection) =>
        (collection.fields || []).some((field: any) => field.type === "file"),
      );
      setCollections(withFiles);
      setSelectedCollection((current) => current || withFiles[0]?.name || "");
      pb.files.getToken().then(setFileToken).catch(() => {});
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = Boolean(settings && baseline) && baseline !== JSON.stringify(settings);
  useUnsavedChanges(dirty);

  function reload() {
    discardChanges(dirty, load);
  }

  useEffect(() => {
    if (!selectedCollection) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    pb.collection(selectedCollection)
      .getList(1, 50, { sort: "-created" })
      .then((result) => setRecords(result.items))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setRecordsLoading(false));
  }, [selectedCollection]);

  const fileFields = useMemo(
    () =>
      (collections.find((collection) => collection.name === selectedCollection)?.fields || []).filter(
        (field: any) => field.type === "file",
      ),
    [collections, selectedCollection],
  );

  async function loadUsage() {
    if (!collections.length) {
      setUsage([]);
      return;
    }
    setUsageLoading(true);
    try {
      const results = await Promise.allSettled(
        collections.map(async (collection) => {
          const fields = (collection.fields || []).filter((field: any) => field.type === "file");
          if (!fields.length) return [];
          const rows = await pb.collection(collection.name).getFullList({
            fields: ["id", ...fields.map((field: any) => field.name)].join(","),
          });
          return fields.map((field: any) => {
            let files = 0;
            let records = 0;
            for (const record of rows as any[]) {
              const value = record[field.name];
              const names = Array.isArray(value) ? value : value ? [value] : [];
              if (names.length) records++;
              files += names.length;
            }
            return { collection: collection.name, field: field.name, files, records };
          });
        }),
      );
      setUsage(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])) as any,
      );
    } finally {
      setUsageLoading(false);
    }
  }

  useEffect(() => {
    void loadUsage();
  }, [collections]);

  const fileRows = useMemo(() => {
    const rows: { record: any; field: string; name: string; protected?: boolean }[] = [];
    for (const record of records) {
      for (const field of fileFields) {
        const value = record[field.name];
        const names = Array.isArray(value) ? value : value ? [value] : [];
        for (const name of names) {
          if (name) rows.push({ record, field: field.name, name, protected: Boolean(field.protected) });
        }
      }
    }
    return rows;
  }, [records, fileFields]);

  function update(path: string, value: any) {
    setSettings((current: any) => set(current, path, value));
  }

  async function refreshFiles() {
    if (!selectedCollection) return;
    setRecordsLoading(true);
    try {
      const result = await pb.collection(selectedCollection).getList(1, 50, { sort: "-created" });
      setRecords(result.items);
      void loadUsage();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRecordsLoading(false);
    }
  }

  async function deleteFile(row: { record: any; field: string; name: string }) {
    if (!window.confirm(`Delete ${row.name} from this record?`)) return;
    try {
      const data = new FormData();
      data.append(`${row.field}-`, row.name);
      await pb.collection(selectedCollection).update(row.record.id, data);
      toast.success("File deleted.");
      await refreshFiles();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function replaceFile(row: { record: any; field: string; name: string }) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = new FormData();
        data.append(`${row.field}-`, row.name);
        data.append(`+${row.field}`, file);
        await pb.collection(selectedCollection).update(row.record.id, data);
        toast.success("File replaced.");
        await refreshFiles();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    };
    input.click();
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const updated = await pb.settings.update(filterRedacted(settings));
      setSettings(updated);
      setBaseline(JSON.stringify(updated));
      toast.success("Storage settings saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const s3Enabled = Boolean(get(settings, "s3.enabled"));

  return (
    <>
      <PageHeader
        title="File storage"
        description="Local disk or S3-compatible storage"
        eyebrow="settings/storage"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading || busy}>
              <RefreshCw />
              Reload
            </Button>
            <Button size="sm" onClick={save} disabled={loading || busy}>
              <Save />
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        {loading || !settings ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Storage driver</CardTitle>
                  <CardDescription>
                    Local disk is the default. S3 moves uploads and thumbnails to a bucket.
                  </CardDescription>
                </div>
                <Switch checked={s3Enabled} onCheckedChange={(value) => update("s3.enabled", value)} />
              </CardHeader>
              <CardContent>
                <Select value={s3Enabled ? "s3" : "local"} onChange={(event) => update("s3.enabled", event.target.value === "s3")}>
                  <option value="local">Local disk (pb_data/storage)</option>
                  <option value="s3">S3-compatible bucket</option>
                </Select>
              </CardContent>
            </Card>

            {s3Enabled ? (
              <Card>
                <CardHeader>
                  <CardTitle>S3</CardTitle>
                  <CardDescription>AWS S3, Cloudflare R2, MinIO, Backblaze B2, etc.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Endpoint</Label>
                    <Input
                      value={get(settings, "s3.endpoint") || ""}
                      onChange={(event) => update("s3.endpoint", event.target.value)}
                      placeholder="https://s3.example.com"
                    />
                  </div>
                  <div>
                    <Label>Bucket</Label>
                    <Input
                      value={get(settings, "s3.bucket") || ""}
                      onChange={(event) => update("s3.bucket", event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Region</Label>
                    <Input
                      value={get(settings, "s3.region") || ""}
                      onChange={(event) => update("s3.region", event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Access key</Label>
                    <Input
                      value={get(settings, "s3.accessKey") || ""}
                      onChange={(event) => update("s3.accessKey", event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Secret</Label>
                    <Input
                      type="password"
                      value={get(settings, "s3.secret") || ""}
                      onChange={(event) => update("s3.secret", event.target.value)}
                      placeholder="****** (unchanged)"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      <Switch
                        checked={Boolean(get(settings, "s3.forcePathStyle"))}
                        onCheckedChange={(value) => update("s3.forcePathStyle", value)}
                      />
                      Force path-style addressing
                    </label>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Storage usage</CardTitle>
                <CardDescription>File counts by collection and file field.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {usageLoading ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ) : usage.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collection</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Files</TableHead>
                        <TableHead>Records with files</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.map((row) => (
                        <TableRow key={`${row.collection}-${row.field}`}>
                          <TableCell className="font-mono text-[10px]">{row.collection}</TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground">{row.field}</TableCell>
                          <TableCell className="font-mono text-[11px]">{row.files}</TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{row.records}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState title="No stored files" description="Upload files to a file field to see usage here." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Uploaded files</CardTitle>
                  <CardDescription>
                    Browse files stored in file fields. Protected files are read with your superuser file token.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  {collections.length ? (
                    <Select
                      value={selectedCollection}
                      onChange={(event) => setSelectedCollection(event.target.value)}
                      className="w-[200px]"
                    >
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.name}>
                          {collection.name}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!collections.length ? (
                  <EmptyState
                    title="No file fields"
                    description="Add a file field to a collection to store uploads."
                  />
                ) : recordsLoading ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ) : fileRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Record</TableHead>
                        <TableHead>Protection</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileRows.map((row) => {
                        const url = pb.files.getURL(row.record, row.name, fileToken ? { token: fileToken } : {});
                        const image = /\.(png|jpe?g|gif|webp|svg)$/i.test(row.name);
                        return (
                          <TableRow key={`${row.record.id}-${row.field}-${row.name}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {image ? (
                                  <img src={url} alt={row.name} className="h-9 w-9 object-cover" />
                                ) : (
                                  <File className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="max-w-[240px] truncate font-mono text-[10px]">{row.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{row.field}</TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {row.record.id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.protected ? "accent" : "outline"}>
                                {row.protected ? "protected" : "public"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" aria-label="Open file">
                                    <Download />
                                  </Button>
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => replaceFile(row)}
                                  aria-label={`Replace ${row.name}`}
                                >
                                  <Upload />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteFile(row)}
                                  aria-label={`Delete ${row.name}`}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    title="No uploads"
                    description={`No files found in ${selectedCollection} yet.`}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}

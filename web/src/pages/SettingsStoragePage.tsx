import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { filterRedacted } from "@/lib/utils";

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

  async function load() {
    setLoading(true);
    try {
      setSettings(await pb.settings.getAll());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(path: string, value: any) {
    setSettings((current: any) => set(current, path, value));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const updated = await pb.settings.update(filterRedacted(settings));
      setSettings(updated);
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
            <Button variant="outline" size="sm" onClick={load} disabled={loading || busy}>
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
          </>
        )}
      </PageBody>
    </>
  );
}

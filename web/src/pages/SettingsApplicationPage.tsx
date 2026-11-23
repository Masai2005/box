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
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { filterRedacted } from "@/lib/utils";

function setNested(object: any, path: string, value: any) {
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

function getNested(object: any, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

export function SettingsApplicationPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const value = await pb.settings.getAll();
      setSettings(value);
      setAdvanced(JSON.stringify(filterRedacted(value), null, 2));
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
    setSettings((current: any) => setNested(current, path, value));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      let payload = filterRedacted(settings);
      if (showAdvanced) {
        try {
          payload = JSON.parse(advanced);
        } catch {
          toast.error("Advanced settings must be valid JSON.");
          setBusy(false);
          return;
        }
      }
      const updated = await pb.settings.update(payload);
      setSettings(updated);
      setAdvanced(JSON.stringify(filterRedacted(updated), null, 2));
      toast.success("Application settings saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Application settings"
        description="Name, URL, batch limits and superuser access"
        eyebrow="settings/application"
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
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Application</CardTitle>
                <CardDescription>How this instance identifies itself.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="appName">Application name</Label>
                  <Input
                    id="appName"
                    value={getNested(settings, "meta.appName") || ""}
                    onChange={(event) => update("meta.appName", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="appURL">Application URL</Label>
                  <Input
                    id="appURL"
                    value={getNested(settings, "meta.appURL") || ""}
                    onChange={(event) => update("meta.appURL", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="accentColor">Accent color</Label>
                  <Input
                    id="accentColor"
                    value={getNested(settings, "meta.accentColor") || ""}
                    onChange={(event) => update("meta.accentColor", event.target.value)}
                    placeholder="#da500b"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <Switch
                      checked={Boolean(getNested(settings, "meta.hideControls"))}
                      onCheckedChange={(value) => update("meta.hideControls", value)}
                    />
                    Hide collection and record controls
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Batch API</CardTitle>
                <CardDescription>Limits for /api/batch requests.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <Switch
                      checked={Boolean(getNested(settings, "batch.enabled"))}
                      onCheckedChange={(value) => update("batch.enabled", value)}
                    />
                    Enabled
                  </label>
                </div>
                <div>
                  <Label htmlFor="batchMax">Max requests</Label>
                  <Input
                    id="batchMax"
                    type="number"
                    value={getNested(settings, "batch.maxRequests") || 0}
                    onChange={(event) => update("batch.maxRequests", Number(event.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="batchTimeout">Timeout (seconds)</Label>
                  <Input
                    id="batchTimeout"
                    type="number"
                    value={getNested(settings, "batch.timeout") || 0}
                    onChange={(event) => update("batch.timeout", Number(event.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Superuser access</CardTitle>
                <CardDescription>
                  Optional IP allow-list. Empty allows every IP. Be careful not to lock yourself out.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="superuserIPs">Allowed IPs / subnets</Label>
                <Textarea
                  id="superuserIPs"
                  value={(settings.superuserIPs || []).join("\n")}
                  onChange={(event) =>
                    update(
                      "superuserIPs",
                      event.target.value
                        .split(/[\n,]/)
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="127.0.0.1"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Advanced</CardTitle>
                  <CardDescription>Raw settings JSON. Secrets are omitted.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAdvanced((value) => !value)}>
                  {showAdvanced ? "Hide" : "Show"}
                </Button>
              </CardHeader>
              {showAdvanced ? (
                <CardContent>
                  <Textarea
                    rows={18}
                    className="font-mono"
                    value={advanced}
                    onChange={(event) => setAdvanced(event.target.value)}
                  />
                </CardContent>
              ) : null}
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}

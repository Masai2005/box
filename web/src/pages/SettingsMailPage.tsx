import { useEffect, useState } from "react";
import { Mail, RefreshCw, Save, Send } from "lucide-react";
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

export function SettingsMailPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authCollections, setAuthCollections] = useState<any[]>([]);
  const [testTo, setTestTo] = useState("");
  const [testCollection, setTestCollection] = useState("");
  const [baseline, setBaseline] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [value, collections] = await Promise.all([
        pb.settings.getAll(),
        pb.collections.getFullList({ filter: 'type = "auth"', sort: "name" }),
      ]);
      setSettings(value);
      setBaseline(JSON.stringify(value));
      setAuthCollections(collections);
      setTestCollection((current) => current || collections[0]?.name || "");
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

  function update(path: string, value: any) {
    setSettings((current: any) => set(current, path, value));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const updated = await pb.settings.update(filterRedacted(settings));
      setSettings(updated);
      setBaseline(JSON.stringify(updated));
      toast.success("Mail settings saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo || !testCollection) {
      toast.error("Choose an auth collection and a recipient.");
      return;
    }
    setBusy(true);
    try {
      await pb.settings.testEmail(testCollection, testTo, "verification");
      toast.success("Test email sent.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Mail settings"
        description="SMTP and sender identity"
        eyebrow="settings/mail"
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
              <CardHeader>
                <CardTitle>Sender</CardTitle>
                <CardDescription>Shown in outgoing mail.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Sender name</Label>
                  <Input
                    value={get(settings, "meta.senderName") || ""}
                    onChange={(event) => update("meta.senderName", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Sender address</Label>
                  <Input
                    type="email"
                    value={get(settings, "meta.senderAddress") || ""}
                    onChange={(event) => update("meta.senderAddress", event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>SMTP</CardTitle>
                  <CardDescription>Use your own SMTP server for outgoing mail.</CardDescription>
                </div>
                <Switch
                  checked={Boolean(get(settings, "smtp.enabled"))}
                  onCheckedChange={(value) => update("smtp.enabled", value)}
                />
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Host</Label>
                  <Input
                    value={get(settings, "smtp.host") || ""}
                    onChange={(event) => update("smtp.host", event.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={get(settings, "smtp.port") || 587}
                    onChange={(event) => update("smtp.port", Number(event.target.value))}
                  />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={get(settings, "smtp.username") || ""}
                    onChange={(event) => update("smtp.username", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={get(settings, "smtp.password") || ""}
                    onChange={(event) => update("smtp.password", event.target.value)}
                    placeholder="****** (unchanged)"
                  />
                </div>
                <div>
                  <Label>Auth method</Label>
                  <Select
                    value={get(settings, "smtp.authMethod") || ""}
                    onChange={(event) => update("smtp.authMethod", event.target.value)}
                  >
                    <option value="">Auto</option>
                    <option value="PLAIN">PLAIN</option>
                    <option value="LOGIN">LOGIN</option>
                  </Select>
                </div>
                <div>
                  <Label>TLS</Label>
                  <Select
                    value={String(get(settings, "smtp.tls") ?? "false")}
                    onChange={(event) => update("smtp.tls", event.target.value === "true")}
                  >
                    <option value="false">Off</option>
                    <option value="true">On (StartTLS)</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>EHLO / HELO domain</Label>
                  <Input
                    value={get(settings, "smtp.localName") || ""}
                    onChange={(event) => update("smtp.localName", event.target.value)}
                    placeholder="localhost"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test email</CardTitle>
                <CardDescription>Send a verification template to check the setup.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <Label>Auth collection</Label>
                  <Select value={testCollection} onChange={(event) => setTestCollection(event.target.value)}>
                    {authCollections.map((collection) => (
                      <option key={collection.id} value={collection.name}>
                        {collection.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Recipient</Label>
                  <Input
                    type="email"
                    value={testTo}
                    onChange={(event) => setTestTo(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={sendTest} disabled={busy}>
                    <Send />
                    Send test
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <Mail className="h-4 w-4" />
              With SMTP off, mail uses the host&apos;s sendmail (or the dev mail trap in dev mode).
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

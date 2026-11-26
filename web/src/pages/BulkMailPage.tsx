import { useEffect, useState } from "react";
import { Mail, Pause, Play, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
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
  Sheet,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

const CAMPAIGNS = "_bulkmail_campaigns";
const SUPPRESSIONS = "_bulkmail_suppressions";

type Campaign = {
  id: string;
  name: string;
  subject?: string;
  status?: string;
  html?: string;
  text?: string;
  audience?: any;
  vars?: any;
  queued?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  updated: string;
};

export function BulkMailPage() {
  const [tab, setTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [suppressionEmail, setSuppressionEmail] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [campaignList, suppressionList] = await Promise.all([
        pb.collection(CAMPAIGNS).getFullList({ sort: "-created" }),
        pb.collection(SUPPRESSIONS).getFullList({ sort: "-created" }),
      ]);
      setCampaigns(campaignList as unknown as Campaign[]);
      setSuppressions(suppressionList);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCampaign() {
    try {
      const campaign = await pb.collection(CAMPAIGNS).create({
        name: "Untitled campaign",
        status: "draft",
        audience: { collection: "users", filter: "", email_field: "email" },
        vars: {},
      });
      toast.success("Campaign created.");
      await load();
      setSelected(campaign as unknown as Campaign);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function startCampaign(campaign: Campaign) {
    try {
      await pb.send("/api/_c/bulkmail/v1/start", { method: "POST", body: { campaign: campaign.id } });
      toast.success("Campaign sending started.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function pauseCampaign(campaign: Campaign) {
    try {
      await pb.send("/api/_c/bulkmail/v1/pause", { method: "POST", body: { campaign: campaign.id } });
      toast.success("Campaign paused.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function addSuppression(event: React.FormEvent) {
    event.preventDefault();
    if (!suppressionEmail.trim()) return;
    try {
      await pb.collection(SUPPRESSIONS).create({
        email: suppressionEmail.trim(),
        reason: "manual",
      });
      setSuppressionEmail("");
      toast.success("Address suppressed.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function removeSuppression(id: string) {
    if (!window.confirm("Remove this suppression?")) return;
    try {
      await pb.collection(SUPPRESSIONS).delete(id);
      toast.success("Suppression removed.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Bulk mail"
        description="Campaigns and suppression list"
        eyebrow="mail/campaigns"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw />
              Refresh
            </Button>
            <Button size="sm" onClick={createCampaign}>
              <Plus />
              New campaign
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <Tabs
          tabs={[
            { value: "campaigns", label: "Campaigns" },
            { value: "suppressions", label: "Suppressions" },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "campaigns" ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : campaigns.length ? (
                    campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <button
                            className="text-left font-mono text-[11px] hover:text-accent"
                            onClick={() => setSelected(campaign)}
                          >
                            {campaign.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(campaign.status)}>
                            {campaign.status || "draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {campaign.sent || 0} sent · {campaign.queued || 0} queued ·{" "}
                          {campaign.failed || 0} failed
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                          {formatDate(campaign.updated)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {["draft", "done"].includes(campaign.status || "") ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startCampaign(campaign)}
                                aria-label="Start"
                              >
                                <Play />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => pauseCampaign(campaign)}
                                aria-label="Pause"
                              >
                                <Pause />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <EmptyState
                          title="No campaigns"
                          description="Create a campaign to mail your users."
                          action={
                            <Button onClick={createCampaign}>
                              <Plus />
                              New campaign
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suppress an address</CardTitle>
                <CardDescription>Suppressed addresses never receive campaign mail.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={addSuppression} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[260px] flex-1">
                    <Label htmlFor="suppression-email">Email</Label>
                    <Input
                      id="suppression-email"
                      type="email"
                      value={suppressionEmail}
                      onChange={(event) => setSuppressionEmail(event.target.value)}
                      placeholder="bounced@example.com"
                    />
                  </div>
                  <Button type="submit">
                    <Plus />
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppressions.length ? (
                      suppressions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-[11px]">{item.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.reason || "manual"}</Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">{item.source}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">
                            {formatDate(item.created)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeSuppression(item.id)}>
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <EmptyState title="No suppressions" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </PageBody>

      <CampaignDialog
        campaign={selected}
        onClose={() => setSelected(null)}
        onSaved={async () => {
          setSelected(null);
          await load();
        }}
      />
    </>
  );
}

function statusVariant(status?: string): "default" | "secondary" | "warning" | "success" | "danger" | "outline" | "accent" {
  switch (status) {
    case "sending":
      return "warning";
    case "done":
      return "success";
    case "failed":
      return "danger";
    case "scheduled":
      return "accent";
    default:
      return "outline";
  }
}

function CampaignDialog({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(null);
  const [audience, setAudience] = useState("");
  const [vars, setVars] = useState("{}");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name || "",
      subject: campaign.subject || "",
      html: campaign.html || "",
      text: campaign.text || "",
    });
    setAudience(JSON.stringify(campaign.audience || {}, null, 2));
    setVars(JSON.stringify(campaign.vars || {}, null, 2));
  }, [campaign]);

  if (!campaign || !form) return null;

  async function save() {
    setBusy(true);
    try {
      let audienceValue;
      let varsValue;
      try {
        audienceValue = JSON.parse(audience || "{}");
        varsValue = JSON.parse(vars || "{}");
      } catch {
        throw new Error("Audience and vars must be valid JSON.");
      }
      await pb.collection(CAMPAIGNS).update(campaign!.id, {
        ...form,
        audience: audienceValue,
        vars: varsValue,
      });
      toast.success("Campaign saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={Boolean(campaign)}
      onClose={onClose}
      title={campaign.name}
      description="Campaign editor"
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            <Send />
            {busy ? "Saving…" : "Save campaign"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>HTML body</Label>
          <Textarea
            rows={8}
            className="font-mono"
            value={form.html}
            onChange={(event) => setForm({ ...form, html: event.target.value })}
            placeholder="<p>Hello {{record.name}}</p>"
          />
        </div>
        <div>
          <Label>Text body (fallback)</Label>
          <Textarea
            rows={4}
            value={form.text}
            onChange={(event) => setForm({ ...form, text: event.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Audience JSON</Label>
            <Textarea
              rows={8}
              className="font-mono"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Example: {'{"collection":"users","filter":"verified = true","email_field":"email"}'}
            </p>
          </div>
          <div>
            <Label>Vars JSON</Label>
            <Textarea
              rows={8}
              className="font-mono"
              value={vars}
              onChange={(event) => setVars(event.target.value)}
            />
          </div>
        </div>
        <div className="border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Mail className="mb-2 h-4 w-4" />
          Sending uses the app&apos;s SMTP settings. Test and preview from the bulk-mail contract if needed.
        </div>
      </div>
    </Sheet>
  );
}

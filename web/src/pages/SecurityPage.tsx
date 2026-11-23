import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

type Collection = {
  id: string;
  name: string;
  type: string;
  system?: boolean;
  fields: { name: string; type: string; protected?: boolean }[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
};

type Advisory = {
  id: string;
  severity: "high" | "medium" | "low" | "ok";
  title: string;
  detail: string;
  href?: string;
  label?: string;
};

const RULES = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"] as const;

export function SecurityPage() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [collections, settings, backups, tokens] = await Promise.all([
          pb.collections.getFullList({ sort: "name" }),
          pb.settings.getAll(),
          pb.backups.getFullList().catch(() => []),
          pb.send("/api/_c/tokens/v1", {}).catch(() => ({ items: [] })),
        ]);

        const list: Advisory[] = [];

        for (const collection of collections as Collection[]) {
          if (collection.system || collection.name.startsWith("_")) continue;

          const publicRules = RULES.filter((rule) => collection[rule] === "");
          if (publicRules.length) {
            list.push({
              id: `public-${collection.id}`,
              severity: "high",
              title: `${collection.name} has public API rules`,
              detail: `Public: ${publicRules.map((rule) => rule.replace("Rule", "")).join(", ")}. Anyone can perform these operations.`,
              href: "/collections",
              label: "Open collection",
            });
          }

          const unprotected = (collection.fields || []).filter(
            (field) => field.type === "file" && !field.protected,
          );
          if (unprotected.length) {
            list.push({
              id: `files-${collection.id}`,
              severity: "medium",
              title: `${collection.name} has unprotected file fields`,
              detail: `Files are public: ${unprotected.map((field) => field.name).join(", ")}. Mark them Protected to require a file token or view rule.`,
              href: "/collections",
              label: "Open collection",
            });
          }
        }

        if (!settings.smtp?.enabled) {
          list.push({
            id: "smtp",
            severity: "low",
            title: "SMTP is not configured",
            detail: "Password resets and verification emails use sendmail or the dev mail trap.",
            href: "/settings/mail",
            label: "Mail settings",
          });
        }

        if (!backups.length) {
          list.push({
            id: "backups",
            severity: "medium",
            title: "No backups yet",
            detail: "Create a backup or enable automatic backups before you need one.",
            href: "/settings/backups",
            label: "Backups",
          });
        }

        if (settings.meta?.appName === "Acme" || !settings.meta?.appName) {
          list.push({
            id: "appname",
            severity: "low",
            title: "Application name still looks like a default",
            detail: "Set your app name and URL in Application settings.",
            href: "/settings",
            label: "Application settings",
          });
        }

        if (tokens.items?.length) {
          list.push({
            id: "tokens",
            severity: "low",
            title: `${tokens.items.length} API token(s) active`,
            detail: "Review scopes and expiry, and revoke anything you no longer use.",
            href: "/settings/tokens",
            label: "API tokens",
          });
        }

        if (!list.length) {
          list.push({
            id: "ok",
            severity: "ok",
            title: "No obvious issues found",
            detail: "API rules are locked, files are protected and backups exist.",
          });
        }

        setAdvisories(list);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const issues = advisories.filter((item) => item.severity !== "ok");

  return (
    <>
      <PageHeader
        title="Security"
        description="API rules, file protection, mail and backups"
        eyebrow="operations/security"
        actions={
          <Badge variant={issues.length ? "warning" : "success"}>
            {issues.length ? `${issues.length} advisories` : "All clear"}
          </Badge>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Advisories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : advisories.length ? (
              <div className="divide-y divide-border">
                {advisories.map((advisory) => (
                  <div key={advisory.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                    <div className="mt-0.5">
                      {advisory.severity === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{advisory.title}</span>
                        <Badge
                          variant={
                            advisory.severity === "high"
                              ? "danger"
                              : advisory.severity === "medium"
                                ? "warning"
                                : advisory.severity === "low"
                                  ? "outline"
                                  : "success"
                          }
                        >
                          {advisory.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{advisory.detail}</p>
                    </div>
                    {advisory.href ? (
                      <Link to={advisory.href as any}>
                        <Button variant="outline" size="sm">
                          {advisory.label}
                          <ExternalLink />
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing to report" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How this works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Superusers bypass API rules. For a superuser-only console, set rules to <code>null</code> and mark
              file fields as Protected.
            </p>
            <p>
              Empty-string rules (<code>""</code>) are public. An expression like{" "}
              <code>@request.auth.id != ""</code> requires a signed-in record.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

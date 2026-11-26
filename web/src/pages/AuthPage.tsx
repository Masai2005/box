import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, KeyRound, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

type AuthCollection = {
  id: string;
  name: string;
  type: string;
  passwordAuth?: { enabled?: boolean };
  otp?: { enabled?: boolean };
  mfa?: { enabled?: boolean };
  oauth2?: { enabled?: boolean; providers?: any[] };
  authRule?: string | null;
  manageRule?: string | null;
};

type Log = { id: string; message: string; created: string; level: number; data?: Record<string, any> };

export function AuthPage() {
  const [collections, setCollections] = useState<AuthCollection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [origins, setOrigins] = useState(0);
  const [external, setExternal] = useState(0);
  const [events, setEvents] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [list, logs, originResult, externalResult] = await Promise.all([
        pb.collections.getFullList({ filter: 'type = "auth"', sort: "name" }),
        pb.logs.getList(1, 200, { sort: "-created" }),
        pb.collection("_authOrigins").getList(1, 1).catch(() => null),
        pb.collection("_externalAuths").getList(1, 1).catch(() => null),
      ]);
      setCollections(list as AuthCollection[]);
      setOrigins(originResult?.totalItems || 0);
      setExternal(externalResult?.totalItems || 0);
      setEvents(
        (logs.items as unknown as Log[]).filter((log) =>
          String(log.data?.url || "").includes("/auth-"),
        ),
      );
      const entries = await Promise.all(
        (list as any[]).map(async (collection) => {
          const result = await pb.collection(collection.name).getList(1, 1).catch(() => null);
          return [collection.name, result?.totalItems || 0] as const;
        }),
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const providerCount = useMemo(
    () =>
      collections.reduce(
        (total, collection) =>
          total + (collection.oauth2?.enabled ? collection.oauth2.providers?.length || 0 : 0),
        0,
      ),
    [collections],
  );

  return (
    <>
      <PageHeader
        title="Auth"
        description="Auth collections, providers, origins and recent sign-in activity"
        eyebrow="operations/auth"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <PageBody className="space-y-5">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-4">
          <Stat label="Auth collections" value={String(collections.length)} icon={Users} />
          <Stat label="OAuth providers" value={String(providerCount)} icon={KeyRound} />
          <Stat label="Auth origins" value={String(origins)} icon={ShieldCheck} />
          <Stat label="External auths" value={String(external)} icon={Users} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Auth collections</CardTitle>
            <CardDescription>Open a collection to edit its auth rules and providers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : collections.length ? (
              <div className="divide-y divide-border">
                {collections.map((collection) => (
                  <div key={collection.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{collection.name}</span>
                        <Badge variant="outline">{counts[collection.name] || 0} records</Badge>
                        {collection.passwordAuth?.enabled !== false ? <Badge variant="accent">password</Badge> : null}
                        {collection.otp?.enabled ? <Badge variant="accent">OTP</Badge> : null}
                        {collection.mfa?.enabled ? <Badge variant="accent">MFA</Badge> : null}
                        {collection.oauth2?.enabled ? (
                          <Badge variant="accent">{collection.oauth2.providers?.length || 0} OAuth</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                        auth rule: {collection.authRule === null ? "superuser only" : collection.authRule || "public"}
                        {" · "}
                        manage rule: {collection.manageRule === null ? "superuser only" : collection.manageRule || "public"}
                      </p>
                    </div>
                    <Link to="/collections" search={{ collection: collection.name }}>
                      <Button variant="outline" size="sm">
                        Manage
                        <ExternalLink />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No auth collections" description="Create an auth collection to manage users." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent auth activity</CardTitle>
            <CardDescription>Auth requests from the fetched log window.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : events.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Path</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Actor</th>
                      <th className="px-4 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 30).map((event) => (
                      <tr key={event.id} className="border-t border-border">
                        <td className="max-w-[420px] truncate px-4 py-2 font-mono text-[10px]">
                          {event.data?.method} {event.data?.url || event.message}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={Number(event.data?.status) >= 400 ? "danger" : "success"}>
                            {event.data?.status || "-"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                          {event.data?.authId || "anonymous"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-[10px] text-muted-foreground">
                          {formatDate(event.created)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No recent auth activity" description="Sign-in requests will appear here." />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="bg-card/50 p-4">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

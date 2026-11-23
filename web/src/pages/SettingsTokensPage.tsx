import { useEffect, useState } from "react";
import { Copy, Key, Plus, RefreshCw, Trash2 } from "lucide-react";
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

type Token = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  owner: string;
  ownerEmail?: string;
  ownerCollection: string;
  expires?: string;
  lastUsed?: string;
  lastIp?: string;
};

export function SettingsTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [scopes, setScopes] = useState<{ name: string; description?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string>("");
  const [name, setName] = useState("");
  const [ttlDays, setTtlDays] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [list, scopeList] = await Promise.all([
        pb.send("/api/_c/tokens/v1", {}),
        pb.send("/api/_c/tokens/v1/scopes", {}),
      ]);
      setTokens(list.items || []);
      setScopes(scopeList.scopes || []);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setCreated("");
    try {
      const result = await pb.send("/api/_c/tokens/v1", {
        method: "POST",
        body: {
          name: name.trim(),
          scopes: selectedScopes,
          ttl: ttlDays ? Math.round(Number(ttlDays) * 86400) : 0,
          ownerCollection: "",
          owner: "",
        },
      });
      setCreated(result.token);
      setName("");
      setTtlDays("");
      setSelectedScopes([]);
      toast.success("API token created.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: Token) {
    if (!window.confirm(`Revoke "${token.name || token.prefix}"?`)) return;
    try {
      await pb.send(`/api/_c/tokens/v1/${token.id}`, { method: "DELETE" });
      toast.success("Token revoked.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="API tokens"
        description="Long-lived bearer tokens for CI, scripts and agents"
        eyebrow="settings/tokens"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {created ? (
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Copy the new token now. It won&apos;t be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all border border-border bg-background px-3 py-2 font-mono text-[11px]">
                {created}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(created);
                  toast.success("Copied.");
                }}
              >
                <Copy />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCreated("")}>
                ×
              </Button>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Create token</CardTitle>
            <CardDescription>Scoped tokens are safer for automation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="ci"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="token-ttl">Expires in (days)</Label>
                  <Input
                    id="token-ttl"
                    type="number"
                    min={0}
                    value={ttlDays}
                    onChange={(event) => setTtlDays(event.target.value)}
                    placeholder="never"
                  />
                </div>
              </div>

              <div>
                <Label>Scopes</Label>
                {scopes.length ? (
                  <div className="flex flex-wrap gap-2">
                    {scopes.map((scope) => (
                      <label
                        key={scope.name}
                        title={scope.description}
                        className={`flex cursor-pointer items-center gap-2 border px-2 py-1 font-mono text-[10px] ${
                          selectedScopes.includes(scope.name)
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedScopes.includes(scope.name)}
                          onChange={() =>
                            setSelectedScopes((current) =>
                              current.includes(scope.name)
                                ? current.filter((item) => item !== scope.name)
                                : [...current, scope.name],
                            )
                          }
                        />
                        {scope.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No scopes registered: the token gets the owner&apos;s full rights.
                  </p>
                )}
              </div>

              <Button type="submit" disabled={busy}>
                <Plus />
                {busy ? "Creating…" : "Create token"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Tokens</CardTitle>
              <CardDescription>{tokens.length} active tokens</CardDescription>
            </div>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tokens.length ? (
                  tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono text-[11px]">{token.name}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {token.prefix}…
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.length ? (
                            token.scopes.map((scope) => (
                              <Badge key={scope} variant="outline">
                                {scope}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">all</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {token.expires ? formatDate(token.expires) : "never"}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {token.lastUsed ? formatDate(token.lastUsed) : "never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => revoke(token)}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState title="No API tokens" description="Create one above for automation." />
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

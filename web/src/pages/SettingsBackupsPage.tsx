import { useEffect, useState } from "react";
import { Archive, Download, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
import { formatBytes, formatDate } from "@/lib/utils";

type Backup = { key: string; size: number; modified: string };

export function SettingsBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [restoreAt, setRestoreAt] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<any>(null);
  const [vacuum, setVacuum] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, restore, vac] = await Promise.all([
        pb.backups.getFullList(),
        pb.send("/api/_c/restore/v1", {}).catch(() => null),
        pb.send("/api/_c/vacuum/v1", {}).catch(() => null),
      ]);
      setBackups((list as Backup[]).sort((a, b) => (a.modified < b.modified ? 1 : -1)));
      setRestoreStatus(restore);
      setVacuum(vac);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBackup() {
    setBusy(true);
    try {
      await pb.backups.create(name.trim() || new Date().toISOString().replace(/\D/g, "").slice(0, 14));
      setName("");
      toast.success("Backup started.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBackup(key: string) {
    if (!window.confirm(`Delete backup ${key}?`)) return;
    try {
      await pb.backups.delete(key);
      toast.success("Backup deleted.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function downloadBackup(key: string) {
    try {
      const token = await pb.files.getToken();
      window.open(pb.backups.getDownloadURL(token, key), "_blank");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function restoreBackup(key: string) {
    if (!window.confirm(`Restore ${key}? The app restarts and later changes are replaced.`)) return;
    try {
      await pb.backups.restore(key);
      toast.success("Restore started. The app will restart.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function restoreToMoment() {
    if (!restoreAt) return;
    if (!window.confirm(`Restore the app to ${restoreAt}? The app restarts and later changes are replaced.`)) return;
    setBusy(true);
    try {
      await pb.send("/api/_c/restore/v1/restore", {
        method: "POST",
        body: { at: new Date(restoreAt).toISOString() },
      });
      toast.success("Restore started. The app will restart.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Backups"
        description="Create, download and restore your data"
        eyebrow="settings/backups"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <PageBody className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Create backup</CardTitle>
            <CardDescription>SQLite database plus local uploads, as a zip.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="backup-name">Name (optional)</Label>
              <Input
                id="backup-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="manual-2026-11-23"
              />
            </div>
            <Button onClick={createBackup} disabled={busy}>
              <Archive />
              {busy ? "Starting…" : "Create backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Backups</CardTitle>
              <CardDescription>{backups.length} backup files</CardDescription>
            </div>
            <Badge variant="accent">{backups.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : backups.length ? (
                  backups.map((backup) => (
                    <TableRow key={backup.key}>
                      <TableCell className="font-mono text-[10px]">{backup.key}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatBytes(backup.size)}</TableCell>
                      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {formatDate(backup.modified)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadBackup(backup.key)}>
                            <Download />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => restoreBackup(backup.key)}>
                            <RotateCcw />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteBackup(backup.key)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState title="No backups yet" description="Create your first backup above." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {restoreStatus ? (
          <Card>
            <CardHeader>
              <CardTitle>Restore to a moment</CardTitle>
              <CardDescription>
                {restoreStatus.kind === "continuous"
                  ? "Point-in-time restore is available."
                  : "Restores the latest backup at or before the chosen moment."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="restore-at">Moment</Label>
                <Input
                  id="restore-at"
                  type="datetime-local"
                  value={restoreAt}
                  onChange={(event) => setRestoreAt(event.target.value)}
                />
              </div>
              <Button variant="destructive" onClick={restoreToMoment} disabled={busy || !restoreAt}>
                <RotateCcw />
                Restore
              </Button>
              {restoreStatus.window ? (
                <p className="text-xs text-muted-foreground">
                  Window: {formatDate(restoreStatus.window.earliest)} → {formatDate(restoreStatus.window.latest)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {vacuum ? (
          <Card>
            <CardHeader>
              <CardTitle>Vacuum</CardTitle>
              <CardDescription>SQLite space reclamation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-xs sm:grid-cols-3">
              <Info label="Provider" value={vacuum.provider || "vacuum"} />
              <Info label="Schedule" value={vacuum.every || "off"} />
              <Info
                label="Last run"
                value={
                  vacuum.last?.at
                    ? `${formatDate(vacuum.last.at)} · ${formatBytes(vacuum.last.saved || 0)} saved`
                    : "Not run yet"
                }
              />
            </CardContent>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

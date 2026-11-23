import { useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

type Cron = { id: string; expression: string };

export function SettingsCronsPage() {
  const [crons, setCrons] = useState<Cron[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      setCrons(await pb.crons.getFullList());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(id: string) {
    setRunning(id);
    try {
      await pb.crons.run(id);
      toast.success(`Triggered ${id}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning("");
    }
  }

  return (
    <>
      <PageHeader
        title="Crons"
        description="Registered app cron jobs"
        eyebrow="settings/crons"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Expression</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : crons.length ? (
                  crons.map((cron) => (
                    <TableRow key={cron.id}>
                      <TableCell className="font-mono text-[11px]">{cron.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cron.expression}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={running === cron.id}
                          onClick={() => run(cron.id)}
                        >
                          <Play />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No cron jobs"
                        description="Register cron jobs in Go or JavaScript hooks to see them here."
                      />
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

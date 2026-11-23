import { useEffect, useRef, useState } from "react";
import { Radio, RefreshCw, Trash2 } from "lucide-react";
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
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { formatDate } from "@/lib/utils";

type RealtimeEvent = {
  id: string;
  topic: string;
  action: string;
  record: any;
  at: string;
};

export function RealtimePage() {
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [topic, setTopic] = useState("users");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const unsubscribe = useRef<null | (() => Promise<void>)>(null);

  useEffect(() => {
    pb.collections
      .getFullList({ sort: "name" })
      .then((list) => {
        setCollections(list.map((item: any) => ({ id: item.id, name: item.name })));
      })
      .catch(() => {});
    return () => {
      unsubscribe.current?.().catch(() => {});
    };
  }, []);

  async function connect() {
    await disconnect();
    try {
      const unsub = await pb.collection(topic).subscribe("*", (event) => {
        setEvents((current) => [
          {
            id: `${event.action}-${event.record?.id || Date.now()}-${Math.random()}`,
            topic,
            action: event.action,
            record: event.record,
            at: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 100));
      });
      unsubscribe.current = unsub;
      setConnected(true);
      toast.success(`Listening to ${topic}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function disconnect() {
    try {
      await unsubscribe.current?.();
    } catch {
      // noop
    }
    unsubscribe.current = null;
    setConnected(false);
  }

  return (
    <>
      <PageHeader
        title="Realtime"
        description="Subscribe to a collection and watch events live"
        eyebrow="developer/realtime"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={!connected}>
              Disconnect
            </Button>
            <Button size="sm" onClick={connect}>
              <Radio />
              {connected ? `Listening to ${topic}` : "Connect"}
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Superuser sessions bypass collection rules. Use the topic `collection/*`.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label>Collection / topic</Label>
              <Select value={topic} onChange={(event) => setTopic(event.target.value)}>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.name}>
                    {collection.name}/*
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Label>Custom topic</Label>
              <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="collection/*" />
            </div>
            <Badge variant={connected ? "success" : "outline"}>
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Events</CardTitle>
              <CardDescription>{events.length} received this session</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEvents([])}>
                <Trash2 />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {events.length ? (
              <div className="max-h-[60vh] divide-y divide-border overflow-y-auto scrollbar-thin">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3 px-5 py-3">
                    <Badge variant={actionVariant(event.action)}>{event.action}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{event.topic}</span>
                        <span className="font-mono text-[10px]">{event.record?.id}</span>
                        <span className="font-mono text-[9px] text-muted-foreground">{formatDate(event.at)}</span>
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto font-mono text-[10px] text-muted-foreground">
                        {JSON.stringify(event.record, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No events yet"
                description={connected ? "Create or update a record to see an event." : "Connect to a topic to start."}
              />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function actionVariant(action: string): "default" | "success" | "warning" | "danger" | "outline" {
  switch (action) {
    case "create":
      return "success";
    case "update":
      return "warning";
    case "delete":
      return "danger";
    default:
      return "outline";
  }
}

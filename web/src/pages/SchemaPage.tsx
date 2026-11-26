import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Database, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";

type Field = { name: string; type: string; collectionId?: string; system?: boolean };
type Collection = { id: string; name: string; type: string; system?: boolean; fields: Field[] };

export function SchemaPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collections
      .getFullList({ sort: "name" })
      .then((list) => setCollections(list as Collection[]))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(collections.map((collection) => [collection.id, collection])), [collections]);
  const userCollections = collections.filter((collection) => !collection.system && !collection.name.startsWith("_"));
  const systemCollections = collections.filter((collection) => collection.system || collection.name.startsWith("_"));

  return (
    <>
      <PageHeader
        title="Schema"
        description="Collections, fields and relation targets"
        eyebrow="database/schema"
      />
      <PageBody className="space-y-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-52 w-full" />
            ))}
          </div>
        ) : (
          <>
            <RelationGraph collections={userCollections} byId={byId} />
            <CollectionGroup title="Collections" collections={userCollections} byId={byId} />
            <CollectionGroup title="System" collections={systemCollections} byId={byId} />
            {!collections.length ? (
              <Card>
                <EmptyState title="No collections" description="Create a collection to see its schema." />
              </Card>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}

function RelationGraph({
  collections,
  byId,
}: {
  collections: Collection[];
  byId: Map<string, Collection>;
}) {
  const nodes = collections.slice(0, 24);
  if (!nodes.length) return null;

  const columns = 3;
  const nodeWidth = 220;
  const nodeHeight = 118;
  const gapX = 70;
  const gapY = 54;
  const positions = new Map(
    nodes.map((collection, index) => [
      collection.id,
      {
        x: (index % columns) * (nodeWidth + gapX),
        y: Math.floor(index / columns) * (nodeHeight + gapY),
      },
    ]),
  );
  const rows = Math.ceil(nodes.length / columns);
  const width = columns * nodeWidth + (columns - 1) * gapX;
  const height = rows * nodeHeight + (rows - 1) * gapY;

  const edges = nodes.flatMap((collection) =>
    collection.fields
      .filter((field) => field.type === "relation" && field.collectionId)
      .map((field) => ({
        from: collection,
        to: byId.get(field.collectionId!),
        field: field.name,
      }))
      .filter((edge) => edge.to && positions.has(edge.to.id)),
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Relation graph</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Arrows point from the collection that owns the relation field to its target.
          </p>
        </div>
        <Badge variant="outline">{edges.length} relations</Badge>
      </CardHeader>
      <CardContent className="overflow-auto scrollbar-thin">
        <div className="relative" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
            <defs>
              <marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-accent" />
              </marker>
            </defs>
            {edges.map((edge, index) => {
              const from = positions.get(edge.from.id)!;
              const to = positions.get(edge.to!.id)!;
              const x1 = from.x + nodeWidth;
              const y1 = from.y + nodeHeight / 2;
              const x2 = to.x;
              const y2 = to.y + nodeHeight / 2;
              const mid = (x1 + x2) / 2;
              const same = from.y === to.y;
              const d = same
                ? `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;
              return (
                <g key={`${edge.from.id}-${edge.to!.id}-${edge.field}-${index}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    className="text-accent/70"
                    markerEnd="url(#relation-arrow)"
                  />
                  <text x={mid} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
                    {edge.field}
                  </text>
                </g>
              );
            })}
          </svg>
          {nodes.map((collection) => {
            const position = positions.get(collection.id)!;
            const relations = collection.fields.filter((field) => field.type === "relation");
            return (
              <Link
                key={collection.id}
                to="/collections"
                search={{ collection: collection.name }}
                className="absolute block border-2 border-foreground bg-card p-3 transition-colors hover:border-accent"
                style={{ left: position.x, top: position.y, width: nodeWidth, height: nodeHeight }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
                    {collection.name}
                  </span>
                  <Badge variant={collection.type === "auth" ? "accent" : "outline"}>{collection.type}</Badge>
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {collection.fields.length} fields · {relations.length} relations
                </p>
                <p className="mt-2 line-clamp-3 text-[10px] text-muted-foreground">
                  {collection.fields.slice(0, 6).map((field) => field.name).join(", ")}
                </p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CollectionGroup({
  title,
  collections,
  byId,
}: {
  title: string;
  collections: Collection[];
  byId: Map<string, Collection>;
}) {
  if (!collections.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <Badge variant="outline">{collections.length}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          const relations = collection.fields.filter((field) => field.type === "relation");
          return (
            <Card key={collection.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <CardTitle className="truncate">{collection.name}</CardTitle>
                </div>
                <Badge variant={collection.type === "auth" ? "accent" : "outline"}>
                  {collection.type}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {collection.fields.slice(0, 12).map((field) => (
                    <span
                      key={field.name}
                      className="border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                    >
                      {field.name}
                      <span className="ml-1 opacity-50">{field.type}</span>
                    </span>
                  ))}
                  {collection.fields.length > 12 ? (
                    <span className="px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      +{collection.fields.length - 12}
                    </span>
                  ) : null}
                </div>

                {relations.length ? (
                  <div className="space-y-1 border-t border-border pt-2">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
                      Relations
                    </p>
                    {relations.map((field) => {
                      const target = field.collectionId ? byId.get(field.collectionId) : undefined;
                      return (
                        <div key={field.name} className="flex items-center gap-1 text-[10px]">
                          <GitBranch className="h-3 w-3 text-accent" />
                          <span className="font-mono">{field.name}</span>
                          <span className="text-muted-foreground">→</span>
                          {target ? (
                            <Link
                              to="/collections"
                              search={{ collection: target.name }}
                              className="font-mono text-accent hover:underline"
                            >
                              {target.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">missing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <Link
                  to="/collections"
                  search={{ collection: collection.name }}
                  className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:text-accent"
                >
                  Open records <ArrowUpRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

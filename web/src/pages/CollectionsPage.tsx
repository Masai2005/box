import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { RecordDialog } from "@/components/RecordDialog";
import { CollectionDialog } from "@/components/CollectionDialog";
import { ApiPreviewDialog } from "@/components/ApiPreviewDialog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { pb, errorMessage } from "@/lib/pb";
import { displayValue, formatDate } from "@/lib/utils";

type Field = {
  name: string;
  type: string;
  hidden?: boolean;
  system?: boolean;
};

type Collection = {
  id: string;
  name: string;
  type: string;
  system?: boolean;
  fields: Field[];
};

const PER_PAGE = 30;
const SYSTEM_COLUMNS = new Set(["id", "collectionId", "collectionName", "expand"]);

export function CollectionsPage() {
  const search = useSearch({ strict: false }) as { collection?: string; record?: string };
  const navigate = useNavigate();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [collectionsError, setCollectionsError] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState("");

  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("-created");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<{
    open: boolean;
    collection: Collection | null;
  }>({ open: false, collection: null });
  const [apiOpen, setApiOpen] = useState(false);

  const userCollections = useMemo(
    () => collections.filter((collection) => !collection.system && !collection.name.startsWith("_")),
    [collections],
  );
  const systemCollections = useMemo(
    () => collections.filter((collection) => collection.system || collection.name.startsWith("_")),
    [collections],
  );

  const selected = useMemo(
    () =>
      collections.find((collection) => collection.name === search.collection) ||
      userCollections[0] ||
      collections[0] ||
      null,
    [collections, userCollections, search.collection],
  );

  const visible = (collection: Collection) =>
    collection.name.toLowerCase().includes(sidebarFilter.toLowerCase());

  const dataFields = useMemo(
    () =>
      (selected?.fields || [])
        .filter((field) => !field.hidden && !SYSTEM_COLUMNS.has(field.name))
        .slice(0, 5),
    [selected],
  );

  const recordParam = search.record;

  useEffect(() => {
    if (!selected) return;
    if (!recordParam) {
      setSheetOpen(false);
      setEditingRecord(null);
      return;
    }
    if (recordParam === "new") {
      setEditingRecord(null);
      setSheetOpen(true);
      return;
    }
    const found = records.find((item) => item.id === recordParam);
    if (found) {
      setEditingRecord(found);
      setSheetOpen(true);
      return;
    }
    let cancelled = false;
    pb.collection(selected.name)
      .getOne(recordParam)
      .then((record) => {
        if (!cancelled) {
          setEditingRecord(record);
          setSheetOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSheetOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordParam, selected?.name, records]);

  function openRecord(record: Record<string, any> | null) {
    if (!selected) return;
    navigate({
      to: "/collections",
      search: { collection: selected.name, record: record?.id || "new" } as any,
    });
  }

  function closeRecord() {
    navigate({
      to: "/collections",
      search: { collection: selected?.name, record: undefined } as any,
    });
  }

  async function loadCollections() {
    setLoadingCollections(true);
    setCollectionsError("");
    try {
      const list = await pb.collections.getFullList({ sort: "name" });
      setCollections(list as Collection[]);
    } catch (err) {
      setCollectionsError(errorMessage(err));
    } finally {
      setLoadingCollections(false);
    }
  }

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selected?.name]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingRecords(true);
    setRecordsError("");
    pb.collection(selected.name)
      .getList(page, PER_PAGE, { sort, filter: filter.trim() || undefined })
      .then((result) => {
        if (cancelled) return;
        setRecords(result.items);
        setTotal(result.totalItems);
      })
      .catch((err) => {
        if (!cancelled) setRecordsError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingRecords(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.name, page, filter, sort, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: undefined | (() => void);
    pb.collection(selected.name)
      .subscribe("*", () => {
        clearTimeout(timer);
        timer = setTimeout(() => setRefreshKey((value) => value + 1), 250);
      })
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch(() => {});
    return () => {
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [selected?.name]);

  function selectCollection(collection: Collection) {
    navigate({ to: "/collections", search: { collection: collection.name, record: undefined } as any });
  }

  async function deleteRecord(record: Record<string, any>) {
    if (!selected) return;
    if (!window.confirm(`Delete this ${selected.name} record?`)) return;
    try {
      await pb.collection(selected.name).delete(record.id);
      toast.success("Record deleted.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function deleteCollection() {
    if (!selected || selected.system) return;
    if (!window.confirm(`Delete collection "${selected.name}" and all its records?`)) return;
    try {
      await pb.collections.delete(selected.id);
      toast.success("Collection deleted.");
      await loadCollections();
      navigate({ to: "/collections", search: { collection: undefined } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        title={selected?.name || "Collections"}
        description={selected ? `${selected.type} collection` : "Database collections"}
        eyebrow="database"
        actions={
          selected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setApiOpen(true)}>
                <Code2 />
                API preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollectionDialog({ open: true, collection: selected })}
              >
                <Settings2 />
                Settings
              </Button>
              <Button size="sm" onClick={() => openRecord(null)}>
                <Plus />
                New record
              </Button>
            </>
          ) : null
        }
      />

      <PageBody className="!px-0 !py-0 overflow-x-hidden">
        <div className="flex min-h-[calc(100vh-7rem)] flex-col lg:flex-row">
          <aside className="shrink-0 border-b-2 border-foreground bg-card lg:w-64 lg:border-b-0 lg:border-r-2">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search collections…"
                  value={sidebarFilter}
                  onChange={(event) => setSidebarFilter(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                Collections
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollectionDialog({ open: true, collection: null })}
                aria-label="New collection"
              >
                <Plus />
              </Button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto px-2 pb-3 scrollbar-thin lg:max-h-[calc(100vh-17rem)]">
              {loadingCollections ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  <CollectionGroup
                    label="Collections"
                    collections={userCollections.filter(visible)}
                    selected={selected}
                    onSelect={selectCollection}
                  />
                  <CollectionGroup
                    label="System"
                    collections={systemCollections.filter(visible)}
                    selected={selected}
                    onSelect={selectCollection}
                  />
                  {!userCollections.length && !systemCollections.length ? (
                    <p className="p-3 text-xs text-muted-foreground">No collections found.</p>
                  ) : null}
                </>
              )}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {collectionsError ? (
              <div className="m-5 border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {collectionsError}
              </div>
            ) : null}

            {!selected ? (
              <EmptyState
                title="No collection selected"
                description="Create a collection to start storing records."
                action={
                  <Button onClick={() => setCollectionDialog({ open: true, collection: null })}>
                    <Plus />
                    New collection
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder='Filter, e.g. name ~ "post"'
                      value={filter}
                      onChange={(event) => {
                        setFilter(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <Select
                    className="w-[170px]"
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="-created">Newest first</option>
                    <option value="created">Oldest first</option>
                    <option value="-updated">Recently updated</option>
                    <option value="updated">Least recently updated</option>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    aria-label="Refresh"
                  >
                    <RefreshCw />
                  </Button>
                  {!selected.system ? (
                    <Button variant="ghost" size="icon" onClick={deleteCollection} aria-label="Delete collection">
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>

                <Card className="min-w-0 overflow-hidden">
                  <CardContent className="p-0">
                    {recordsError ? (
                      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                        {recordsError}
                      </div>
                    ) : null}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          {dataFields.map((field) => (
                            <TableHead key={field.name}>{field.name}</TableHead>
                          ))}
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingRecords ? (
                          Array.from({ length: 6 }).map((_, index) => (
                            <TableRow key={index}>
                              <TableCell colSpan={dataFields.length + 3}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : records.length ? (
                          records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
                                {record.id}
                              </TableCell>
                              {dataFields.map((field) => (
                                <TableCell key={field.name} className="max-w-[220px] truncate">
                                  <FieldValue value={record[field.name]} type={field.type} />
                                </TableCell>
                              ))}
                              <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                                {formatDate(record.updated)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openRecord(record)}
                                    aria-label="Edit record"
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteRecord(record)}
                                    aria-label="Delete record"
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={dataFields.length + 3}>
                              <EmptyState
                                title="No records found"
                                description="Create a record or change the filter."
                                action={
                                  <Button
                                    onClick={() => openRecord(null)}
                                  >
                                    <Plus />
                                    New record
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

                <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>
                    Total: <span className="text-foreground">{total}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronLeft />
                      Prev
                    </Button>
                    <span className="px-2">
                      {page} / {pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pages}
                      onClick={() => setPage((value) => Math.min(pages, value + 1))}
                    >
                      Next
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageBody>

      <RecordDialog
        open={sheetOpen}
        onClose={closeRecord}
        collection={selected}
        record={editingRecord}
        collections={collections}
        onSaved={() => {
          setRefreshKey((value) => value + 1);
          closeRecord();
        }}
      />

      <CollectionDialog
        open={collectionDialog.open}
        onClose={() => setCollectionDialog({ open: false, collection: null })}
        collection={collectionDialog.collection}
        collections={collections}
        onSaved={async () => {
          await loadCollections();
          setRefreshKey((value) => value + 1);
        }}
      />

      <ApiPreviewDialog open={apiOpen} onClose={() => setApiOpen(false)} collection={selected} />
    </>
  );
}

function CollectionGroup({
  label,
  collections,
  selected,
  onSelect,
}: {
  label: string;
  collections: Collection[];
  selected: Collection | null;
  onSelect: (collection: Collection) => void;
}) {
  if (!collections.length) return null;
  return (
    <div className="mb-2">
      <div className="px-3 pb-1 pt-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </div>
      {collections.map((collection) => (
        <button
          key={collection.id}
          type="button"
          onClick={() => onSelect(collection)}
          className={`flex w-full items-center gap-2 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
            selected?.id === collection.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span className="truncate">{collection.name}</span>
          <span className="ml-auto text-[8px] opacity-60">{collection.type}</span>
        </button>
      ))}
    </div>
  );
}

function FieldValue({ value, type }: { value: any; type: string }) {
  if (type === "bool") {
    return <Badge variant={value ? "success" : "outline"}>{value ? "true" : "false"}</Badge>;
  }
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }
  if (type === "json") {
    return (
      <span className="font-mono text-[10px] text-muted-foreground">
        {JSON.stringify(value).slice(0, 60)}
      </span>
    );
  }
  return <span className="text-xs">{displayValue(value)}</span>;
}

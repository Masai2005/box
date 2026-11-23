import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Columns3,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  Save,
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
  Dialog,
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
import {
  clampPerPage,
  editableField,
  parseColumns,
  readViews,
  serializeColumns,
  writeViews,
  type Density,
  type SavedView,
} from "@/lib/collectionViews";
import { pb, errorMessage } from "@/lib/pb";
import { cn, displayValue, formatDate } from "@/lib/utils";

type Field = {
  name: string;
  type: string;
  hidden?: boolean;
  system?: boolean;
  values?: string[];
};

type Collection = {
  id: string;
  name: string;
  type: string;
  system?: boolean;
  fields: Field[];
};

type CollectionsSearch = {
  collection?: string;
  record?: string;
  filter?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  columns?: string;
  density?: Density;
  view?: string;
};

const PER_PAGE = 30;
const SYSTEM_COLUMNS = new Set(["id", "collectionId", "collectionName", "expand"]);

export function CollectionsPage() {
  const search = useSearch({ strict: false }) as CollectionsSearch;
  const navigate = useNavigate();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [collectionsError, setCollectionsError] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState("");

  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const filter = search.filter ?? "";
  const sort = search.sort ?? "-created";
  const page = Math.max(1, Number(search.page) || 1);
  const perPage = clampPerPage(search.perPage, PER_PAGE);
  const density: Density = search.density === "compact" ? "compact" : "comfortable";

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnDraft, setColumnDraft] = useState<string[]>([]);

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

  const availableColumns = useMemo(
    () =>
      (selected?.fields || [])
        .filter((field) => !field.hidden && !SYSTEM_COLUMNS.has(field.name))
        .map((field) => field.name),
    [selected],
  );

  const columnNames = useMemo(
    () => parseColumns(search.columns, availableColumns),
    [search.columns, availableColumns],
  );

  const dataFields = useMemo(
    () => (selected?.fields || []).filter((field) => columnNames.includes(field.name)),
    [selected, columnNames],
  );

  const activeView = useMemo(
    () => savedViews.find((view) => view.name === search.view),
    [savedViews, search.view],
  );

  const recordParam = search.record;

  function updateSearch(patch: Partial<CollectionsSearch>, replace = true) {
    navigate({ to: "/collections", search: { ...search, ...patch } as any, replace });
  }

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
    updateSearch({ record: record?.id || "new" }, false);
  }

  function closeRecord() {
    updateSearch({ record: undefined });
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
    if (!selected?.name) {
      setSavedViews([]);
      return;
    }
    setSavedViews(readViews(selected.name));
  }, [selected?.name]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingRecords(true);
    setRecordsError("");
    pb.collection(selected.name)
      .getList(page, perPage, { sort, filter: filter.trim() || undefined })
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
  }, [selected?.name, page, perPage, filter, sort, refreshKey]);

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
    navigate({ to: "/collections", search: { collection: collection.name } as any });
  }

  function applyView(name: string) {
    if (!name) {
      updateSearch({
        view: undefined,
        filter: "",
        sort: "-created",
        perPage: PER_PAGE,
        columns: undefined,
        density: "comfortable",
        page: 1,
      });
      return;
    }
    const view = savedViews.find((item) => item.name === name);
    if (!view) return;
    updateSearch({
      view: view.name,
      filter: view.filter,
      sort: view.sort,
      perPage: view.perPage,
      columns: serializeColumns(view.columns),
      density: view.density,
      page: 1,
    });
  }

  function saveView() {
    if (!selected) return;
    const name = window.prompt("Name this view", activeView?.name || "");
    if (!name?.trim()) return;
    const view: SavedView = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      name: name.trim(),
      filter,
      sort,
      perPage,
      columns: columnNames,
      density,
    };
    const next = [view, ...savedViews.filter((item) => item.name !== view.name)];
    writeViews(selected.name, next);
    setSavedViews(next);
    updateSearch({ view: view.name, columns: serializeColumns(view.columns) });
    toast.success(`Saved view "${view.name}".`);
  }

  function deleteView() {
    if (!selected || !activeView) return;
    if (!window.confirm(`Delete the saved view "${activeView.name}"?`)) return;
    const next = savedViews.filter((view) => view.id !== activeView.id);
    writeViews(selected.name, next);
    setSavedViews(next);
    updateSearch({ view: undefined });
    toast.success("Saved view deleted.");
  }

  function openColumns() {
    setColumnDraft(columnNames);
    setColumnsOpen(true);
  }

  function toggleColumn(name: string) {
    setColumnDraft((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function applyColumns() {
    updateSearch({ columns: serializeColumns(columnDraft), view: undefined });
    setColumnsOpen(false);
  }

  async function saveCell(record: Record<string, any>, field: Field, value: any) {
    if (!selected) return;
    const payload =
      field.type === "bool"
        ? Boolean(value)
        : field.type === "number"
          ? value === "" || value === null || value === undefined
            ? 0
            : Number(value)
          : field.type === "date"
            ? value
              ? new Date(value).toISOString()
              : ""
            : value;
    const updated = await pb.collection(selected.name).update(record.id, {
      [field.name]: payload,
    });
    setRecords((current) => current.map((item) => (item.id === record.id ? updated : item)));
    toast.success(`${field.name} updated.`);
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

  const pages = Math.max(1, Math.ceil(total / perPage));
  const compact = density === "compact";

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
                  aria-label="Search collections"
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
                      aria-label="Filter records"
                      value={filter}
                      onChange={(event) =>
                        updateSearch({ filter: event.target.value, page: 1, view: undefined })
                      }
                    />
                  </div>
                  <Select
                    className="w-[170px]"
                    aria-label="Sort records"
                    value={sort}
                    onChange={(event) =>
                      updateSearch({ sort: event.target.value, page: 1, view: undefined })
                    }
                  >
                    <option value="-created">Newest first</option>
                    <option value="created">Oldest first</option>
                    <option value="-updated">Recently updated</option>
                    <option value="updated">Least recently updated</option>
                  </Select>
                  <Select
                    className="w-[160px]"
                    aria-label="Saved views"
                    value={activeView?.name || ""}
                    onChange={(event) => applyView(event.target.value)}
                  >
                    <option value="">Custom view</option>
                    {savedViews.map((view) => (
                      <option key={view.id} value={view.name}>
                        {view.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" size="sm" onClick={saveView}>
                    <Save />
                    Save view
                  </Button>
                  {activeView ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteView}
                      aria-label="Delete saved view"
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={openColumns}>
                    <Columns3 />
                    Columns ({columnNames.length})
                  </Button>
                  <Select
                    className="w-[145px]"
                    aria-label="Row density"
                    value={density}
                    onChange={(event) =>
                      updateSearch({
                        density: event.target.value as Density,
                        view: undefined,
                      })
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </Select>
                  <Select
                    className="w-[125px]"
                    aria-label="Records per page"
                    value={String(perPage)}
                    onChange={(event) =>
                      updateSearch({ perPage: Number(event.target.value), page: 1, view: undefined })
                    }
                  >
                    {[10, 30, 50, 100].map((value) => (
                      <option key={value} value={value}>
                        {value} / page
                      </option>
                    ))}
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

                    <div className="hidden md:block">
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
                                <TableCell
                                  className={cn(
                                    "max-w-[120px] truncate font-mono text-[10px] text-muted-foreground",
                                    compact ? "py-1.5" : "",
                                  )}
                                >
                                  {record.id}
                                </TableCell>
                                {dataFields.map((field) => (
                                  <TableCell
                                    key={field.name}
                                    className={cn("max-w-[220px] truncate", compact ? "py-1.5" : "")}
                                  >
                                    {editableField(field.type) ? (
                                      <InlineCell
                                        value={record[field.name]}
                                        field={field}
                                        onSave={(value) => saveCell(record, field, value)}
                                      />
                                    ) : (
                                      <FieldValue value={record[field.name]} type={field.type} />
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell
                                  className={cn(
                                    "whitespace-nowrap text-[10px] text-muted-foreground",
                                    compact ? "py-1.5" : "",
                                  )}
                                >
                                  {formatDate(record.updated)}
                                </TableCell>
                                <TableCell className={cn("text-right", compact ? "py-1.5" : "")}>
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
                                    <Button onClick={() => openRecord(null)}>
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
                    </div>

                    <div className="divide-y divide-border md:hidden">
                      {loadingRecords ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="space-y-2 p-4">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        ))
                      ) : records.length ? (
                        records.map((record) => (
                          <article key={record.id} className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-bold">
                                  {mobileLabel(record, dataFields)}
                                </p>
                                <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                                  {record.id}
                                </p>
                              </div>
                              <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                                {formatDate(record.updated)}
                              </span>
                            </div>
                            {dataFields.length ? (
                              <dl className="grid grid-cols-2 gap-2">
                                {dataFields.slice(0, 4).map((field) => (
                                  <div key={field.name} className="min-w-0">
                                    <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
                                      {field.name}
                                    </dt>
                                    <dd className="mt-0.5 truncate text-xs">
                                      <FieldValue value={record[field.name]} type={field.type} />
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                            <div className="flex gap-2 border-t border-border pt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => openRecord(record)}
                              >
                                <Pencil />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteRecord(record)}
                                aria-label="Delete record"
                              >
                                <Trash2 />
                                Delete
                              </Button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <EmptyState
                          title="No records found"
                          description="Create a record or change the filter."
                          action={
                            <Button onClick={() => openRecord(null)}>
                              <Plus />
                              New record
                            </Button>
                          }
                        />
                      )}
                    </div>
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
                      onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
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
                      onClick={() => updateSearch({ page: Math.min(pages, page + 1) })}
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

      <Dialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Columns"
        description="Choose which fields appear in the records table."
        footer={
          <>
            <Button variant="outline" onClick={() => setColumnsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyColumns}>Apply columns</Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColumnDraft(availableColumns)}
          >
            Select all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setColumnDraft([])}>
            Clear all
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableColumns.map((name) => {
            const field = selected?.fields.find((item) => item.name === name);
            return (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 font-mono text-[10px]"
              >
                <input
                  type="checkbox"
                  checked={columnDraft.includes(name)}
                  onChange={() => toggleColumn(name)}
                  className="h-4 w-4 accent-[hsl(var(--accent))]"
                />
                <span className="truncate">{name}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{field?.type}</span>
              </label>
            );
          })}
          {!availableColumns.length ? (
            <p className="text-xs text-muted-foreground">This collection has no data columns.</p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

function mobileLabel(record: Record<string, any>, fields: Field[]) {
  for (const name of ["title", "name", "email", "slug", "label"]) {
    const field = fields.find((item) => item.name === name);
    if (field && record[name]) return String(record[name]);
  }
  const first = fields.find((field) => record[field.name]);
  return first ? displayValue(record[first.name]) : record.id;
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

function initialCellValue(field: Field, value: any): string {
  if (value === null || value === undefined) return "";
  if (field.type === "date") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace(" ", "T").slice(0, 16);
    return date.toISOString().slice(0, 16);
  }
  return String(value);
}

function InlineCell({
  value,
  field,
  onSave,
}: {
  value: any;
  field: Field;
  onSave: (value: any) => Promise<void>;
}) {
  const initial = initialCellValue(field, value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const skipBlur = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(initialCellValue(field, value));
  }, [editing, field, value]);

  function begin() {
    setDraft(initialCellValue(field, value));
    skipBlur.current = false;
    setEditing(true);
  }

  async function commit(next = draft) {
    if (saving) return;
    if (next === initial) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
      skipBlur.current = false;
    }
  }

  function cancel() {
    skipBlur.current = true;
    setDraft(initial);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onDoubleClick={begin}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            begin();
          }
        }}
        title={`Double-click to edit ${field.name}`}
        aria-label={`Edit ${field.name} inline`}
        className="w-full truncate text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <FieldValue value={value} type={field.type} />
      </button>
    );
  }

  if (field.type === "select" || field.type === "bool") {
    const options = field.type === "bool" ? ["true", "false"] : field.values || [];
    return (
      <Select
        autoFocus
        aria-label={`Edit ${field.name}`}
        value={field.type === "bool" ? String(Boolean(value)) : draft}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.target.value);
          void commit(event.target.value);
        }}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          void commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      >
        {field.type === "bool" ? (
          <>
            <option value="true">true</option>
            <option value="false">false</option>
          </>
        ) : (
          options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))
        )}
      </Select>
    );
  }

  return (
    <Input
      autoFocus
      aria-label={`Edit ${field.name}`}
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "datetime-local"
            : field.type === "email"
              ? "email"
              : field.type === "url"
                ? "url"
                : "text"
      }
      value={draft}
      disabled={saving}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (skipBlur.current) {
          skipBlur.current = false;
          return;
        }
        void commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}

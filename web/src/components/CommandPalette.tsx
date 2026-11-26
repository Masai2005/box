import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Activity,
  BarChart3,
  BookOpen,
  Braces,
  Database,
  FileDown,
  FileText,
  FileUp,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Search,
  ServerCog,
  ShieldCheck,
  Sun,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { pb } from "@/lib/pb";
import { cn } from "@/lib/utils";

type CollectionSummary = {
  id: string;
  name: string;
  type: string;
  system?: boolean;
  fields?: { name: string; type: string; hidden?: boolean; system?: boolean }[];
};

type RecordResult = {
  id: string;
  recordId: string;
  collection: string;
  label: string;
  detail: string;
};

type Action = {
  id: string;
  label: string;
  group: string;
  icon: typeof Search;
  detail?: string;
  run: () => void | Promise<void>;
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [records, setRecords] = useState<RecordResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    pb.collections
      .getFullList({ sort: "name" })
      .then((list) => setCollections(list as CollectionSummary[]))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    const id = ++searchId.current;
    if (!open || term.length < 2) {
      setRecords([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      const text = term.replaceAll('"', '\\"');
      const searchable = collections.filter(
        (collection) => !collection.system && !collection.name.startsWith("_"),
      );

      const settled = await Promise.allSettled(
        searchable.map(async (collection) => {
          const fields = (collection.fields || [])
            .filter(
              (field) =>
                !field.hidden &&
                ["text", "email", "url", "editor", "select"].includes(field.type),
            )
            .slice(0, 5);

          if (!fields.length) return [];

          const filter = fields.map((field) => `${field.name} ~ "${text}"`).join(" || ");
          const result = await pb.collection(collection.name).getList(1, 4, {
            filter,
            sort: "-updated",
          });

          const labelField = fields.find((field) =>
            ["title", "name", "email", "slug", "label"].includes(field.name),
          );

          return result.items.map((record: any) => ({
            id: `${collection.name}-${record.id}`,
            recordId: record.id,
            collection: collection.name,
            label: String(record[labelField?.name || fields[0].name] || record.id),
            detail: `${collection.name} · ${record.id.slice(0, 8)}`,
          }));
        }),
      );

      if (searchId.current !== id) return;

      const found = settled
        .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
        .slice(0, 20);

      setRecords(found);
      setSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query, collections]);

  const actions = useMemo<Action[]>(() => {
    const nav = (href: string) => () => {
      navigate({ to: href as any });
      onClose();
    };
    const items: Action[] = [
      { id: "overview", label: "Overview", group: "Navigate", icon: LayoutDashboard, run: nav("/") },
      { id: "collections", label: "Collections", group: "Navigate", icon: Database, run: nav("/collections") },
      { id: "logs", label: "Logs", group: "Navigate", icon: BarChart3, run: nav("/logs") },
      { id: "mail", label: "Bulk mail", group: "Navigate", icon: Mail, run: nav("/bulkmail") },
      { id: "schema", label: "Schema / ERD", group: "Navigate", icon: Workflow, run: nav("/schema") },
      { id: "api", label: "API explorer", group: "Navigate", icon: Braces, run: nav("/api-explorer") },
      { id: "api-docs", label: "API docs", group: "Navigate", icon: BookOpen, run: nav("/api-docs") },
      { id: "observability", label: "Observability", group: "Navigate", icon: Activity, run: nav("/observability") },
      { id: "status", label: "Status", group: "Navigate", icon: ShieldCheck, run: nav("/status") },
      { id: "audit", label: "Audit log", group: "Navigate", icon: FileText, run: nav("/audit") },
      { id: "auth", label: "Auth", group: "Navigate", icon: Users, run: nav("/auth") },
      { id: "realtime", label: "Realtime inspector", group: "Navigate", icon: Workflow, run: nav("/realtime") },
      { id: "security", label: "Security checks", group: "Navigate", icon: ShieldCheck, run: nav("/security") },
      { id: "runtime", label: "Runtime", group: "Navigate", icon: ServerCog, run: nav("/runtime") },
      { id: "settings", label: "Application settings", group: "Settings", icon: ServerCog, run: nav("/settings") },
      { id: "settings-mail", label: "Mail settings", group: "Settings", icon: Mail, run: nav("/settings/mail") },
      { id: "settings-storage", label: "Storage settings", group: "Settings", icon: ServerCog, run: nav("/settings/storage") },
      { id: "settings-backups", label: "Backups", group: "Settings", icon: Archive, run: nav("/settings/backups") },
      { id: "settings-tokens", label: "API tokens", group: "Settings", icon: Key, run: nav("/settings/tokens") },
      { id: "settings-sql", label: "SQL console", group: "Settings", icon: Terminal, run: nav("/settings/sql") },
      { id: "settings-export", label: "Export collections", group: "Settings", icon: FileDown, run: nav("/settings/export") },
      { id: "settings-import", label: "Import collections", group: "Settings", icon: FileUp, run: nav("/settings/import") },
      { id: "migrations", label: "Migrations", group: "Settings", icon: Workflow, run: nav("/migrations") },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          onClose();
        },
      },
      {
        id: "signout",
        label: "Sign out",
        group: "Actions",
        icon: LogOut,
        run: () => {
          logout();
          onClose();
        },
      },
      {
        id: "docs",
        label: "Open Ekilie docs",
        group: "Actions",
        icon: Braces,
        run: () => {
          window.open("https://ekilie.cloud/docs", "_blank", "noopener");
          onClose();
        },
      },
    ];

    for (const collection of collections) {
      items.push({
        id: `collection-${collection.id}`,
        label: collection.name,
        group: "Collections",
        icon: Database,
        run: () => {
          navigate({ to: "/collections", search: { collection: collection.name } as any });
          onClose();
        },
      });
    }

    for (const record of records) {
      items.push({
        id: `record-${record.id}`,
        label: record.label,
        group: "Records",
        icon: Database,
        detail: record.detail,
        run: () => {
          navigate({
            to: "/collections",
            search: { collection: record.collection, record: record.recordId } as any,
          });
          onClose();
        },
      });
    }

    return items;
  }, [collections, records, navigate, onClose, resolvedTheme, setTheme, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (action) =>
        action.label.toLowerCase().includes(q) || action.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    setActive(0);
  }, [query, records.length]);

  if (!open) return null;

  function run(action: Action | undefined) {
    if (!action) return;
    action.run();
  }

  const groups = filtered.reduce<Record<string, Action[]>>((acc, action) => {
    (acc[action.group] ||= []).push(action);
    return acc;
  }, {});

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl border-2 border-foreground bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b-2 border-foreground px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => Math.min(filtered.length - 1, current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(filtered[active]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            aria-label="Search pages, collections, actions and records"
            placeholder="Search pages, collections, actions and records…"
            className="h-8 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
          />
          <kbd className="border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div
          role="listbox"
          aria-label="Search results"
          className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground" aria-live="polite">
              {searching ? "Searching records…" : "No matches."}
            </p>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-3 pb-1 pt-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group}
                </div>
                {items.map((action) => {
                  index++;
                  const Icon = action.icon;
                  const selected = index === active;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => run(action)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.1em]",
                        selected
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{action.label}</span>
                      {action.detail ? (
                        <span className="ml-auto truncate pl-3 text-[9px] normal-case tracking-normal opacity-60">
                          {action.detail}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

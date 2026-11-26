import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  BookOpen,
  Braces,
  ChevronDown,
  Clock,
  Database,
  FileDown,
  FileText,
  FileUp,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeft,
  Activity,
  Radio,
  Search,
  ServerCog,
  ShieldCheck,
  Workflow,
  Settings,
  Terminal,
  Users,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const primary: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/collections", label: "Collections", icon: Database },
  { href: "/logs", label: "Logs", icon: BarChart3 },
  { href: "/bulkmail", label: "Bulk mail", icon: Mail },
];

const developer: NavItem[] = [
  { href: "/schema", label: "Schema", icon: Workflow },
  { href: "/api-explorer", label: "API explorer", icon: Braces },
  { href: "/api-docs", label: "API docs", icon: BookOpen },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/status", label: "Status", icon: ShieldCheck },
  { href: "/audit", label: "Audit log", icon: FileText },
  { href: "/auth", label: "Auth", icon: Users },
  { href: "/realtime", label: "Realtime", icon: Radio },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/runtime", label: "Runtime", icon: ServerCog },
];

const settings: NavItem[] = [
  { href: "/settings", label: "Application", icon: Settings, exact: true },
  { href: "/settings/mail", label: "Mail", icon: Mail },
  { href: "/settings/storage", label: "Storage", icon: ServerCog },
  { href: "/settings/backups", label: "Backups", icon: Archive },
  { href: "/settings/crons", label: "Crons", icon: Clock },
  { href: "/settings/tokens", label: "API tokens", icon: Key },
  { href: "/settings/sql", label: "SQL console", icon: Terminal },
  { href: "/settings/export", label: "Export", icon: FileDown },
  { href: "/settings/import", label: "Import", icon: FileUp },
  { href: "/migrations", label: "Migrations", icon: Workflow },
];

// shadcn's sidebar cookie name, so the state feels like cloud-web.
const COOKIE = "sidebar:state";
const MAX_AGE = 60 * 60 * 24 * 7;

function readSidebarOpen(): boolean {
  const match = document.cookie.match(/(?:^|; )sidebar:state=([^;]+)/);
  return match ? match[1] === "true" : true;
}

function writeSidebarOpen(open: boolean) {
  document.cookie = `${COOKIE}=${open}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  }

  function hide() {
    setPosition(null);
  }

  useEffect(() => {
    if (!position) return;
    const clear = () => setPosition(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, [position]);

  return (
    <>
      <div
        ref={ref}
        className="w-full"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {children}
      </div>
      {position
        ? createPortal(
            <div
              style={{ top: position.top, left: position.left }}
              className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap border border-border bg-popover px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item);
  return (
    <SidebarTooltip label={item.label} enabled={Boolean(collapsed)}>
      <Link
        to={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {collapsed ? null : <span className="truncate">{item.label}</span>}
      </Link>
    </SidebarTooltip>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/" className={cn("flex min-w-0 items-center", collapsed ? "justify-center" : "gap-2")}>
      <AppIcon size={20} className="text-accent" />
      {collapsed ? (
        <span className="sr-only">Ekilie Box</span>
      ) : (
        <>
          <span className="truncate font-mono text-xs font-bold uppercase tracking-[0.14em]">
            EKILIE<span className="text-accent">.BOX</span>
          </span>
          <span className="h-1.5 w-1.5 shrink-0 animate-blink bg-accent" />
        </>
      )}
    </Link>
  );
}

function SidebarRail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="Toggle Sidebar"
      title="Toggle Sidebar"
      tabIndex={-1}
      onClick={onToggle}
      className={cn(
        "absolute inset-y-0 right-0 z-20 hidden w-4 translate-x-1/2 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:transition-colors hover:after:bg-border sm:block",
        collapsed ? "cursor-e-resize" : "cursor-w-resize",
      )}
    />
  );
}

function Sidebar({
  pathname,
  onNavigate,
  email,
  logout,
  collapsed,
  onToggle,
}: {
  pathname: string;
  onNavigate?: () => void;
  email?: string;
  logout: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r-2 border-foreground bg-card transition-[width] duration-200 ease-linear",
        collapsed ? "w-12" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b-2 border-foreground bg-background/90 backdrop-blur-md",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Brand collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <div className={cn("space-y-0.5", collapsed ? "px-1" : "px-2")}>
          {primary.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </div>

        {collapsed ? (
          <div className="mx-1 mt-3 space-y-0.5 border-t border-border pt-3">
            {developer.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                collapsed
              />
            ))}
          </div>
        ) : (
          <details open className="mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground [&::-webkit-details-marker]:hidden">
              <Workflow className="h-3.5 w-3.5" />
              Developer
              <ChevronDown className="ml-auto h-3 w-3" />
            </summary>
            <div className="mt-1 space-y-0.5">
              {developer.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </details>
        )}

        {collapsed ? (
          <div className="mx-1 mt-3 space-y-0.5 border-t border-border pt-3">
            {settings.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                collapsed
              />
            ))}
          </div>
        ) : (
          <details open className="mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground [&::-webkit-details-marker]:hidden">
              <Settings className="h-3.5 w-3.5" />
              Settings
              <ChevronDown className="ml-auto h-3 w-3" />
            </summary>
            <div className="mt-1 space-y-0.5">
              {settings.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </details>
        )}

        <div className={cn("mt-4 border-t border-border pt-3", collapsed ? "mx-1" : "px-2")}>
          <SidebarTooltip label="Docs" enabled={Boolean(collapsed)}>
            <a
              href="https://ekilie.cloud/docs"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                collapsed ? "justify-center px-0" : "px-3",
              )}
            >
              <Braces className="h-3.5 w-3.5 shrink-0" />
              {collapsed ? null : <span>Docs</span>}
            </a>
          </SidebarTooltip>
        </div>
      </nav>

      <div className={cn("border-t-2 border-foreground bg-muted/20", collapsed ? "p-1.5" : "p-3")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center bg-foreground">
              <span className="font-mono text-[8px] font-bold text-background">
                {(email || "SU").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <SidebarTooltip label="Sign out" enabled>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </SidebarTooltip>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="flex h-7 w-7 items-center justify-center bg-foreground">
                <span className="font-mono text-[9px] font-bold text-background">
                  {(email || "SU").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] font-bold">Superuser</p>
                <p className="truncate font-mono text-[8px] text-muted-foreground">{email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={logout}
            >
              <LogOut />
              Sign out
            </Button>
          </>
        )}
      </div>

      {onToggle && collapsed !== undefined ? (
        <SidebarRail collapsed={collapsed} onToggle={onToggle} />
      ) : null}
    </aside>
  );
}

function Topbar({
  pathname,
  onMenu,
  onToggle,
  onSearch,
}: {
  pathname: string;
  onMenu: () => void;
  onToggle: () => void;
  onSearch: () => void;
}) {
  const crumbs = pathname.split("/").filter(Boolean);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b-2 border-foreground bg-background/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 lg:hidden"
          onClick={onMenu}
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-7 w-7 lg:flex"
          onClick={onToggle}
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
          <Link to="/" className="hover:text-foreground">
            Console
          </Link>
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="flex items-center gap-2">
              <span>/</span>
              <span className={index === crumbs.length - 1 ? "text-foreground" : ""}>
                {crumb.replace(/-/g, " ")}
              </span>
            </span>
          ))}
          {crumbs.length === 0 ? (
            <span className="flex items-center gap-2">
              <span>/</span>
              <span className="text-foreground">Overview</span>
            </span>
          ) : null}
        </div>
        <span className="h-1.5 w-1.5 animate-blink bg-accent" />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={onSearch}
        >
          <Search />
          Search
          <kbd className="ml-2 border border-border px-1.5 py-0.5 font-mono text-[8px]">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:hidden"
          onClick={onSearch}
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell() {
  const { superuser, logout } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [open, setOpen] = useState(readSidebarOpen);
  const email = String(superuser?.email || "");
  const collapsed = !open;

  function toggleSidebar() {
    setOpen((current) => {
      const next = !current;
      writeSidebarOpen(next);
      return next;
    });
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-[80] border-2 border-foreground bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <div className="hidden lg:flex">
        <Sidebar
          pathname={pathname}
          email={email}
          logout={logout}
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full">
            <Sidebar
              pathname={pathname}
              email={email}
              logout={logout}
              onNavigate={() => setMobileOpen(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          pathname={pathname}
          onMenu={() => setMobileOpen(true)}
          onToggle={toggleSidebar}
          onSearch={() => setPaletteOpen(true)}
        />
        <main id="main-content" className="dot-grid-bg flex-1">
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

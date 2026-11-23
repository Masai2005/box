import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  Braces,
  ChevronDown,
  Clock,
  Database,
  FileDown,
  FileUp,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ServerCog,
  Settings,
  Terminal,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
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
];

const STORAGE_KEY = "ekilie-box-sidebar";

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    <Link
      to={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
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

function Sidebar({
  pathname,
  onNavigate,
  email,
  logout,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  email?: string;
  logout: () => void;
  collapsed?: boolean;
}) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r-2 border-foreground bg-card transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b-2 border-foreground bg-background/90 backdrop-blur-md",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Brand collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <div className={cn("space-y-0.5", collapsed ? "px-2" : "px-2")}>
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
          <div className="mx-2 mt-3 space-y-0.5 border-t border-border pt-3">
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

        <div className={cn("mt-4 border-t border-border pt-3", collapsed ? "mx-2" : "px-2")}>
          <a
            href="https://ekilie.cloud/docs"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? "Docs" : undefined}
            className={cn(
              "flex items-center gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
              collapsed ? "justify-center px-0" : "px-3",
            )}
          >
            <Braces className="h-3.5 w-3.5 shrink-0" />
            {collapsed ? null : <span>Docs</span>}
          </a>
        </div>
      </nav>

      <div className="border-t-2 border-foreground bg-muted/20 p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center bg-foreground">
              <span className="font-mono text-[9px] font-bold text-background">
                {(email || "SU").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={logout}
              title="Sign out"
            >
              <LogOut />
            </Button>
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
    </aside>
  );
}

function Topbar({
  pathname,
  onMenu,
  collapsed,
  onToggle,
}: {
  pathname: string;
  onMenu: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const crumbs = pathname.split("/").filter(Boolean);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b-2 border-foreground bg-background/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
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
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell() {
  const { superuser, logout } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "collapsed",
  );
  const email = String(superuser?.email || "");

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="hidden lg:flex">
        <Sidebar
          pathname={pathname}
          email={email}
          logout={logout}
          collapsed={collapsed}
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
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
        <main className="dot-grid-bg flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

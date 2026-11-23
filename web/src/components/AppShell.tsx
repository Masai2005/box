import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  Boxes,
  Braces,
  ChevronDown,
  Clock,
  Database,
  FileDown,
  FileUp,
  Key,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
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

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item);
  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <AppIcon size={20} className="text-accent" />
      <span className="truncate font-mono text-xs font-bold uppercase tracking-[0.14em]">
        EKILIE<span className="text-accent">.BOX</span>
      </span>
      <span className="h-1.5 w-1.5 shrink-0 animate-blink bg-accent" />
    </Link>
  );
}

function Sidebar({
  pathname,
  onNavigate,
  email,
  logout,
}: {
  pathname: string;
  onNavigate?: () => void;
  email?: string;
  logout: () => void;
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r-2 border-foreground bg-card">
      <div className="flex h-14 items-center border-b-2 border-foreground bg-muted/30 px-4">
        <Brand />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <div className="space-y-0.5">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

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

        <div className="mt-4 space-y-0.5 border-t border-border pt-3">
          <a
            href="https://ekilie.cloud/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Braces className="h-3.5 w-3.5" />
            Docs
          </a>
        </div>
      </nav>

      <div className="border-t-2 border-foreground bg-muted/20 p-3">
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
      </div>
    </aside>
  );
}

function Topbar({
  pathname,
  onMenu,
}: {
  pathname: string;
  onMenu: () => void;
}) {
  const crumbs = pathname.split("/").filter(Boolean);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-foreground bg-background/90 px-4 backdrop-blur-md sm:px-6">
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
  const email = String(superuser?.email || "");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="hidden lg:flex">
        <Sidebar pathname={pathname} email={email} logout={logout} />
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
        <Topbar pathname={pathname} onMenu={() => setMobileOpen(true)} />
        <main className="dot-grid-bg flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

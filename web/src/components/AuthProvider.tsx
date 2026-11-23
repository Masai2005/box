import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { pb, isSuperuser } from "@/lib/pb";
import { filterRedacted } from "@/lib/utils";

type AuthState = {
  ready: boolean;
  superuser: Record<string, any> | null;
  login: (identity: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState>({
  ready: false,
  superuser: null,
  login: async () => {},
  logout: () => {},
});

// A fresh PocketBase install says "Acme" with a blue accent. Make the first superuser session look like Ekilie Box.
async function ensureDefaults() {
  try {
    const settings = await pb.settings.getAll();
    const meta = settings.meta || {};
    const appName = String(meta.appName || "");
    const accent = String(meta.accentColor || "").toLowerCase();
    const nameIsDefault = !appName || appName === "Acme";
    const accentIsDefault = !accent || accent === "#1055c9" || accent === "#d97a0b";
    if (!nameIsDefault && !accentIsDefault) return;

    await pb.settings.update({
      ...filterRedacted(settings),
      meta: {
        ...meta,
        appName: nameIsDefault ? "Ekilie Box" : meta.appName,
        accentColor: accentIsDefault ? "#da500b" : meta.accentColor,
      },
    });
  } catch {
    // Non-fatal: the operator can set these from Settings → Application.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [superuser, setSuperuser] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const sync = () => {
      const authed = isSuperuser();
      setSuperuser(authed ? (pb.authStore.record as Record<string, any>) : null);
      setReady(true);
      if (authed) void ensureDefaults();
    };
    sync();
    const unsubscribe = pb.authStore.onChange(sync);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const login = useCallback(async (identity: string, password: string) => {
    await pb.collection("_superusers").authWithPassword(identity, password);
    await ensureDefaults();
    setSuperuser(pb.authStore.record as Record<string, any>);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setSuperuser(null);
  }, []);

  const value = useMemo(
    () => ({ ready, superuser, login, logout }),
    [ready, superuser, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

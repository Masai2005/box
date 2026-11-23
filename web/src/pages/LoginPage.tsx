import { useState } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, Mail, MoveRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Input, Label } from "@/components/ui";
import { errorMessage } from "@/lib/pb";

export function LoginPage() {
  const { superuser, login } = useAuth();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (superuser) {
    return <Navigate to="/" />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await login(identity.trim(), password);
      await navigate({ to: "/" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dot-grid-bg flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md border border-border border-t-[3px] border-t-accent bg-card shadow-[8px_8px_0_rgba(217,74,11,0.10)]">
        <div className="px-8 py-9">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <img src="/icon.png" alt="Ekilie" className="h-14 w-14" />
            </div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
              EKILIE<span className="text-accent">.BOX</span>
            </div>
            <h1 className="mt-4 font-mono text-sm font-bold uppercase tracking-[0.1em]">
              Superuser login
            </h1>
            <p className="mt-2 text-xs text-muted-foreground">
              One account. One binary. Your entire backend.
            </p>
          </div>

          {error ? (
            <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-[10px] text-destructive">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="identity">Email or username</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="identity"
                  autoFocus
                  required
                  autoComplete="username"
                  className="pl-9"
                  value={identity}
                  onChange={(event) => setIdentity(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  required
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  className="px-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <MoveRight />
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Superuser access only
          </div>
        </div>
      </div>
    </div>
  );
}

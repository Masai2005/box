import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  children: ReactNode;
  /** Changing this key clears a previous error, so each route gets a fresh boundary. */
  resetKey?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route error:", error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl border-2 border-foreground bg-card p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.08em]">
                This page could not load
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                The rest of the console is still available. Try again, or go back to the overview.
              </p>
              <pre className="mt-4 max-h-40 overflow-auto border border-border bg-muted/30 p-3 font-mono text-[10px] text-destructive scrollbar-thin">
                {error.message || "Unknown error"}
              </pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => this.setState({ error: null })}>
                  <RefreshCw />
                  Try again
                </Button>
                <Link
                  to="/"
                  className="inline-flex h-8 items-center gap-2 border border-input bg-background px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

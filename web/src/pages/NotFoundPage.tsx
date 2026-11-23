import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        404 · not found
      </div>
      <h1 className="font-mono text-3xl font-bold uppercase tracking-tight">Nothing here</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you requested does not exist in this console.
      </p>
      <Link to="/">
        <Button>Back to overview</Button>
      </Link>
    </div>
  );
}

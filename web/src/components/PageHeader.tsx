import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  const code = eyebrow || title.toLowerCase().replace(/\s+/g, "_");
  return (
    <div className="border-b-2 border-foreground bg-muted/10 px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {"// "}
              {code}
            </span>
            <span className="h-1.5 w-1.5 animate-blink bg-accent" />
          </div>
          <h1 className="font-mono text-xl font-bold uppercase tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 ${className || ""}`}>{children}</div>
  );
}

export type Density = "comfortable" | "compact";

export type SavedView = {
  id: string;
  name: string;
  filter: string;
  sort: string;
  perPage: number;
  columns: string[];
  density: Density;
};

const PREFIX = "ekilie-box:views:";

export function clampPerPage(value: unknown, fallback = 30): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(200, Math.max(10, Math.round(number)));
}

export function parseColumns(value: string | undefined, available: string[]): string[] {
  if (value === undefined) return available.slice(0, 5);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => available.includes(item));
}

export function serializeColumns(columns: string[]): string {
  return columns.join(",");
}

export function editableField(type: string): boolean {
  return ["text", "email", "url", "number", "bool", "date", "select"].includes(type);
}

export function readViews(collection: string): SavedView[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`${PREFIX}${collection}`) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (view): view is SavedView =>
        Boolean(view) &&
        typeof view.id === "string" &&
        typeof view.name === "string" &&
        typeof view.filter === "string" &&
        typeof view.sort === "string" &&
        typeof view.perPage === "number" &&
        Array.isArray(view.columns) &&
        (view.density === "compact" || view.density === "comfortable"),
    );
  } catch {
    return [];
  }
}

export function writeViews(collection: string, views: SavedView[]) {
  localStorage.setItem(`${PREFIX}${collection}`, JSON.stringify(views.slice(0, 30)));
}

// Cells a spreadsheet would evaluate as a formula (OWASP CSV injection, CWE-1236).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
// A whole-cell signed number cannot run as a formula. The SQL API returns every value as a string, so without this
// exception every negative number would be exported as text.
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Quotes one value for CSV. Strings that start with a formula trigger are prefixed with ' so they open as text. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && FORMULA_TRIGGER.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Serialises rows to CSV with every cell quoted and neutralised. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

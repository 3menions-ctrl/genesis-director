/**
 * csvCell — neutralize CSV/spreadsheet formula injection (audit S235/S236).
 * A cell whose value begins with `= + - @` (or a leading tab/CR) is interpreted
 * as a formula by Excel/Sheets when the exported file is opened, so user-supplied
 * fields (email, display name, notes…) can execute. Prefix a single quote to
 * force the cell to be treated as text, then quote/escape for CSV.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  // Standard CSV quoting: wrap and double any embedded quotes.
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Build a CSV row from cells, each neutralized + quoted. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

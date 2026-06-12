/**
 * Opinionated DataTable for the admin / ops surface.
 *
 * - Column-config-driven: pass an array of ColumnDef and rows; component
 *   handles sorting (single-column for now), row-level selection,
 *   pagination, and an empty state.
 * - Loading state shows a layout-matched skeleton.
 * - Bulk-select header carries the indeterminate state correctly.
 * - All-keyboard navigable.
 *
 * Drop-in for src/refine/pages/ops/* tables. The existing hand-rolled
 * <table> blocks can each migrate to one DataTable call.
 */
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  /** Stable column id, used in keys + sort state. */
  id: string;
  /** Column header label. */
  header: string;
  /** Accessor for the cell value. */
  accessor: (row: T) => unknown;
  /** Optional render override. */
  render?: (row: T) => React.ReactNode;
  /** Set false to disable sorting on this column. */
  sortable?: boolean;
  /** Column-width hint, applied to the <th>. */
  width?: string;
  /** Align content. */
  align?: "left" | "right" | "center";
}

interface Props<T> {
  rows: T[] | undefined | null;
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Initial page size; defaults to 25. */
  pageSize?: number;
  /** Optional bulk-action handler — receives the selected row keys. */
  onBulkAction?: (selected: string[]) => React.ReactNode;
  /** Optional click handler for an entire row. */
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  pageSize = 25,
  onBulkAction,
  onRowClick,
}: Props<T>) {
  const [sort, setSort] = useState<{ colId: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows ?? [];
    const col = columns.find((c) => c.id === sort.colId);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av === bv) return 0;
      if (av == null) return sort.dir === "asc" ? -1 : 1;
      if (bv == null) return sort.dir === "asc" ? 1 : -1;
      // Numbers: compare numerically
      if (typeof av === "number" && typeof bv === "number") {
        return sort.dir === "asc" ? av - bv : bv - av;
      }
      const s = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? s : -s;
    });
  }, [rows, sort, columns]);

  const pageRows = useMemo(() => {
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const allSelectedOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const someSelectedOnPage = pageRows.some((r) => selected.has(rowKey(r))) && !allSelectedOnPage;

  const toggleAll = () => {
    setSelected((s) => {
      const next = new Set(s);
      if (allSelectedOnPage) {
        for (const r of pageRows) next.delete(rowKey(r));
      } else {
        for (const r of pageRows) next.add(rowKey(r));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil((sorted?.length ?? 0) / pageSize));

  return (
    <div className="rounded-2xl border border-glass bg-glass overflow-hidden">
      {onBulkAction && selected.size > 0 && (
        <div className="px-4 py-2 bg-primary/10 border-b border-glass-active flex items-center justify-between">
          <div className="text-xs text-foreground/75">{selected.size} selected</div>
          <div className="flex items-center gap-2">{onBulkAction(Array.from(selected))}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-glass-hover text-foreground/60 text-[10px] uppercase tracking-[0.16em]">
            <tr>
              {onBulkAction && (
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    ref={(el) => { if (el) el.indeterminate = someSelectedOnPage; }}
                    onChange={toggleAll}
                    aria-label="Select all on this page"
                    className="rounded border-foreground/30"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "px-3 py-3 select-none",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={
                    sort?.colId === col.id
                      ? sort.dir === "asc" ? "ascending" : "descending"
                      : "none"
                  }
                >
                  {col.sortable === false ? col.header : (
                    <button
                      type="button"
                      onClick={() => {
                        setSort((s) => {
                          if (s?.colId === col.id) {
                            return { colId: col.id, dir: s.dir === "asc" ? "desc" : "asc" };
                          }
                          return { colId: col.id, dir: "asc" };
                        });
                      }}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {sort?.colId === col.id
                        ? sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        : <ArrowUpDown className="w-3 h-3 opacity-50" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-foreground/85">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-glass-active/40">
                    {onBulkAction && <td className="px-3 py-3"><div className="h-4 w-4 bg-white/[0.05] rounded" /></td>}
                    {columns.map((c) => (
                      <td key={c.id} className="px-3 py-3">
                        <div className="h-3 bg-white/[0.05] rounded animate-pulse" style={{ width: `${30 + ((c.id.length * 7) % 50)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : pageRows.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length + (onBulkAction ? 1 : 0)} className="px-3 py-12 text-center">
                        <div className="text-foreground/80 font-medium">{emptyTitle}</div>
                        {emptyDescription && (
                          <div className="text-foreground/55 text-xs mt-1">{emptyDescription}</div>
                        )}
                      </td>
                    </tr>
                  )
                : pageRows.map((row) => {
                    const id = rowKey(row);
                    return (
                      <tr
                        key={id}
                        className={cn(
                          "border-t border-glass-active/40 hover:bg-glass-hover transition-colors",
                          onRowClick && "cursor-pointer",
                        )}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {onBulkAction && (
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              onChange={() => toggleRow(id)}
                              aria-label="Select row"
                              className="rounded border-foreground/30"
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td
                            key={col.id}
                            className={cn(
                              "px-3 py-3",
                              col.align === "right" && "text-right",
                              col.align === "center" && "text-center",
                            )}
                          >
                            {col.render ? col.render(row) : String(col.accessor(row) ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && (sorted?.length ?? 0) > pageSize && (
        <div className="px-4 py-2 border-t border-glass-active flex items-center justify-between text-xs">
          <div className="text-foreground/55">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-md hover:bg-glass-hover disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-foreground/70 tabular-nums px-2">
              {page + 1} / {totalPages}
            </div>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="p-1.5 rounded-md hover:bg-glass-hover disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

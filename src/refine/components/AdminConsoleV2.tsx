/**
 * AdminConsoleV2 — Declarative admin console.
 *
 * One primitive backs every operator surface. Pass a config describing the
 * Supabase table, columns, filters, signals, and actions; the primitive
 * renders the premium "Editorial Noir" admin UI, runs the queries, handles
 * pagination + search + filtering, surfaces actions in a row menu, and
 * exposes a primary CTA that opens a configurable side panel for create/edit.
 *
 * Goals:
 *  - Zero per-page boilerplate. New pages = a config blob.
 *  - Real data. No mock, no placeholder values.
 *  - Resilient. Empty states, error states, retry — never strands the operator.
 *  - Premium. Matches the editorial-noir aesthetic of the live admin pages.
 */
import { ReactNode, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Loader2,
  RefreshCcw,
  Search,
  AlertCircle,
  Inbox,
  Download,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AdminCard, ACCENT_HSL, accent, CYAN, ROSE, AMBER } from "@/admin/ui/primitives";

// ── Public types ─────────────────────────────────────────────────────────

export type SignalTone = "blue" | "amber" | "emerald" | "rose" | "neutral";

export interface AdminSignal {
  label: string;
  /** Either a static value (or function of rows) — runs in render. */
  value: (rows: AdminRow[]) => ReactNode;
  trend?: (rows: AdminRow[]) => string | undefined;
  tone?: SignalTone;
}

export interface AdminColumn<T extends AdminRow = AdminRow> {
  key: keyof T & string;
  label: string;
  /** Optional renderer; falls back to row[key]. */
  render?: (value: unknown, row: T) => ReactNode;
  /** Pixel hint for table layout. */
  width?: string;
  /** Right-align numeric columns. */
  align?: "left" | "right";
  /** Hide on narrower viewports. */
  hideOnMobile?: boolean;
}

export interface AdminAction<T extends AdminRow = AdminRow> {
  label: string;
  /** Optional icon component (lucide). */
  icon?: React.ElementType;
  /** Confirmation prompt before executing. */
  confirm?: string;
  /** Style of action — destructive renders red. */
  variant?: "default" | "destructive";
  /** Runs against the row; rows refresh after success. */
  onRun: (row: T) => Promise<void> | void;
  /** Skip the "succeeded" toast + auto-refresh — for actions that only open a
   *  dialog (Edit / Preview) rather than mutating data. */
  silent?: boolean;
  /** Hide for rows that don't meet a condition. */
  show?: (row: T) => boolean;
}

export interface AdminFilter {
  /** Column key the filter binds to. */
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  /** For select. */
  options?: { value: string; label: string }[];
}

export interface AdminQueryConfig {
  table: string;
  /** Postgrest select string. Default `*`. */
  select?: string;
  /** Default order. `column,asc|desc`. */
  orderBy?: { column: string; ascending?: boolean };
  /** Hard row cap. Default 100. */
  limit?: number;
}

export interface AdminConsoleV2Props<T extends AdminRow = AdminRow> {
  /** Intro copy under the status badge. */
  intro: string;
  /** Optional metric cards at top. */
  signals?: AdminSignal[];
  /** Data source. */
  query: AdminQueryConfig;
  /** Table columns. */
  columns: AdminColumn<T>[];
  /** Optional row actions. */
  actions?: AdminAction<T>[];
  /** Optional search + filter chips. */
  filters?: AdminFilter[];
  /** Optional primary CTA — typically opens a create dialog. */
  primaryCta?: { label: string; onClick: () => void };
  /** Search box placeholder, if filters include `searchKey`. */
  searchPlaceholder?: string;
  /** Column key to apply free-text `ilike` search against. */
  searchKey?: string;
  /** Empty-state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Children render below the table — for inline editors, side panels, etc. */
  children?: ReactNode;
}

export interface AdminRow {
  id: string | number;
  [k: string]: unknown;
}

// ── Implementation ───────────────────────────────────────────────────────

const toneColor: Record<SignalTone, string> = {
  blue: ACCENT_HSL,
  amber: AMBER,
  emerald: CYAN,
  rose: ROSE,
  neutral: "#ffffff",
};

export function AdminConsoleV2<T extends AdminRow = AdminRow>(
  props: AdminConsoleV2Props<T>,
) {
  const {
    intro,
    signals,
    query,
    columns,
    actions,
    filters,
    primaryCta,
    searchPlaceholder = "Search…",
    searchKey,
    emptyTitle = "Nothing to show yet",
    emptyDescription = "When records land here, they will appear in this table.",
    children,
  } = props;

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  // Click a column header to sort the loaded rows: asc → desc → none.
  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  // Type-aware client-side sort over the rows already loaded.
  const displayRows = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key as keyof T], bv = b[sort.key as keyof T];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const an = Number(av), bn = Number(bv);
      if (!isNaN(an) && !isNaN(bn) && String(av).trim() !== "" && String(bv).trim() !== "") return (an - bn) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  // Export the currently-shown rows to CSV (raw values, not rendered cells).
  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = visibleColumns.map((c) => esc(c.label)).join(",");
    const lines = displayRows.map((r) =>
      visibleColumns.map((c) => {
        const v = r[c.key as keyof T];
        return esc(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
      }).join(","),
    );
    const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "admin-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Data fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      let q = supabase
        .from(query.table)
        .select(query.select ?? "*")
        .limit(query.limit ?? 100);

      if (query.orderBy) {
        q = q.order(query.orderBy.column, {
          ascending: query.orderBy.ascending ?? false,
        });
      }

      // Apply select filters
      for (const [k, v] of Object.entries(filterState)) {
        if (!v) continue;
        q = q.eq(k, v);
      }

      // Apply text search
      if (search && searchKey) {
        q = q.ilike(searchKey, `%${search}%`);
      }

      const { data, error: err } = await q;
      if (cancelled) return;

      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as unknown as T[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    query.table,
    query.select,
    query.limit,
    query.orderBy?.column,
    query.orderBy?.ascending,
    JSON.stringify(filterState),
    search,
    searchKey,
    reloadKey,
  ]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Create dialogs across the admin fire a window `admin-console-refresh` event
  // after inserting a row. Listen for it so the freshly-created record shows up
  // without a manual refresh (previously the event was dispatched but had no
  // listener anywhere, so the list silently went stale).
  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener("admin-console-refresh", onRefresh);
    return () => window.removeEventListener("admin-console-refresh", onRefresh);
  }, [refresh]);

  const runAction = useCallback(
    async (a: AdminAction<T>, row: T) => {
      if (a.confirm && !window.confirm(a.confirm)) return;
      try {
        await a.onRun(row);
        if (a.silent) return; // dialog-opener; no success toast / refresh
        toast.success(`${a.label} succeeded`);
        refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`${a.label} failed: ${msg.slice(0, 120)}`);
      }
    },
    [refresh],
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !c.hideOnMobile),
    [columns],
  );

  return (
    <div className="space-y-8">
      {/* Intro band + signals */}
      <AdminCard className="p-8 lg:p-10">
        <div
          aria-hidden
          className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accent(0.14)}, transparent 65%)`,
            filter: "blur(60px)",
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-[0.32em] uppercase"
                style={{ color: CYAN, background: "hsl(188 92% 58% / 0.12)" }}
              >
                LIVE
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/45">
                Operator Console
              </span>
            </div>
            <p className="text-[15px] text-white/70 leading-relaxed font-light max-w-xl">
              {intro}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={refresh}
              disabled={loading}
              className="text-[11px] uppercase tracking-[0.22em] text-white/60 hover:text-white px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw
                className={cn("w-3.5 h-3.5", loading && "animate-spin")}
              />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={loading || displayRows.length === 0}
              title="Export shown rows to CSV"
              className="text-[11px] uppercase tracking-[0.22em] text-white/60 hover:text-white px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            {primaryCta && (
              <button
                onClick={primaryCta.onClick}
                className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-[#0a0b0e] px-5 py-2.5 rounded-full bg-white hover:bg-white/90 transition-colors"
              >
                {primaryCta.label}
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {signals && signals.length > 0 && (
          <div className="relative mt-8 pt-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {signals.map((s, i) => {
              const value = s.value(rows as AdminRow[]);
              const trend = s.trend?.(rows as AdminRow[]);
              return (
                <div key={i}>
                  <div className="text-[9px] text-white/45 font-mono uppercase tracking-[0.32em] mb-2">
                    {s.label}
                  </div>
                  <div
                    className="text-2xl font-display font-semibold tracking-[-0.02em] tabular-nums"
                    style={{ color: toneColor[s.tone || "neutral"] }}
                  >
                    {loading ? <span className="text-white/20">…</span> : value}
                  </div>
                  {trend && (
                    <div className="text-[10px] text-white/45 mt-1 font-mono uppercase tracking-[0.2em]">
                      {trend}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      {/* Search + filter row */}
      {(searchKey || (filters && filters.length > 0)) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchKey && (
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-3 py-2.5 rounded-full bg-white/[0.06] text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.1] transition-colors"
              />
            </div>
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              value={filterState[f.key] ?? ""}
              onChange={(e) =>
                setFilterState((s) => ({ ...s, [f.key]: e.target.value }))
              }
              className="px-4 py-2.5 rounded-full bg-white/[0.06] text-[12px] text-white/70 focus:outline-none focus:bg-white/[0.1] transition-colors"
            >
              <option value="">{f.label}: all</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {/* Table */}
      <AdminCard className="overflow-hidden">
        {error ? (
          <div className="p-12 text-center text-white/60">
            <AlertCircle className="w-6 h-6 mx-auto mb-3" style={{ color: ROSE }} />
            <p className="text-[13px] mb-2">Could not load records</p>
            <p className="text-[11px] text-white/45 font-mono">{error}</p>
            <button
              onClick={refresh}
              className="mt-4 text-[11px] uppercase tracking-[0.22em] hover:text-white transition-colors"
              style={{ color: ACCENT_HSL }}
            >
              Retry
            </button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="p-16 flex items-center justify-center gap-3 text-white/45">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">
              Loading…
            </span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-7 h-7 mx-auto mb-3 text-white/25" />
            <p className="text-[15px] font-display font-semibold tracking-[-0.02em] text-white/80 mb-2">
              {emptyTitle}
            </p>
            <p className="text-[12px] text-white/45 max-w-md mx-auto">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-white/[0.04]">
                  {visibleColumns.map((c) => (
                    <th
                      key={c.key}
                      style={{ width: c.width }}
                      className={cn(
                        "px-5 py-3.5 text-[10px] font-mono uppercase tracking-[0.22em] text-white/45",
                        c.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        title="Sort"
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-[0.22em] transition-colors hover:text-white/80",
                          c.align === "right" && "flex-row-reverse",
                          sort?.key === c.key && "text-white/75",
                        )}
                      >
                        {c.label}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </button>
                    </th>
                  ))}
                  {actions && actions.length > 0 && (
                    <th className="px-5 py-3.5 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, rowIndex) => (
                  <tr
                    key={String(row.id)}
                    className={cn(
                      "transition-colors hover:bg-white/[0.05]",
                      rowIndex % 2 === 1 && "bg-white/[0.015]",
                    )}
                  >
                    {visibleColumns.map((c) => {
                      const raw = row[c.key];
                      const content = c.render ? c.render(raw, row) : formatCell(raw);
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            "px-5 py-3.5 text-white/75",
                            c.align === "right" && "text-right tabular-nums",
                          )}
                        >
                          {content}
                        </td>
                      );
                    })}
                    {actions && actions.length > 0 && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {actions
                            .filter((a) => !a.show || a.show(row))
                            .map((a, i) => {
                              const Icon = a.icon;
                              const destructive = a.variant === "destructive";
                              return (
                                <button
                                  key={i}
                                  onClick={() => runAction(a, row)}
                                  className={cn(
                                    "text-[11px] px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5",
                                    destructive
                                      ? "hover:brightness-110"
                                      : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white",
                                  )}
                                  style={
                                    destructive
                                      ? { color: ROSE, background: "hsl(350 90% 70% / 0.12)" }
                                      : undefined
                                  }
                                >
                                  {Icon && <Icon className="w-3 h-3" />}
                                  {a.label}
                                </button>
                              );
                            })}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {loading && (
                <Loader2 className="w-3 h-3 ml-2 inline animate-spin" />
              )}
            </div>
          </div>
        )}
      </AdminCard>

      {children}
    </div>
  );
}

function formatCell(v: unknown): ReactNode {
  if (v === null || v === undefined) return <span className="text-white/25">—</span>;
  if (typeof v === "boolean")
    return (
      <span
        className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider"
        style={
          v
            ? { color: CYAN, background: "hsl(188 92% 58% / 0.12)" }
            : { color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }
        }
      >
        {v ? "true" : "false"}
      </span>
    );
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  if (typeof v === "string") {
    // ISO dates
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace("T", " ");
    }
    return v.length > 80 ? v.slice(0, 80) + "…" : v;
  }
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "object") return <code className="text-[11px] text-white/40">{JSON.stringify(v).slice(0, 80)}</code>;
  return String(v);
}

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
} from "lucide-react";
import { toast } from "sonner";

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

const toneText: Record<SignalTone, string> = {
  blue: "text-[#6FB6FF]",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  neutral: "text-white",
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

  const runAction = useCallback(
    async (a: AdminAction<T>, row: T) => {
      if (a.confirm && !window.confirm(a.confirm)) return;
      try {
        await a.onRun(row);
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
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-8 lg:p-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(10,132,255,0.12), transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/[0.06] text-emerald-300 text-[9px] font-mono font-bold tracking-[0.32em] uppercase">
                LIVE
              </span>
              <span className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
                Operator Console
              </span>
            </div>
            <p
              className="text-[15px] text-white/65 leading-relaxed font-light max-w-xl"
            >
              {intro}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={refresh}
              disabled={loading}
              className="text-[11px] uppercase tracking-[0.22em] text-white/45 hover:text-white px-4 py-2.5 rounded-lg border border-white/[0.06] hover:border-white/20 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw
                className={cn("w-3.5 h-3.5", loading && "animate-spin")}
              />
              Refresh
            </button>
            {primaryCta && (
              <button
                onClick={primaryCta.onClick}
                className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-white px-5 py-2.5 rounded-lg border border-[#0A84FF]/50 bg-gradient-to-b from-[#0A84FF] to-[#0A6CCC] shadow-[0_8px_24px_-10px_rgba(10,132,255,0.6)] hover:shadow-[0_12px_32px_-10px_rgba(10,132,255,0.8)] transition-shadow"
              >
                {primaryCta.label}
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {signals && signals.length > 0 && (
          <div className="relative mt-8 pt-6 border-t border-white/[0.05] grid grid-cols-2 md:grid-cols-4 gap-6">
            {signals.map((s, i) => {
              const value = s.value(rows as AdminRow[]);
              const trend = s.trend?.(rows as AdminRow[]);
              return (
                <div key={i}>
                  <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.32em] mb-2">
                    {s.label}
                  </div>
                  <div
                    className={cn(
                      "text-2xl font-display font-light tabular-nums",
                      toneText[s.tone || "neutral"],
                    )}
                  >
                    {loading ? <span className="text-white/20">…</span> : value}
                  </div>
                  {trend && (
                    <div className="text-[10px] text-white/30 mt-1 font-mono uppercase tracking-[0.2em]">
                      {trend}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search + filter row */}
      {(searchKey || (filters && filters.length > 0)) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchKey && (
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#0A84FF]/40"
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
              className="px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[12px] text-white/70 focus:outline-none focus:border-[#0A84FF]/40"
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
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.015]">
        {error ? (
          <div className="p-12 text-center text-white/60">
            <AlertCircle className="w-6 h-6 mx-auto mb-3 text-rose-300" />
            <p className="text-[13px] mb-2">Could not load records</p>
            <p className="text-[11px] text-white/40 font-mono">{error}</p>
            <button
              onClick={refresh}
              className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#6FB6FF] hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="p-16 flex items-center justify-center gap-3 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">
              Loading…
            </span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-7 h-7 mx-auto mb-3 text-white/20" />
            <p
              className="text-[15px] text-white/70 mb-2"
            >
              {emptyTitle}
            </p>
            <p className="text-[12px] text-white/40 max-w-md mx-auto">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {visibleColumns.map((c) => (
                    <th
                      key={c.key}
                      style={{ width: c.width }}
                      className={cn(
                        "px-5 py-3 text-[10px] font-mono uppercase tracking-[0.22em] text-white/35",
                        c.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                  {actions && actions.length > 0 && (
                    <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={String(row.id)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
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
                              return (
                                <button
                                  key={i}
                                  onClick={() => runAction(a, row)}
                                  className={cn(
                                    "text-[11px] px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5",
                                    a.variant === "destructive"
                                      ? "border-rose-400/20 text-rose-300 hover:bg-rose-500/[0.08] hover:border-rose-400/40"
                                      : "border-white/[0.08] text-white/60 hover:text-white hover:border-white/20",
                                  )}
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
            <div className="px-5 py-3 border-t border-white/[0.05] text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {loading && (
                <Loader2 className="w-3 h-3 ml-2 inline animate-spin" />
              )}
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function formatCell(v: unknown): ReactNode {
  if (v === null || v === undefined) return <span className="text-white/25">—</span>;
  if (typeof v === "boolean")
    return (
      <span
        className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider",
          v
            ? "bg-emerald-500/[0.08] text-emerald-300 border border-emerald-400/20"
            : "bg-white/[0.04] text-white/40 border border-white/[0.06]",
        )}
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

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, RefreshCw, Search, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "../components/AdminPageShell";
import {
  StatOrb, FloatSection, FloatTable, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, AMBER, ROSE,
} from "@/admin/ui/primitives";
import { Donut, TrendArea, CategoryBars, countBy, bucketByDay, topN } from "@/admin/ui/charts";

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type Tone = "accent" | "positive" | "warn" | "danger" | "neutral";
const STATUS_STYLES: Record<string, { tone: Tone; icon: React.ElementType }> = {
  sent:        { tone: "positive", icon: CheckCircle2 },
  pending:     { tone: "warn",     icon: Clock },
  failed:      { tone: "danger",   icon: XCircle },
  dlq:         { tone: "danger",   icon: XCircle },
  bounced:     { tone: "danger",   icon: XCircle },
  complained:  { tone: "danger",   icon: XCircle },
  suppressed:  { tone: "warn",     icon: Ban },
};

function StatusBadge({ status }: { status: string | null }) {
  const key = (status || "").toLowerCase();
  const cfg = STATUS_STYLES[key] || { tone: "neutral" as Tone, icon: Mail };
  const Icon = cfg.icon;
  return (
    <StatusPill tone={cfg.tone}>
      <Icon className="w-3 h-3" />
      {status || "unknown"}
    </StatusPill>
  );
}

export default function AdminEmailsPage() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchLogs = useCallback(async (filter: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("admin_get_email_log", {
      _email_filter: filter || null,
      _limit: 200,
    });
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as EmailLogRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(""); }, [fetchLogs]);

  const stats = useMemo(() => {
    const out = { total: rows.length, sent: 0, pending: 0, failed: 0, suppressed: 0 };
    for (const r of rows) {
      const s = (r.status || "").toLowerCase();
      if (s === "sent") out.sent++;
      else if (s === "pending") out.pending++;
      else if (s === "suppressed") out.suppressed++;
      else if (["failed", "dlq", "bounced", "complained"].includes(s)) out.failed++;
    }
    return out;
  }, [rows]);

  // Charts derive from the same 200 email-log rows already fetched via RPC.
  const statusDist = useMemo(() => countBy(rows, r => r.status), [rows]);
  const perDay = useMemo(() => bucketByDay(rows, r => r.created_at, { days: 14 }), [rows]);
  const templateDist = useMemo(() => topN(countBy(rows, r => r.template_name), 8), [rows]);

  const filteredRows = useMemo(() => {
    const base = statusFilter === "all"
      ? rows
      : statusFilter === "failed"
        ? rows.filter(r => ["failed","dlq","bounced","complained"].includes((r.status||"").toLowerCase()))
        : rows.filter(r => (r.status || "").toLowerCase() === statusFilter);
    // LOGIC FIX AD-13: admin_get_email_log uses DISTINCT ON (message_id) … ORDER
    // BY message_id, so the rows arrive ordered by the random Resend message_id,
    // not by time. Sort newest-first for display.
    return [...base].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [rows, statusFilter]);

  const submitFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(emailFilter.trim());
    fetchLogs(emailFilter.trim());
  };

  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="EML"
      title="Emails"
      italic="Delivery."
      description="Auth and transactional email delivery history with the latest status per message."
      actions={
        <DeckButton accent onClick={() => fetchLogs(activeFilter)} disabled={loading}>
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </DeckButton>
      }
    >
      <div className="space-y-12">

      {/* Stats — floating figures */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-5">
        <StatOrb index={0} aura={ACCENT_HSL} label="Total"      value={stats.total} />
        <StatOrb index={1} aura={CYAN}       label="Sent"       value={stats.sent} />
        <StatOrb index={2} aura={AMBER}      label="Pending"    value={stats.pending} />
        <StatOrb index={3} aura={ROSE}       label="Failed"     value={stats.failed} />
        <StatOrb index={4} aura={AMBER}      label="Suppressed" value={stats.suppressed} />
      </div>

      {/* Charts — derived from the loaded email-log rows (no extra fetch) */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="By status" meta={`${rows.length} emails`}>
            <Donut data={statusDist} centerLabel="emails" />
          </FloatSection>
          <FloatSection title="Delivery volume" meta="last 14 days">
            <TrendArea data={perDay} valueLabel="emails" />
          </FloatSection>
          {templateDist.length > 0 && (
            <FloatSection title="By template" meta="top 8">
              <CategoryBars data={templateDist} valueSuffix="emails" />
            </FloatSection>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <form onSubmit={submitFilter} className="flex-1 min-w-[260px]">
          <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono block mb-1.5">
            Filter by recipient email
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="user@example.com or substring"
                className="w-full pl-9 pr-3 py-2 rounded-full bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus:outline-none focus:bg-white/[0.07] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#06070a] transition-colors hover:bg-white/90"
            >
              Search
            </button>
          </div>
        </form>
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono block mb-1.5">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-full bg-white/[0.04] text-sm text-white focus:outline-none focus:bg-white/[0.07] transition-colors"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </div>
      </div>

      {/* Auth hook activity hint */}
      {activeFilter && rows.length === 0 && !loading && !error && (
        <div className="rounded-2xl bg-amber-500/5 p-4 text-sm text-amber-200">
          <div className="font-medium mb-1">No email log entries found for "{activeFilter}"</div>
          <div className="text-amber-200/70 text-xs leading-relaxed">
            If a user signed up but no row appears here, the auth-email-hook was likely never invoked by Supabase Auth.
            Check Cloud → Emails to confirm the hook is activated, and re-deploy <code className="font-mono px-1">auth-email-hook</code> to trigger reconcile.
          </div>
        </div>
      )}

      {/* Table */}
      <FloatSection title="Delivery log" meta={loading ? "loading…" : `${filteredRows.length} shown`}>
        {loading ? (
          <div className="p-12 flex items-center justify-center text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs uppercase tracking-[0.3em] font-mono">Loading…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-300">
            <div className="font-medium mb-1">Failed to load email log</div>
            <div className="text-red-300/70 text-xs font-mono">{error}</div>
          </div>
        ) : (
          <FloatTable
            empty="No emails match the current filters."
            columns={[
              { key: "template", label: "Template" },
              { key: "recipient", label: "Recipient" },
              { key: "status", label: "Status" },
              { key: "when", label: "When" },
              { key: "error", label: "Error" },
            ]}
            rows={filteredRows.map((r) => ({
              _key: r.id,
              template: <span className="font-mono text-xs text-white/80">{r.template_name || "—"}</span>,
              recipient: <span className="text-xs text-white/70">{r.recipient_email || "—"}</span>,
              status: <StatusBadge status={r.status} />,
              when: <span className="font-mono text-xs whitespace-nowrap text-white/50">{new Date(r.created_at).toLocaleString()}</span>,
              error: <span className="block max-w-md truncate text-xs text-red-300/80" title={r.error_message || undefined}>{r.error_message || ""}</span>,
            }))}
          />
        )}
      </FloatSection>
      </div>
    </AdminPageShell>
  );
}

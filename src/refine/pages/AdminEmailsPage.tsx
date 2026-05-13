import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, RefreshCw, Search, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "../components/AdminPageShell";

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

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  sent:        { bg: "bg-emerald-500/15 border-emerald-400/40", text: "text-emerald-300", icon: CheckCircle2 },
  pending:     { bg: "bg-amber-500/15 border-amber-400/40",     text: "text-amber-300",   icon: Clock },
  failed:      { bg: "bg-red-500/15 border-red-400/40",          text: "text-red-300",     icon: XCircle },
  dlq:         { bg: "bg-red-500/20 border-red-400/50",          text: "text-red-300",     icon: XCircle },
  bounced:     { bg: "bg-red-500/15 border-red-400/40",          text: "text-red-300",     icon: XCircle },
  complained:  { bg: "bg-red-500/15 border-red-400/40",          text: "text-red-300",     icon: XCircle },
  suppressed:  { bg: "bg-yellow-500/15 border-yellow-400/40",    text: "text-yellow-200",  icon: Ban },
};

function StatusBadge({ status }: { status: string | null }) {
  const key = (status || "").toLowerCase();
  const cfg = STATUS_STYLES[key] || { bg: "bg-white/5 border-white/10", text: "text-white/70", icon: Mail };
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-[0.2em] font-mono",
      cfg.bg, cfg.text
    )}>
      <Icon className="w-3 h-3" />
      {status || "unknown"}
    </span>
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

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "failed") {
      return rows.filter(r => ["failed","dlq","bounced","complained"].includes((r.status||"").toLowerCase()));
    }
    return rows.filter(r => (r.status || "").toLowerCase() === statusFilter);
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
        <button
          onClick={() => fetchLogs(activeFilter)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsla(215,100%,60%,0.15)] border border-[hsla(215,100%,60%,0.4)] text-[hsl(215,100%,80%)] hover:bg-[hsla(215,100%,60%,0.25)] transition-colors text-xs uppercase tracking-[0.2em] font-mono disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",      value: stats.total,      tone: "text-white" },
          { label: "Sent",       value: stats.sent,       tone: "text-emerald-300" },
          { label: "Pending",    value: stats.pending,    tone: "text-amber-300" },
          { label: "Failed",     value: stats.failed,     tone: "text-red-300" },
          { label: "Suppressed", value: stats.suppressed, tone: "text-yellow-200" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-[hsla(220,14%,4%,0.6)] border border-white/[0.06] backdrop-blur-xl p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">{s.label}</div>
            <div className={cn("text-2xl font-semibold mt-1 font-mono", s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>

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
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsla(220,14%,4%,0.7)] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[hsla(215,100%,60%,0.5)] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[hsl(215,100%,60%)] text-white text-xs uppercase tracking-[0.2em] font-mono hover:bg-[hsl(215,100%,55%)] transition-colors"
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
            className="px-3 py-2 rounded-lg bg-[hsla(220,14%,4%,0.7)] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[hsla(215,100%,60%,0.5)] transition-colors"
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
        <div className="rounded-xl bg-amber-500/5 border border-amber-400/30 p-4 text-sm text-amber-200">
          <div className="font-medium mb-1">No email log entries found for "{activeFilter}"</div>
          <div className="text-amber-200/70 text-xs leading-relaxed">
            If a user signed up but no row appears here, the auth-email-hook was likely never invoked by Supabase Auth.
            Check Cloud → Emails to confirm the hook is activated, and re-deploy <code className="font-mono px-1">auth-email-hook</code> to trigger reconcile.
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-[hsla(220,14%,4%,0.6)] border border-white/[0.06] backdrop-blur-xl overflow-hidden">
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
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-sm">No emails match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">
                  <th className="text-left px-4 py-3 font-medium">Template</th>
                  <th className="text-left px-4 py-3 font-medium">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white/80 font-mono text-xs">{r.template_name || "—"}</td>
                    <td className="px-4 py-3 text-white/70 text-xs">{r.recipient_email || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-red-300/80 text-xs max-w-md truncate" title={r.error_message || undefined}>
                      {r.error_message || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </AdminPageShell>
  );
}
/**
 * Admin Dashboard — Cinematic command bridge.
 * Luminous KPI tiles with conic glow rings, magnetic hover, sparkline ribbon, command actions.
 */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  FolderKanban,
  Coins,
  Activity,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  ArrowDownRight,
  Shield,
  ChevronRight,
  Power,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats {
  total_users: number;
  users_today: number;
  total_projects: number;
  projects_today: number;
  total_credits_sold: number;
  total_credits_used: number;
  active_generations: number;
  completed_videos: number;
}

interface CostSummary {
  totalApiCost: number;
  totalWastedCost: number;
  totalRetries: number;
  totalRefunds: number;
  failedClips: number;
  wastePercentage: number;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// ─── Magnetic luminous KPI tile ───────────────────────────────────────────────
const KpiTile = memo(function KpiTile({
  icon: Icon, label, code, value, sub, hue = 215, alert = false,
}: {
  icon: React.ElementType;
  label: string;
  code: string;
  value: string | number;
  sub?: string;
  hue?: number;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(155deg, hsla(${hue},14%,5%,0.7), hsla(${hue},14%,3%,0.85))`,
        border: `1px solid hsla(${hue},100%,60%,${alert ? 0.3 : 0.14})`,
        boxShadow: `0 18px 50px -28px hsla(${hue},100%,${alert ? 50 : 60}%,${alert ? 0.55 : 0.35})`,
      }}
    >
      {/* cursor halo */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(220px circle at var(--mx,50%) var(--my,50%), hsla(${hue},100%,68%,0.18), transparent 60%)` }}
      />
      {/* top hairline */}
      <div className="absolute top-0 left-3 right-3 h-px"
        style={{ background: `linear-gradient(90deg, transparent, hsla(${hue},100%,68%,0.5), transparent)` }} />
      {/* corner ticks */}
      <span className="absolute top-2 left-2 w-2.5 h-2.5 border-t border-l" style={{ borderColor: `hsla(${hue},100%,60%,0.4)` }} />
      <span className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b border-r" style={{ borderColor: `hsla(${hue},100%,60%,0.4)` }} />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `hsla(${hue},100%,60%,0.12)`, border: `1px solid hsla(${hue},100%,60%,0.4)` }}>
            <Icon className="w-4 h-4" style={{ color: `hsl(${hue},100%,75%)` }} />
            {alert && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[hsl(0,80%,60%)] animate-ping" />
            )}
          </div>
          <div>
            <span className="block text-[9px] font-mono uppercase tracking-[0.32em]" style={{ color: `hsl(${hue},100%,68%)` }}>
              {code}
            </span>
            <span className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.2em]">{label}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-white/40 mt-1 font-mono tracking-wide">{sub}</p>}
      </div>
    </div>
  );
});

// ─── Quick-jump action card ───────────────────────────────────────────────────
function ActionCard({ icon: Icon, label, desc, code, onClick }: {
  icon: React.ElementType; label: string; desc: string; code: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 bg-[hsla(220,14%,4%,0.55)] border border-white/[0.06] hover:border-[hsla(215,100%,60%,0.4)] hover:shadow-[0_18px_40px_-22px_hsla(215,100%,60%,0.55)]"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'radial-gradient(280px circle at 100% 0%, hsla(215,100%,60%,0.14), transparent 60%)' }} />
      <div className="relative flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsla(215,100%,60%,0.1)] border border-[hsla(215,100%,60%,0.3)]">
          <Icon className="w-4 h-4 text-[hsl(215,100%,75%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white">{label}</span>
            <span className="text-[9px] font-mono tracking-[0.3em] text-white/30">{code}</span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5 truncate">{desc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[hsl(215,100%,75%)] group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) throw error;
      setStats(data as unknown as AdminStats);
    } catch {
      toast.error("Failed to load admin stats");
    }
  };

  const fetchCostSummary = async () => {
    try {
      const fetchAll = async (table: string, select: string) => {
        const allRows: any[] = [];
        let offset = 0;
        while (true) {
          const { data } = await supabase.from(table as any).select(select).range(offset, offset + 999);
          if (!data || data.length === 0) break;
          allRows.push(...data);
          if (data.length < 1000) break;
          offset += 1000;
        }
        return allRows;
      };

      const [apiData, clipsData, refundsResult] = await Promise.all([
        fetchAll("api_cost_logs", "service, status, real_cost_cents"),
        fetchAll("video_clips", "id, status, retry_count"),
        supabase.from("credit_transactions").select("amount").eq("transaction_type", "refund"),
      ]);

      let totalApiCost = 0, failedApiCost = 0, failedClips = 0;

      apiData.forEach((log: any) => {
        // Use the actual real_cost_cents from DB — this is the source of truth
        const cost = log.real_cost_cents || 0;
        totalApiCost += cost;
        if (log.status === "failed") { failedApiCost += cost; failedClips++; }
      });

      const totalRetries = clipsData.reduce((s: number, c: any) => s + (c.retry_count || 0), 0);
      // Retry cost is already included in api_cost_logs (each retry creates a new log entry)
      const totalRefunds = (refundsResult.data || []).reduce((s: number, r: any) => s + Math.abs(r.amount || 0), 0);
      const totalWastedCost = failedApiCost;

      setCostSummary({
        totalApiCost,
        totalWastedCost,
        totalRetries,
        totalRefunds,
        failedClips,
        wastePercentage: totalApiCost > 0 ? (totalWastedCost / totalApiCost) * 100 : 0,
      });
    } catch { /* silent */ }
  };

  useEffect(() => { fetchStats(); fetchCostSummary(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchCostSummary()]);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleForceLogout = async () => {
    if (!confirm("Force-logout ALL users?")) return;
    try {
      const { error } = await supabase.rpc("admin_force_logout_all");
      if (error) throw error;
      toast.success("All users have been logged out");
    } catch { toast.error("Failed to force logout users"); }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* ─── Hero ─── */}
      <header className="relative overflow-hidden rounded-3xl border border-[hsla(215,100%,60%,0.18)] bg-[hsla(220,14%,4%,0.55)] backdrop-blur-xl p-6 md:p-8">
        <div className="absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(700px 320px at 80% -10%, hsla(215,100%,60%,0.18), transparent 65%)' }} />
        <div className="absolute top-0 left-6 right-6 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,68%,0.55), transparent)' }} />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-[hsl(215,100%,68%)] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,68%)] shadow-[0_0_10px_hsla(215,100%,60%,0.9)]" />
              OVR · COMMAND BRIDGE
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Welcome back, Operator.
            </h1>
            <p className="text-[12px] text-white/40 max-w-md font-mono tracking-wide">
              Signed as <span className="text-white/70">{user?.email}</span> · Privileged session active.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-[0.18em] font-medium text-white/70 hover:text-white bg-[hsla(220,14%,5%,0.6)] border border-white/[0.06] hover:border-[hsla(215,100%,60%,0.35)] transition-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Sync
            </button>
            <button
              onClick={handleForceLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-[0.18em] font-medium text-[hsl(0,75%,72%)] hover:text-white bg-[hsla(0,60%,12%,0.4)] border border-[hsla(0,70%,55%,0.28)] hover:bg-[hsla(0,70%,30%,0.4)] hover:border-[hsla(0,80%,60%,0.55)] transition-all"
            >
              <Power className="w-3.5 h-3.5" />
              Force Logout
            </button>
          </div>
        </div>
      </header>

      {/* ─── Platform metrics ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(215,100%,68%)]">PLT</span>
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/30">Platform Telemetry</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsla(215,100%,60%,0.2), transparent)' }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile icon={Users} code="USR" label="Users" value={stats?.total_users?.toLocaleString() || "0"} sub={`+${stats?.users_today || 0} today`} hue={215} />
          <KpiTile icon={FolderKanban} code="PRJ" label="Projects" value={stats?.total_projects?.toLocaleString() || "0"} sub={`+${stats?.projects_today || 0} today`} hue={210} />
          <KpiTile icon={Coins} code="CRD" label="Credits Sold" value={stats?.total_credits_sold?.toLocaleString() || "0"} sub={`${stats?.total_credits_used?.toLocaleString() || 0} consumed`} hue={195} />
          <KpiTile icon={Activity} code="JOB" label="Active Jobs" value={stats?.active_generations ?? 0} sub={`${stats?.completed_videos ?? 0} completed`} hue={150} />
        </div>
      </section>

      {/* ─── Treasury ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(215,100%,68%)]">FIN</span>
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/30">Treasury & Cost Membrane</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsla(215,100%,60%,0.2), transparent)' }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile icon={DollarSign} code="SPN" label="API Spend" value={formatCurrency(costSummary?.totalApiCost || 0)} sub="All-time" hue={215} />
          <KpiTile icon={AlertTriangle} code="WST" label="Wasted" value={formatCurrency(costSummary?.totalWastedCost || 0)} sub={`${(costSummary?.wastePercentage || 0).toFixed(1)}% of spend`} hue={0} alert={(costSummary?.wastePercentage || 0) > 5} />
          <KpiTile icon={RefreshCw} code="RTY" label="Retries" value={costSummary?.totalRetries?.toLocaleString() || "0"} sub="Clip retries" hue={40} />
          <KpiTile icon={ArrowDownRight} code="RFD" label="Refunds" value={costSummary?.totalRefunds?.toLocaleString() || "0"} sub="Credits returned" hue={195} />
        </div>
      </section>

      {/* ─── Failure banner ─── */}
      {(costSummary?.failedClips || 0) > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[hsla(0,70%,55%,0.28)] bg-[hsla(0,40%,8%,0.4)] backdrop-blur-xl p-5">
          <div className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(500px 200px at 0% 0%, hsla(0,80%,55%,0.14), transparent 65%)' }} />
          <div className="flex items-center gap-4">
            <div className="relative w-11 h-11 rounded-xl bg-[hsla(0,70%,55%,0.12)] border border-[hsla(0,70%,55%,0.45)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[hsl(0,80%,72%)]" />
              <span className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 16px hsla(0,80%,60%,0.55)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white">
                {costSummary?.failedClips} failed operations detected
              </p>
              <p className="text-[11px] text-white/50 font-mono">
                {formatCurrency(costSummary?.totalWastedCost || 0)} burned · open Production to triage
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/production")}
              className="px-4 py-2 rounded-xl text-[11px] uppercase tracking-[0.2em] font-medium text-white bg-[hsla(0,70%,30%,0.45)] border border-[hsla(0,80%,60%,0.5)] hover:bg-[hsla(0,75%,40%,0.6)] transition-all"
            >
              Triage
            </button>
          </div>
        </div>
      )}

      {/* ─── Quick-jump deck ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(215,100%,68%)]">NAV</span>
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/30">Quick Channels</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsla(215,100%,60%,0.2), transparent)' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ActionCard icon={Users} code="USR" label="Users" desc="Roles, suspensions, identity" onClick={() => navigate("/admin/users")} />
          <ActionCard icon={FolderKanban} code="PRJ" label="Projects" desc="Inspect every active render" onClick={() => navigate("/admin/projects")} />
          <ActionCard icon={Activity} code="PRD" label="Production" desc="Pipeline + failed clip triage" onClick={() => navigate("/admin/production")} />
          <ActionCard icon={DollarSign} code="FIN" label="Finance" desc="Revenue, costs, packages" onClick={() => navigate("/admin/finance")} />
          <ActionCard icon={Shield} code="MOD" label="Moderation" desc="Content review queue" onClick={() => navigate("/admin/moderation")} />
          <ActionCard icon={Coins} code="TXN" label="Transactions" desc="Credit ledger" onClick={() => navigate("/admin/credits")} />
        </div>
      </section>
    </div>
  );
}

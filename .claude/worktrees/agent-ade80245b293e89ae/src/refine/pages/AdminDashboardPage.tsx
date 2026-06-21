/**
 * Admin Dashboard — Command Bridge (Tactical Operator HUD)
 * Pro-Dark + #0A84FF, Fraunces hero, JetBrains mono UI, dense ops grid.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, FolderKanban, Coins, Activity, DollarSign, AlertTriangle,
  RefreshCw, ArrowDownRight, Shield, ChevronRight, Power, MessageSquare, Mail, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats {
  total_users: number; users_today: number;
  total_projects: number; projects_today: number;
  total_credits_sold: number; total_credits_used: number;
  active_generations: number; completed_videos: number;
}
interface CostSummary {
  totalApiCost: number; totalWastedCost: number;
  totalRetries: number; totalRefunds: number;
  failedClips: number; wastePercentage: number;
}

const fmtUSD = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// ─── Module tile ──────────────────────────────────────────────────────────────
function ModuleTile({
  code, label, value, sub, accent = false, alert = false,
}: { code: string; label: string; value: string | number; sub?: string; accent?: boolean; alert?: boolean }) {
  return (
    <div className={cn(
      "group relative bg-white/[0.02] border rounded-2xl p-6 backdrop-blur-md transition-all hover:bg-white/[0.035]",
      alert ? "border-red-500/30 hover:border-red-500/50" : accent ? "border-[#0A84FF]/25 hover:border-[#0A84FF]/40" : "border-white/5 hover:border-white/10"
    )}>
      <div className="flex justify-between items-start mb-6">
        <div className="w-1.5 h-1.5 rounded-full">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            alert ? "bg-red-400" : accent ? "bg-[#0A84FF]" : "bg-white/40"
          )} style={accent || alert ? { boxShadow: alert ? "0 0 8px rgba(248,113,113,0.6)" : "0 0 8px rgba(10,132,255,0.6)" } : undefined} />
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-[0.22em]",
          alert ? "text-red-400" : accent ? "text-[#0A84FF]" : "text-white/30"
        )}>
          MOD // {code}
        </span>
      </div>
      <div className="space-y-1">
        <div
          className="text-4xl font-light text-white tracking-tight tabular-nums"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {value}
        </div>
        <div className="text-[10px] text-white/40 uppercase tracking-[0.18em]">{label}</div>
      </div>
      {sub && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-mono uppercase tracking-wider",
            alert ? "text-red-400" : accent ? "text-[#0A84FF]" : "text-white/40"
          )}>
            {sub}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Channel button ───────────────────────────────────────────────────────────
function Channel({ n, code, label, desc, icon: Icon, onClick }: {
  n: string; code: string; label: string; desc: string; icon: React.ElementType; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-[#0A84FF]/40 hover:bg-white/[0.02] transition-all text-left w-full"
    >
      <div className="w-11 h-11 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/40 group-hover:text-[#0A84FF] group-hover:border-[#0A84FF]/40 transition-colors shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-white" style={{ fontFamily: "'Fraunces', serif" }}>{label}</span>
          <span className="text-[9px] text-white/25 font-mono tracking-widest">{code}</span>
        </div>
        <div className="text-[10px] text-white/40 truncate mt-0.5">{desc}</div>
      </div>
      <span className="text-[10px] text-white/20 font-mono">{n}</span>
      <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-[#0A84FF] group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) throw error;
      setStats(data as unknown as AdminStats);
    } catch { toast.error("Failed to load admin stats"); }
  }, []);

  const fetchCost = useCallback(async () => {
    try {
      const fetchAll = async (table: string, select: string) => {
        const rows: any[] = []; let off = 0;
        while (true) {
          const { data } = await supabase.from(table as any).select(select).range(off, off + 999);
          if (!data || data.length === 0) break;
          rows.push(...data);
          if (data.length < 1000) break;
          off += 1000;
        }
        return rows;
      };
      const [api, clips, refunds] = await Promise.all([
        fetchAll("api_cost_logs", "service, status, real_cost_cents"),
        fetchAll("video_clips", "id, status, retry_count"),
        supabase.from("credit_transactions").select("amount").eq("transaction_type", "refund"),
      ]);
      let totalApiCost = 0, failedApiCost = 0, failedClips = 0;
      api.forEach((l: any) => {
        const c = l.real_cost_cents || 0;
        totalApiCost += c;
        if (l.status === "failed") { failedApiCost += c; failedClips++; }
      });
      const totalRetries = clips.reduce((s: number, c: any) => s + (c.retry_count || 0), 0);
      const totalRefunds = (refunds.data || []).reduce((s: number, r: any) => s + Math.abs(r.amount || 0), 0);
      setCost({
        totalApiCost,
        totalWastedCost: failedApiCost,
        totalRetries,
        totalRefunds,
        failedClips,
        wastePercentage: totalApiCost > 0 ? (failedApiCost / totalApiCost) * 100 : 0,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStats(); fetchCost(); }, [fetchStats, fetchCost]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchCost()]);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleForceLogout = async () => {
    if (!confirm("Force-logout ALL users?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-force-logout", { body: { scope: "all" } });
      if (error) throw error;
      toast.success(`Logged out ${data?.affected ?? 0} user(s)`);
    } catch { toast.error("Failed to force logout users"); }
  };

  const wastePct = (cost?.wastePercentage || 0);
  const treasuryHealthy = wastePct < 5;
  const sessionStart = "08:24:11"; // static label

  return (
    <div className="p-8 lg:p-12 space-y-12 animate-fade-in max-w-[1480px] mx-auto">
      {/* ─── Command Bridge Hero ─── */}
      <section className="relative bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-3xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        {/* Aurora */}
        <div
          className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,0.22), transparent 65%)", filter: "blur(60px)" }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none opacity-60"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,0.06), transparent 70%)", filter: "blur(80px)" }}
        />

        <div className="relative p-10 lg:p-14 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          {/* Left */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full border border-[#0A84FF]/40 bg-[#0A84FF]/5 text-[#0A84FF] text-[9px] font-bold tracking-[0.28em] uppercase">
                Command Bridge
              </span>
              <span className="h-px w-12 bg-white/15" />
              <span className="text-white/35 text-[10px] tracking-[0.28em] uppercase font-mono">
                Session Active / {sessionStart}
              </span>
            </div>
            <h1
              className="text-5xl lg:text-7xl text-white font-light tracking-tight leading-[0.95] mb-6"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Welcome back,{" "}
              <span className="italic text-[#0A84FF] font-light">Operator.</span>
            </h1>
            <p className="text-[14px] text-white/45 max-w-lg leading-relaxed font-light">
              Authenticated as <span className="text-white/75 font-mono text-[12px]">{user?.email}</span>. Privileged session
              active across the entire membrane. All systems nominal.
            </p>

            <div className="flex gap-3 pt-8">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0A84FF] text-white text-[10px] font-bold uppercase tracking-[0.22em] hover:brightness-110 transition-all shadow-[0_0_28px_rgba(10,132,255,0.4)]"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                System Sync
              </button>
              <button
                onClick={handleForceLogout}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-300 transition-all"
              >
                <Power className="w-3.5 h-3.5" />
                Force Logout
              </button>
            </div>
          </div>

          {/* Right — vital readout */}
          <div className="flex gap-10 lg:border-l lg:border-white/10 lg:pl-10 shrink-0">
            <div className="flex flex-col gap-2 min-w-[120px]">
              <span className="text-[9px] text-white/30 uppercase tracking-[0.28em] font-mono">Active Jobs</span>
              <span className="text-5xl text-white font-light tabular-nums" style={{ fontFamily: "'Fraunces', serif" }}>
                {stats?.active_generations ?? 0}
              </span>
              <div className="w-full h-px bg-white/5 mt-3 overflow-hidden">
                <div className="h-full bg-[#0A84FF]" style={{ width: `${Math.min(100, (stats?.active_generations ?? 0) * 8)}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[120px]">
              <span className="text-[9px] text-white/30 uppercase tracking-[0.28em] font-mono">Waste Ratio</span>
              <span
                className={cn("text-5xl font-light tabular-nums", wastePct > 5 ? "text-red-400" : "text-[#0A84FF]")}
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {wastePct.toFixed(1)}%
              </span>
              <div className="w-full h-px bg-white/5 mt-3 overflow-hidden">
                <div
                  className={cn("h-full", wastePct > 5 ? "bg-red-500" : "bg-[#0A84FF]")}
                  style={{ width: `${Math.min(100, wastePct * 4)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Module grid: PEOPLE / CONTENT / MONEY / SYSTEM ─── */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.4em]">Telemetry</span>
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">04 modules</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <ModuleTile
            code="PPL"
            label="Total Users"
            value={stats?.total_users?.toLocaleString() || "0"}
            sub={`+${stats?.users_today || 0} today`}
            accent
          />
          <ModuleTile
            code="PRJ"
            label="Total Projects"
            value={stats?.total_projects?.toLocaleString() || "0"}
            sub={`+${stats?.projects_today || 0} today`}
          />
          <ModuleTile
            code="CRD"
            label="Credits Sold"
            value={stats?.total_credits_sold?.toLocaleString() || "0"}
            sub={`${stats?.total_credits_used?.toLocaleString() || 0} consumed`}
          />
          <ModuleTile
            code="JOB"
            label="Completed Videos"
            value={stats?.completed_videos?.toLocaleString() || "0"}
            sub="Lifetime"
          />
        </div>
      </section>

      {/* ─── Treasury membrane ─── */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.4em]">Treasury Membrane</span>
          <div className="h-px flex-1 bg-white/5" />
          <span
            className={cn(
              "text-[10px] font-mono uppercase tracking-widest flex items-center gap-2",
              treasuryHealthy ? "text-emerald-400/80" : "text-red-400/80"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", treasuryHealthy ? "bg-emerald-500" : "bg-red-500")} />
            {treasuryHealthy ? "Healthy" : "Attention"}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <ModuleTile code="SPN" label="API Spend" value={fmtUSD(cost?.totalApiCost || 0)} sub="All-time" />
          <ModuleTile
            code="WST"
            label="Wasted"
            value={fmtUSD(cost?.totalWastedCost || 0)}
            sub={`${wastePct.toFixed(1)}% of spend`}
            alert={wastePct > 5}
          />
          <ModuleTile code="RTY" label="Retries" value={cost?.totalRetries?.toLocaleString() || "0"} sub="Clip retries" />
          <ModuleTile code="RFD" label="Refunds" value={cost?.totalRefunds?.toLocaleString() || "0"} sub="Credits returned" />
        </div>
      </section>

      {/* ─── Failure banner ─── */}
      {(cost?.failedClips || 0) > 0 && (
        <div className="relative rounded-2xl border border-red-500/25 bg-red-950/15 backdrop-blur-md p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] text-white" style={{ fontFamily: "'Fraunces', serif" }}>
              {cost?.failedClips} failed operations require triage
            </p>
            <p className="text-[10px] text-white/45 font-mono mt-1 uppercase tracking-wider">
              {fmtUSD(cost?.totalWastedCost || 0)} burned · open Production to triage
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/production")}
            className="px-5 py-2.5 rounded-lg text-[10px] uppercase tracking-[0.22em] font-bold text-white bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-colors"
          >
            Triage
          </button>
        </div>
      )}

      {/* ─── Channels ─── */}
      <section className="pt-4">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.4em]">Quick Channels</span>
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">09 routes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Channel n="03" code="PPL" label="Identity" desc="Roles, suspensions, identity" icon={Users} onClick={() => navigate("/admin/users")} />
          <Channel n="07" code="CNT" label="Projects" desc="Inspect every active render" icon={FolderKanban} onClick={() => navigate("/admin/projects")} />
          <Channel n="02" code="OPS" label="Production" desc="Pipeline + failed clip triage" icon={Activity} onClick={() => navigate("/admin/production")} />
          <Channel n="05" code="FIN" label="Treasury" desc="Revenue, costs, packages" icon={DollarSign} onClick={() => navigate("/admin/finance")} />
          <Channel n="08" code="MOD" label="Moderation" desc="Content review queue" icon={Shield} onClick={() => navigate("/admin/moderation")} />
          <Channel n="06" code="LDG" label="Ledger" desc="Credit transaction registry" icon={Coins} onClick={() => navigate("/admin/credits")} />
          <Channel n="04" code="MSG" label="Inbox" desc="User support messages" icon={MessageSquare} onClick={() => navigate("/admin/messages")} />
          <Channel n="09" code="EML" label="Emails" desc="Transactional template log" icon={Mail} onClick={() => navigate("/admin/emails")} />
          <Channel n="10" code="CFG" label="Config" desc="Membrane configuration" icon={Settings} onClick={() => navigate("/admin/config")} />
        </div>
      </section>
    </div>
  );
}

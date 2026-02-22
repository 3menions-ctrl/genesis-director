/**
 * Admin Dashboard Page — Overview stats + cost summary.
 * Extracted from the monolithic Admin.tsx overview tab.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Calculator,
  Shield,
  Crown,
  BarChart3,
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

const VEO_COST_PER_CLIP_CENTS = 8;

function StatPill({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}) {
  const accentColor = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  }[accent || 'primary'];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04]", accentColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);

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
      const costMap: Record<string, number> = {
        google_veo: 8, "openai-tts": 2, cloud_run_stitcher: 2, openai: 12, dalle: 4, gemini: 1,
      };

      apiData.forEach((log: any) => {
        const cost = costMap[log.service] ?? (log.real_cost_cents || 0);
        totalApiCost += cost;
        if (log.status === "failed") { failedApiCost += cost; failedClips++; }
      });

      const totalRetries = clipsData.reduce((s: number, c: any) => s + (c.retry_count || 0), 0);
      const retryCost = totalRetries * VEO_COST_PER_CLIP_CENTS;
      const totalRefunds = (refundsResult.data || []).reduce((s: number, r: any) => s + Math.abs(r.amount || 0), 0);
      const totalWastedCost = failedApiCost + retryCost;

      setCostSummary({
        totalApiCost: totalApiCost + retryCost,
        totalWastedCost,
        totalRetries,
        totalRefunds,
        failedClips,
        wastePercentage: (totalApiCost + retryCost) > 0 ? (totalWastedCost / (totalApiCost + retryCost)) * 100 : 0,
      });
    } catch { /* silent */ }
  };

  useEffect(() => { fetchStats(); fetchCostSummary(); }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Admin</h1>
            <p className="text-[11px] text-white/30">{user?.email}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-medium text-white/40 border-white/10 gap-1.5">
          <Crown className="w-3 h-3" />
          Administrator
        </Badge>
      </div>

      <div className="h-px bg-white/[0.04]" />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill icon={Users} label="Users" value={stats?.total_users?.toLocaleString() || "0"} sub={`+${stats?.users_today || 0} today`} accent="primary" />
        <StatPill icon={FolderKanban} label="Projects" value={stats?.total_projects?.toLocaleString() || "0"} sub={`+${stats?.projects_today || 0} today`} accent="info" />
        <StatPill icon={Coins} label="Credits Sold" value={stats?.total_credits_sold?.toLocaleString() || "0"} sub={`${stats?.total_credits_used?.toLocaleString() || 0} used`} accent="warning" />
        <StatPill icon={Activity} label="Active Jobs" value={stats?.active_generations || 0} sub={`${stats?.completed_videos || 0} completed`} accent="success" />
      </div>

      {/* Cost Overview */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30 flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5" />
          Cost Overview
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatPill icon={DollarSign} label="API Spend" value={formatCurrency(costSummary?.totalApiCost || 0)} sub="All-time" accent="primary" />
          <StatPill icon={AlertTriangle} label="Wasted" value={formatCurrency(costSummary?.totalWastedCost || 0)} sub={`${(costSummary?.wastePercentage || 0).toFixed(1)}% of total`} accent="destructive" />
          <StatPill icon={RefreshCw} label="Retries" value={costSummary?.totalRetries?.toLocaleString() || "0"} sub={formatCurrency((costSummary?.totalRetries || 0) * VEO_COST_PER_CLIP_CENTS)} accent="warning" />
          <StatPill icon={ArrowDownRight} label="Refunds" value={costSummary?.totalRefunds?.toLocaleString() || "0"} sub="Credits refunded" accent="info" />
        </div>
      </div>

      {/* Failed warning */}
      {(costSummary?.failedClips || 0) > 0 && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{costSummary?.failedClips} failed operations</p>
              <p className="text-xs text-white/30">{formatCurrency(costSummary?.totalWastedCost || 0)} wasted</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => { fetchStats(); fetchCostSummary(); }} variant="ghost" size="sm" className="text-xs text-white/30 hover:text-white/60">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
        <Button
          onClick={async () => {
            if (!confirm("Force-logout ALL users?")) return;
            try {
              const { error } = await supabase.rpc("admin_force_logout_all");
              if (error) throw error;
              toast.success("All users have been logged out");
            } catch { toast.error("Failed to force logout users"); }
          }}
          variant="ghost"
          size="sm"
          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Shield className="w-3.5 h-3.5 mr-1.5" />
          Force Logout All
        </Button>
      </div>
    </div>
  );
}

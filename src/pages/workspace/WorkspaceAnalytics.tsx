import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart3, Film, Sparkles, TrendingUp } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

interface MemberRow {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  credits_used_30d: number;
  projects_30d: number;
}

export default function WorkspaceAnalytics() {
  const { currentOrg, hasPermission } = useWorkspace();
  const canView = hasPermission('admin');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MemberRow[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg || !canView) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Get every member of this org
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', currentOrg.id);
      const userIds = (members ?? []).map(m => m.user_id);
      if (userIds.length === 0) { setRows([]); return; }

      // 2. Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, email, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

      // 3. Credit usage in last 30 days (sum of negative amounts)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: txns } = await supabase
        .from('credit_transactions')
        .select('user_id, amount')
        .in('user_id', userIds)
        .lt('amount', 0)
        .gte('created_at', since);
      const usageMap = new Map<string, number>();
      (txns ?? []).forEach(t => {
        usageMap.set(t.user_id, (usageMap.get(t.user_id) ?? 0) + Math.abs(t.amount));
      });

      // 4. Project count in last 30 days
      const { data: projs } = await supabase
        .from('movie_projects')
        .select('user_id, id')
        .in('user_id', userIds)
        .gte('created_at', since);
      const projMap = new Map<string, number>();
      (projs ?? []).forEach(p => {
        projMap.set(p.user_id, (projMap.get(p.user_id) ?? 0) + 1);
      });

      const result: MemberRow[] = userIds.map(uid => {
        const p = profileMap.get(uid);
        return {
          user_id: uid,
          display_name: p?.display_name || p?.full_name || 'Unknown',
          email: p?.email ?? '',
          avatar_url: p?.avatar_url ?? null,
          credits_used_30d: usageMap.get(uid) ?? 0,
          projects_30d: projMap.get(uid) ?? 0,
        };
      }).sort((a, b) => b.credits_used_30d - a.credits_used_30d);
      setRows(result);
    } catch (e: any) {
      console.error('[analytics] load', e);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, canView]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    credits: rows.reduce((a, r) => a + r.credits_used_30d, 0),
    projects: rows.reduce((a, r) => a + r.projects_30d, 0),
    activeUsers: rows.filter(r => r.credits_used_30d > 0 || r.projects_30d > 0).length,
  }), [rows]);

  const maxUse = Math.max(1, ...rows.map(r => r.credits_used_30d));

  if (!canView) {
    return (
      <WorkspaceLayout>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <p className="text-white/55 text-[13px]">Analytics is only visible to workspace admins and owners.</p>
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <div className="space-y-7">
        {/* Headline stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon={Sparkles} label="Credits used (30d)" value={loading ? '—' : totals.credits.toLocaleString()} />
          <Stat icon={Film}     label="Projects (30d)"     value={loading ? '—' : totals.projects.toString()} />
          <Stat icon={TrendingUp} label="Active members"   value={loading ? '—' : `${totals.activeUsers} / ${rows.length}`} />
        </section>

        {/* Per-member breakdown */}
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
          <header className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-[#9DCBFF]" strokeWidth={1.6} />
            <h3 className="text-[15px] font-medium text-white/95">Usage by member</h3>
            <span className="ml-auto text-[11px] text-white/35">Last 30 days</span>
          </header>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-white/[0.02] rounded-lg animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-[12px] text-white/35 py-6 text-center">No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(r => {
                const pct = (r.credits_used_30d / maxUse) * 100;
                return (
                  <li key={r.user_id} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-white/[0.02] transition">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/[0.10] to-white/[0.03] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-white/60">{r.display_name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-white/90 truncate">{r.display_name}</div>
                          <div className="text-[11px] text-white/40 truncate">{r.email}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[13px] text-white tabular-nums">{r.credits_used_30d.toLocaleString()}</div>
                          <div className="text-[10px] text-white/40 uppercase tracking-[0.18em]">{r.projects_30d} projects</div>
                        </div>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0A84FF] to-[#5AC8FA] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>
        <Icon className="w-3.5 h-3.5 text-[#9DCBFF]" strokeWidth={1.5} />
      </div>
      <div className="mt-2 text-2xl font-display font-light text-white">{value}</div>
    </div>
  );
}
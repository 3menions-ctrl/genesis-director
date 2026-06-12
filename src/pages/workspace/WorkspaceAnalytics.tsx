import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart3, Film, Sparkles, TrendingUp, Lock } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Surface, Section, MetricCard } from '@/components/workspace/command-ui';

import { usePageMeta } from '@/hooks/usePageMeta';
interface MemberRow {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  credits_used_30d: number;
  projects_30d: number;
}

export default function WorkspaceAnalytics() {
  usePageMeta({ title: "Workspace Analytics — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canView = hasPermission('admin');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MemberRow[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg || !canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', currentOrg.id);
      const userIds = (members ?? []).map(m => m.user_id);
      if (userIds.length === 0) { setRows([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, email, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

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
      <Surface className="text-center py-14">
        <Lock className="w-6 h-6 mx-auto text-[hsl(220,8%,40%)] mb-3" strokeWidth={1.4} />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(220,14%,82%)]">
          Access denied
        </p>
        <p className="text-[12px] text-[hsl(220,8%,55%)] mt-2 font-light">
          Telemetry is restricted to admins and owners.
        </p>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard icon={Sparkles}    label="Credits · 30d" value={loading ? '—' : totals.credits.toLocaleString()} sub="WORKSPACE BURN" accent />
          <MetricCard icon={Film}        label="Projects · 30d" value={loading ? '—' : totals.projects.toString()}     sub="OUTPUT VOLUME" />
          <MetricCard icon={TrendingUp}  label="Active members" value={loading ? '—' : `${totals.activeUsers} / ${rows.length}`} sub="LAST 30 DAYS" />
        </section>

        <Section
          icon={BarChart3}
          label="Member telemetry"
          sublabel="Credit burn and project output by member."
          action={
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,55%)]">
              WINDOW · 30D
            </span>
          }
        >
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-14 bg-[hsl(220,14%,7%)] animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(220,8%,55%)] py-6 text-center">
              No members on roster.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(220,14%,12%)]">
              {rows.map((r, idx) => {
                const pct = (r.credits_used_30d / maxUse) * 100;
                return (
                  <li key={r.user_id} className="flex items-center gap-4 px-2 py-3 hover:bg-[hsl(220,14%,7%)] transition-colors">
                    <span className="font-mono text-[10px] text-[hsl(220,8%,40%)] tabular-nums w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="w-8 h-8 bg-[hsl(220,14%,8%)] border border-[hsl(220,14%,16%)] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-mono text-[11px] text-[hsl(215,100%,62%)]">{r.display_name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-[hsl(220,14%,92%)] truncate">{r.display_name}</div>
                          <div className="font-mono text-[10px] text-[hsl(220,8%,45%)] truncate">{r.email}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-[13px] text-[hsl(220,14%,98%)] tabular-nums">
                            {r.credits_used_30d.toLocaleString()}
                          </div>
                          <div className="font-mono text-[9px] text-[hsl(220,8%,55%)] uppercase tracking-[0.18em]">
                            {r.projects_30d} PROJECTS
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-[3px] bg-[hsl(220,14%,10%)] overflow-hidden">
                        <div
                          className="h-full bg-[hsl(215,100%,55%)] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
  );
}

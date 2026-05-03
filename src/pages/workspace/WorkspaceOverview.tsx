import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Palette, BarChart3, CreditCard, ArrowUpRight, Building2,
  Film, Image as ImageIcon, Plus, Sparkles, Zap, Layers,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Snapshot {
  members: number;
  invitesPending: number;
  projects: number;
  assets: number;
  creditsUsed30d: number;
  brandColors: string[];
}

const PLAN_HEADLINE: Record<string, { label: string; cta: string }> = {
  starter:          { label: 'Free workspace',    cta: 'Upgrade for seats & analytics' },
  business_starter: { label: 'Business Starter',  cta: 'Upgrade for more seats & credits' },
  business_growth:  { label: 'Business Growth',   cta: 'Scale to 50 seats with Scale tier' },
  business_scale:   { label: 'Business Scale',    cta: 'Talk to sales for Enterprise' },
};

export default function WorkspaceOverview() {
  const { currentOrg, hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<Snapshot>({
    members: 0, invitesPending: 0, projects: 0, assets: 0, creditsUsed30d: 0, brandColors: [],
  });

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sb: any = supabase;
      const m    = await sb.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id);
      const inv  = await sb.from('organization_invites').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('status', 'pending');
      const proj = await sb.from('movie_projects').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id);
      const ass  = await sb.from('organization_brand_assets').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id);
      const org  = await sb.from('organizations').select('brand_colors, brand_primary_color, brand_accent_color').eq('id', currentOrg.id).maybeSingle();
      const txn  = await sb.from('credit_transactions').select('amount').eq('user_id', currentOrg.created_by).eq('transaction_type', 'consumption').gte('created_at', since);
      const used = (txn.data ?? []).reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);
      const palette = (org.data?.brand_colors && org.data.brand_colors.length > 0)
        ? org.data.brand_colors
        : [org.data?.brand_primary_color, org.data?.brand_accent_color].filter(Boolean) as string[];
      setSnap({
        members: m.count ?? 0,
        invitesPending: inv.count ?? 0,
        projects: proj.count ?? 0,
        assets: ass.count ?? 0,
        creditsUsed30d: used,
        brandColors: palette,
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const headline = useMemo(
    () => PLAN_HEADLINE[currentOrg?.plan ?? 'starter'] ?? PLAN_HEADLINE.starter,
    [currentOrg?.plan]
  );

  return (
    <WorkspaceLayout>
      <div className="space-y-7">
        {/* Hero band */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0A84FF]/[0.07] via-white/[0.02] to-transparent p-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-2 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#9DCBFF] font-medium inline-flex items-center gap-2">
                <Building2 className="w-3 h-3" /> {headline.label}
              </div>
              <h2 className="font-display text-[26px] sm:text-[30px] font-light tracking-tight text-white">
                Welcome to {currentOrg?.name ?? 'your workspace'}
              </h2>
              <p className="text-[13px] text-white/55 max-w-xl">
                Everything your team needs to ship cinematic content together — members, brand kit, shared assets and billing in one place.
              </p>
            </div>
            {hasPermission('admin') && (
              <Button
                onClick={() => navigate('/workspace/billing')}
                className="bg-white text-black hover:bg-white/90 rounded-full"
              >
                {headline.cta} <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Users}      label="Members"         value={snap.members}        sub={snap.invitesPending ? `${snap.invitesPending} pending` : 'All accepted'} loading={loading} />
          <Kpi icon={Film}       label="Projects"        value={snap.projects}       sub="Org-wide" loading={loading} />
          <Kpi icon={ImageIcon}  label="Brand assets"    value={snap.assets}         sub="Shared library" loading={loading} />
          <Kpi icon={Zap}        label="Credits (30d)"   value={snap.creditsUsed30d} sub="Burn last month" loading={loading} accent />
        </section>

        {/* Brand snapshot + Quick actions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-medium text-white/95 inline-flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[#9DCBFF]" /> Brand snapshot
              </h3>
              <button onClick={() => navigate('/workspace/brand')} className="text-[11px] text-[#9DCBFF] hover:text-white transition inline-flex items-center gap-1">
                Edit brand kit <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            {snap.brandColors.length === 0 ? (
              <p className="text-[12px] text-white/45">
                No brand colors set. Define your palette so generated content stays on-brand.
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {snap.brandColors.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
                    <span className="w-3 h-3 rounded-full border border-white/15" style={{ background: c }} />
                    <span className="text-[11px] font-mono text-white/65 uppercase">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 flex flex-col">
            <h3 className="text-[14px] font-medium text-white/95 mb-4 inline-flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#9DCBFF]" /> Quick actions
            </h3>
            <div className="space-y-2">
              <QuickLink onClick={() => navigate('/workspace/team')}      icon={Users}     label="Invite teammates" />
              <QuickLink onClick={() => navigate('/workspace/assets')}    icon={Layers}    label="Upload brand assets" />
              <QuickLink onClick={() => navigate('/workspace/analytics')} icon={BarChart3} label="View team analytics" />
              <QuickLink onClick={() => navigate('/create')}              icon={Plus}      label="Start new project" primary />
            </div>
          </div>
        </section>
      </div>
    </WorkspaceLayout>
  );
}

function Kpi({ icon: Icon, label, value, sub, loading, accent }: {
  icon: typeof Users; label: string; value: number; sub: string; loading: boolean; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>
        <Icon className={cn('w-3.5 h-3.5', accent ? 'text-[#5AC8FA]' : 'text-[#9DCBFF]')} strokeWidth={1.5} />
      </div>
      <div className={cn('mt-2 text-2xl font-display font-light', accent ? 'text-[#5AC8FA]' : 'text-white')}>
        {loading ? '—' : value.toLocaleString()}
      </div>
      <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>
    </div>
  );
}

function QuickLink({ onClick, icon: Icon, label, primary }: {
  onClick: () => void; icon: typeof Users; label: string; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition',
        primary
          ? 'bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90'
          : 'bg-white/[0.02] text-white/85 hover:bg-white/[0.05] border border-white/[0.04]'
      )}
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
        {label}
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
    </button>
  );
}

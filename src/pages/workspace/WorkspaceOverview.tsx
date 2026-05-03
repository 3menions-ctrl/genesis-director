import { useEffect, useState, useCallback, useMemo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Palette, BarChart3, CreditCard, Building2,
  Film, Image as ImageIcon, Plus, Zap, Layers, Activity,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import {
  Surface, Section, MetricCard, CmdButton, Pill,
} from '@/components/workspace/command-ui';
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
  starter:          { label: 'FREE WORKSPACE',    cta: 'Activate Business plan' },
  business_starter: { label: 'BUSINESS · STARTER', cta: 'Upgrade to Growth' },
  business_growth:  { label: 'BUSINESS · GROWTH',  cta: 'Scale to 50 seats' },
  business_scale:   { label: 'BUSINESS · SCALE',   cta: 'Talk to Enterprise' },
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
      <div className="space-y-6">
        {/* ── Briefing band ───────────────────────────────────── */}
        <Surface className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
               style={{
                 backgroundImage: 'repeating-linear-gradient(90deg, hsl(215,100%,60%) 0 1px, transparent 1px 80px)',
               }}
          />
          <div className="relative flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-3 min-w-0 max-w-xl">
              <div className="flex items-center gap-2">
                <Pill tone="amber"><Building2 className="w-3 h-3" />{headline.label}</Pill>
                <Pill tone="good"><Activity className="w-3 h-3" />OPERATIONAL</Pill>
              </div>
              <h2 className="font-display text-[26px] sm:text-[30px] font-light tracking-tight text-[hsl(220,14%,98%)]">
                Operations briefing<span className="text-[hsl(215,100%,60%)]">.</span>
              </h2>
              <p className="text-[13px] text-[hsl(220,8%,55%)] font-light">
                Snapshot of <span className="text-[hsl(220,14%,82%)]">{currentOrg?.name ?? 'this workspace'}</span> — roster, output, brand integrity and burn over the last 30 days.
              </p>
            </div>
            {hasPermission('admin') && (
              <CmdButton onClick={() => navigate('/workspace/billing')}>
                {headline.cta} →
              </CmdButton>
            )}
          </div>
        </Surface>

        {/* ── KPI grid ───────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Users}     label="Roster"        value={snap.members}        sub={snap.invitesPending ? `${snap.invitesPending} INVITES PENDING` : 'ALL ACCEPTED'} loading={loading} />
          <MetricCard icon={Film}      label="Projects"      value={snap.projects}       sub="ORG-WIDE" loading={loading} />
          <MetricCard icon={ImageIcon} label="Brand assets"  value={snap.assets}         sub="SHARED LIBRARY" loading={loading} />
          <MetricCard icon={Zap}       label="Burn · 30d"    value={snap.creditsUsed30d} sub="CREDITS CONSUMED" loading={loading} accent />
        </section>

        {/* ── Brand snapshot + Quick actions ─────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Section
            icon={Palette}
            label="Brand integrity"
            sublabel="Palette enforced on every generation."
            className="lg:col-span-2"
            action={
              <button
                onClick={() => navigate('/workspace/brand')}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(215,100%,62%)] hover:text-[hsl(215,100%,72%)] transition"
              >
                EDIT BRAND →
              </button>
            }
          >
            {snap.brandColors.length === 0 ? (
              <p className="text-[12px] text-[hsl(220,8%,55%)] font-light">
                No brand palette defined. Outputs will use neutral defaults.
              </p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                {snap.brandColors.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,7%)]">
                    <span className="w-3 h-3 border border-[hsl(220,14%,22%)]" style={{ background: c }} />
                    <span className="font-mono text-[10px] text-[hsl(220,14%,72%)] uppercase">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section icon={Plus} label="Dispatch" sublabel="Common operations.">
            <div className="space-y-2">
              <CmdAction onClick={() => navigate('/workspace/team')}      icon={Users}     label="Invite member" />
              <CmdAction onClick={() => navigate('/workspace/assets')}    icon={Layers}    label="Upload asset" />
              <CmdAction onClick={() => navigate('/workspace/analytics')} icon={BarChart3} label="Open telemetry" />
              <CmdAction onClick={() => navigate('/create')}              icon={Plus}      label="New project" primary />
            </div>
          </Section>
        </section>
      </div>
    </WorkspaceLayout>
  );
}

interface CmdActionProps {
  onClick: () => void;
  icon: typeof Users;
  label: string;
  primary?: boolean;
}

const CmdAction = forwardRef<HTMLButtonElement, CmdActionProps>(
  ({ onClick, icon: Icon, label, primary }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2.5 transition-colors border',
        primary
          ? 'bg-[hsl(215,100%,55%)] text-[hsl(220,14%,4%)] hover:bg-[hsl(215,100%,62%)] border-[hsl(215,100%,55%)]'
          : 'bg-[hsl(220,14%,7%)] border-[hsl(220,14%,16%)] text-[hsl(220,14%,82%)] hover:bg-[hsl(220,14%,10%)] hover:border-[hsl(220,14%,22%)]'
      )}
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
        <span className="font-mono text-[11px] uppercase tracking-[0.20em]">{label}</span>
      </span>
      <span className="text-[10px] opacity-70">→</span>
    </button>
  )
);
CmdAction.displayName = 'CmdAction';

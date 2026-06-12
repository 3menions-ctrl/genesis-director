/**
 * WorkspaceBilling — beta-free version.
 *
 * Workspace plans are not for sale yet. This page surfaces usage stats and a
 * "talk to us about pricing" form that writes to support_messages.
 */

import { useEffect, useState } from 'react';
import { CreditCard, Send, Loader2, BadgeCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, CmdButton, DataInput, Pill } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

import { usePageMeta } from '@/hooks/usePageMeta';
interface OrgUsageStats {
  members: number;
  projects: number;
  creditsUsed30d: number;
}

export default function WorkspaceBilling() {
  usePageMeta({ title: "Workspace Billing — Small Bridges" });

  const { user } = useAuth();
  const { currentOrg, hasPermission } = useWorkspace();
  const canManage = hasPermission('admin');

  const [stats, setStats] = useState<OrgUsageStats>({ members: 0, projects: 0, creditsUsed30d: 0 });
  const [loading, setLoading] = useState(true);
  const [inquiryReason, setInquiryReason] = useState('');
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [m, p, c] = await Promise.all([
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id),
        supabase
          .from('movie_projects')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id),
        supabase
          .from('org_spend_events')
          .select('credits_amount')
          .eq('organization_id', currentOrg.id)
          .gte('created_at', since),
      ]);
      if (cancelled) return;
      setStats({
        members: m.count ?? 0,
        projects: p.count ?? 0,
        creditsUsed30d: (c.data ?? []).reduce(
          (s: number, r: { credits_amount?: number | null }) => s + (r.credits_amount ?? 0),
          0,
        ),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrg]);

  const submitInquiry = async () => {
    if (!user || !currentOrg) return;
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({
      user_id: user.id,
      name: user.email?.split('@')[0] ?? 'Small Bridges user',
      email: user.email ?? '',
      source: 'workspace_pricing',
      subject: `Workspace pricing inquiry — ${currentOrg.name}`,
      message:
        `Workspace pricing inquiry from ${currentOrg.name}.\n` +
        `Seats anticipated: ${seats || 'not specified'}\n` +
        `Members today: ${stats.members}\n` +
        `Projects: ${stats.projects}\n` +
        `Credits used last 30d: ${stats.creditsUsed30d}\n\n` +
        `Notes:\n${inquiryReason || '(none provided)'}`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? 'Could not send');
      return;
    }
    setSent(true);
    toast.success("We'll reply within one business day");
  };

  return (
    <WorkspacePage
      icon={CreditCard}
      eyebrow="Money · Beta"
      title="Billing"
      description="Workspace plans launch later. While Small Bridges is in beta, your team runs on hand-allocated credits."
      actions={<Pill tone="good">BETA · FREE</Pill>}
    >
      <Section icon={Sparkles} label="Usage at a glance" sublabel="Anchors for the conversation when paid plans go live.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UsageCard label="Members" value={stats.members} loading={loading} icon={Users} />
          <UsageCard label="Projects" value={stats.projects} loading={loading} icon={Sparkles} />
          <UsageCard label="Credits 30d" value={stats.creditsUsed30d} loading={loading} icon={CreditCard} />
        </div>
      </Section>

      <Section icon={CreditCard} label="Talk to us about pricing" sublabel="Tell us what your team needs — we'll grant beta credits or sketch a future plan that fits.">
        {sent ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.04] p-5 flex items-start gap-3">
            <BadgeCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
            <div>
              <div className="text-white text-[14px] mb-1">Got it.</div>
              <p className="text-white/65 text-[12px] leading-relaxed">
                We&rsquo;ll reach out within one business day with a proposal.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">Seats anticipated</span>
                <DataInput
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  placeholder="e.g. 12"
                  disabled={!canManage}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">Notes (optional)</span>
                <textarea
                  rows={4}
                  value={inquiryReason}
                  onChange={(e) => setInquiryReason(e.target.value)}
                  placeholder="What kind of output volume are you targeting? Any compliance asks?"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40 resize-none"
                  disabled={!canManage}
                />
              </label>
            </div>
            <div className="mt-5">
              <CmdButton variant="primary" disabled={!canManage || busy} onClick={submitInquiry}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send to billing
              </CmdButton>
            </div>
          </>
        )}
      </Section>

      <Section icon={Sparkles} label="What happens when paid plans launch?" sublabel="Plain answers.">
        <ul className="space-y-2.5 text-[13px] text-white/65 leading-relaxed">
          <li className="flex gap-3"><span className="text-primary mt-[7px] w-1 h-1 rounded-full bg-primary shrink-0" /> Anyone who signed up during beta keeps their work and their account.</li>
          <li className="flex gap-3"><span className="text-primary mt-[7px] w-1 h-1 rounded-full bg-primary shrink-0" /> We&rsquo;ll email at least 30 days before any paid plan turns on, and we&rsquo;ll tell you what stays free.</li>
          <li className="flex gap-3"><span className="text-primary mt-[7px] w-1 h-1 rounded-full bg-primary shrink-0" /> Workspace-tier features (audit log export, SSO, custom roles) ship together when paid plans launch.</li>
        </ul>
      </Section>
    </WorkspacePage>
  );
}

function UsageCard({
  label,
  value,
  loading,
  icon: Icon,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-3.5 h-3.5 text-primary/80" />
        <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40">{label}</span>
      </div>
      <div className="text-2xl font-light tabular-nums text-white">
        {loading ? <span className="text-white/20">…</span> : value.toLocaleString()}
      </div>
    </div>
  );
}

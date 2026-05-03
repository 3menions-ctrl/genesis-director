import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CreditCard, Receipt, Save, Loader2, Users, ExternalLink,
  Crown, Check, Sparkles,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import {
  Surface, Section, MetricCard, Field, CmdButton, DataInput, Pill,
} from '@/components/workspace/command-ui';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { cn } from '@/lib/utils';

const SEAT_LIMITS: Record<string, number> = {
  starter: 1, pro: 1, studio: 5, business: 15, enterprise: 999,
  business_starter: 5, business_growth: 15, business_scale: 50,
};

type Cycle = 'monthly' | 'yearly';

interface BusinessPlan {
  id: string;
  name: string;
  blurb: string;
  monthly: { price: number; priceId: string };
  yearly:  { price: number; priceId: string };
  seats: number;
  credits: number;
  popular?: boolean;
  features: string[];
}

const BUSINESS_PLANS: BusinessPlan[] = [
  {
    id: 'business_starter',
    name: 'STARTER',
    blurb: 'Small teams getting started.',
    monthly: { price: 99,  priceId: 'business_starter_monthly' },
    yearly:  { price: 990, priceId: 'business_starter_yearly'  },
    seats: 5, credits: 1000,
    features: ['5 seats', '1,000 monthly credits', 'Shared brand kit', 'Priority email support'],
  },
  {
    id: 'business_growth',
    name: 'GROWTH',
    blurb: 'Growing creative teams.',
    monthly: { price: 299,  priceId: 'business_growth_monthly' },
    yearly:  { price: 2990, priceId: 'business_growth_yearly'  },
    seats: 15, credits: 5000, popular: true,
    features: ['15 seats', '5,000 monthly credits', 'Brand kit + asset library', 'Team telemetry', 'Priority Slack support'],
  },
  {
    id: 'business_scale',
    name: 'SCALE',
    blurb: 'Studios and agencies at scale.',
    monthly: { price: 999,  priceId: 'business_scale_monthly' },
    yearly:  { price: 9990, priceId: 'business_scale_yearly'  },
    seats: 50, credits: 20000,
    features: ['50 seats', '20,000 monthly credits', 'Dedicated success manager', 'SSO available', 'Custom contracts'],
  },
];

export default function WorkspaceBilling() {
  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const navigate = useNavigate();
  const canEdit = hasPermission('admin');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const [vatId, setVatId] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [recentTxns, setRecentTxns] = useState<Array<{ id: string; amount: number; transaction_type: string; description: string | null; created_at: string }>>([]);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const seatLimit = useMemo(() => SEAT_LIMITS[currentOrg?.plan ?? 'starter'] ?? 1, [currentOrg?.plan]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [orgRes, memberRes, txnRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('billing_email, vat_id, credits_balance')
          .eq('id', currentOrg.id)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id),
        supabase
          .from('credit_transactions')
          .select('id, amount, transaction_type, description, created_at')
          .eq('user_id', currentOrg.created_by)
          .in('transaction_type', ['purchase', 'admin_grant', 'refund'])
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      setBillingEmail(orgRes.data?.billing_email ?? '');
      setVatId(orgRes.data?.vat_id ?? '');
      setCreditsBalance(orgRes.data?.credits_balance ?? 0);
      setMemberCount(memberRes.count ?? 0);
      setRecentTxns(txnRes.data ?? []);
    } catch (e: any) {
      console.error('[billing] load', e);
      toast.error('Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({
        billing_email: billingEmail || null,
        vat_id: vatId || null,
      })
      .eq('id', currentOrg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Billing details committed');
    void refresh();
  };

  const startCheckout = async (priceId: string) => {
    setCheckoutPriceId(priceId);
    setClientSecret(null);
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-plan-checkout', {
        body: {
          priceId,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/workspace/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if (error || !data?.clientSecret) throw new Error(error?.message || 'Failed to start checkout');
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to start checkout');
      setCheckoutPriceId(null);
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-6">
        {/* ── Account summary ───────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            icon={Crown}
            label="Active plan"
            value={(currentOrg?.plan ?? 'starter').toUpperCase().replace('_', ' ')}
            sub="BUSINESS TIER"
          />
          <MetricCard
            icon={Users}
            label="Seats"
            value={loading ? '—' : `${memberCount} / ${seatLimit}`}
            sub={memberCount >= seatLimit ? 'AT CAPACITY' : 'AVAILABLE'}
            warn={memberCount >= seatLimit}
          />
          <MetricCard
            icon={CreditCard}
            label="Credit reserve"
            value={loading ? '—' : creditsBalance.toLocaleString()}
            sub="WORKSPACE POOL"
            accent
            cta={canEdit ? { label: 'Top up', onClick: () => navigate('/pricing?tab=credits') } : undefined}
          />
        </section>

        {/* ── Plan picker ───────────────────────────────────── */}
        {canEdit && (
          <Section
            icon={Sparkles}
            label="Subscription tier"
            sublabel="Provision seats and monthly credit allotment. Upgrade or downgrade any time."
            action={
              <div className="inline-flex border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)]">
                {(['monthly', 'yearly'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    className={cn(
                      'px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.20em] transition-colors',
                      cycle === c
                        ? 'bg-[hsl(28,90%,55%)] text-[hsl(35,12%,4%)]'
                        : 'text-[hsl(35,8%,55%)] hover:text-[hsl(35,12%,92%)]'
                    )}
                  >
                    {c}{c === 'yearly' && <span className="ml-1.5 text-[hsl(28,90%,72%)]">−16%</span>}
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BUSINESS_PLANS.map(p => {
                const tier = cycle === 'monthly' ? p.monthly : p.yearly;
                const isCurrent = currentOrg?.plan === p.id;
                return (
                  <div key={p.id} className={cn(
                    'relative border p-5 flex flex-col bg-[hsl(35,12%,5%)]',
                    p.popular ? 'border-[hsl(28,90%,55%)]' : 'border-[hsl(35,12%,16%)]',
                  )}>
                    {p.popular && (
                      <span className="absolute top-0 right-0 px-2 py-0.5 bg-[hsl(28,90%,55%)] text-[hsl(35,12%,4%)] font-mono text-[9px] uppercase tracking-[0.22em]">
                        RECOMMENDED
                      </span>
                    )}
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(35,12%,98%)]">
                      {p.name}
                    </div>
                    <div className="text-[12px] text-[hsl(35,8%,55%)] mt-1 mb-5 font-light">{p.blurb}</div>
                    <div className="flex items-baseline gap-1.5 mb-5 pb-4 border-b border-[hsl(35,12%,12%)]">
                      <span className="font-display text-[34px] font-light text-[hsl(35,12%,98%)] tabular-nums">
                        ${tier.price}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,55%)]">
                        /{cycle === 'monthly' ? 'MO' : 'YR'}
                      </span>
                    </div>
                    <ul className="space-y-2 mb-5 flex-1">
                      {p.features.map(f => (
                        <li key={f} className="text-[12px] text-[hsl(35,12%,82%)] inline-flex items-start gap-2">
                          <Check className="w-3 h-3 text-[hsl(28,90%,62%)] mt-1 flex-shrink-0" strokeWidth={2.5} /> {f}
                        </li>
                      ))}
                    </ul>
                    <CmdButton
                      onClick={() => startCheckout(tier.priceId)}
                      disabled={isCurrent}
                      variant={p.popular ? 'primary' : 'ghost'}
                      className="w-full"
                    >
                      {isCurrent ? 'ACTIVE' : 'PROVISION'}
                    </CmdButton>
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,55%)] mt-5">
              Need more seats or custom contracts?{' '}
              <button
                onClick={() => navigate('/pricing#enterprise')}
                className="text-[hsl(28,90%,62%)] hover:text-[hsl(28,90%,72%)] underline-offset-4 hover:underline"
              >
                CONTACT ENTERPRISE →
              </button>
            </p>
          </Section>
        )}

        {/* ── Invoice details ───────────────────────────────── */}
        <Section
          icon={Receipt}
          label="Invoice details"
          sublabel="Imprinted on every invoice for this workspace."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Billing email" hint="Where invoices and receipts are sent.">
              <DataInput
                type="email"
                placeholder="ap@company.com"
                value={billingEmail}
                disabled={!canEdit}
                onChange={(e) => setBillingEmail(e.target.value)}
              />
            </Field>
            <Field label="VAT / Tax ID" hint="Shown on invoices for reverse-charge handling.">
              <DataInput
                placeholder="EU123456789"
                value={vatId}
                disabled={!canEdit}
                onChange={(e) => setVatId(e.target.value)}
              />
            </Field>
          </div>
          {canEdit && (
            <div className="mt-5 pt-4 border-t border-[hsl(35,12%,12%)]">
              <CmdButton onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Commit details
              </CmdButton>
            </div>
          )}
        </Section>

        {/* ── Activity ledger ───────────────────────────────── */}
        <Section
          icon={Receipt}
          label="Activity ledger"
          sublabel="Top-ups, plan changes, credits granted."
          action={
            <button
              onClick={() => navigate('/settings?tab=billing')}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(28,90%,62%)] hover:text-[hsl(28,90%,72%)] inline-flex items-center gap-1.5"
            >
              FULL HISTORY <ExternalLink className="w-3 h-3" />
            </button>
          }
        >
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-10 bg-[hsl(35,12%,7%)] animate-pulse" />)}
            </div>
          ) : recentTxns.length === 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(35,8%,55%)] py-6 text-center">
              No activity recorded.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(35,12%,12%)]">
              {recentTxns.map(t => (
                <li key={t.id} className="flex items-center justify-between py-3 px-2">
                  <div className="min-w-0 flex items-center gap-3">
                    <Pill tone={t.amount > 0 ? 'good' : 'neutral'}>
                      {t.transaction_type.toUpperCase()}
                    </Pill>
                    <div className="min-w-0">
                      <div className="text-[13px] text-[hsl(35,12%,82%)] truncate">
                        {t.description ?? t.transaction_type}
                      </div>
                      <div className="font-mono text-[10px] text-[hsl(35,8%,45%)] uppercase tracking-[0.16em]">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    'font-mono text-[13px] tabular-nums',
                    t.amount > 0 ? 'text-[hsl(140,70%,65%)]' : 'text-[hsl(35,12%,72%)]',
                  )}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Embedded checkout ─────────────────────────────── */}
      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => { if (!o) { setCheckoutPriceId(null); setClientSecret(null); } }}>
        <DialogContent className="max-w-2xl bg-[hsl(35,10%,4%)] border border-[hsl(35,12%,16%)] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Provision plan</DialogTitle>
          {loadingCheckout || !clientSecret ? (
            <div className="h-[480px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[hsl(28,90%,62%)] animate-spin" />
            </div>
          ) : (
            <div className="bg-white">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}

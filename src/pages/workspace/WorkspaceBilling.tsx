import { useEffect, useState, useCallback, useMemo } from 'react';
import { CreditCard, Receipt, Save, Loader2, Users, ExternalLink, Crown, ArrowUpRight } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SEAT_LIMITS: Record<string, number> = {
  starter: 1, pro: 1, studio: 5, business: 15, enterprise: 999,
};

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
        // Recent credit transactions for the org owner — proxy for billing history
        // until we wire org-level invoices to Stripe.
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
    toast.success('Billing details saved');
    void refresh();
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-7">
        {/* Plan + seats summary */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            label="Current plan"
            value={(currentOrg?.plan ?? 'starter').toUpperCase()}
            icon={Crown}
            cta={canEdit ? { label: 'Upgrade', onClick: () => navigate('/pricing') } : undefined}
          />
          <Stat
            label="Seats"
            value={loading ? '—' : `${memberCount} / ${seatLimit}`}
            icon={Users}
            warn={memberCount >= seatLimit}
          />
          <Stat
            label="Credits balance"
            value={loading ? '—' : creditsBalance.toLocaleString()}
            icon={CreditCard}
            cta={canEdit ? { label: 'Top up', onClick: () => navigate('/pricing?tab=credits') } : undefined}
          />
        </section>

        {/* Billing details */}
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
          <h3 className="text-[15px] font-medium text-white/95 mb-1">Billing details</h3>
          <p className="text-[12px] text-white/45 mb-5">Used on every invoice for this workspace.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Billing email" hint="Where invoices and receipts are sent.">
              <div className="relative">
                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                <Input
                  type="email"
                  placeholder="ap@company.com"
                  value={billingEmail}
                  disabled={!canEdit}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="VAT / Tax ID" hint="Shown on invoices for reverse-charge handling.">
              <Input
                placeholder="EU123456789"
                value={vatId}
                disabled={!canEdit}
                onChange={(e) => setVatId(e.target.value)}
              />
            </Field>
          </div>
          {canEdit && (
            <div className="mt-5">
              <Button onClick={save} disabled={saving} className="bg-[#0A84FF] hover:bg-[#0A84FF]/90">
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                Save details
              </Button>
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-medium text-white/95">Recent billing activity</h3>
              <p className="text-[12px] text-white/45">Top-ups, plan changes and credits granted.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings?tab=billing')} className="text-white/55">
              Full history <ExternalLink className="w-3 h-3 ml-1.5" />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />)}
            </div>
          ) : recentTxns.length === 0 ? (
            <p className="text-[12px] text-white/35 py-6 text-center">No billing activity yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {recentTxns.map(t => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-white/85 truncate">{t.description ?? t.transaction_type}</div>
                    <div className="text-[11px] text-white/40">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className={t.amount > 0 ? 'text-[13px] font-medium text-[#5AC8FA]' : 'text-[13px] font-medium text-white/65'}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount} credits
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}

function Stat({ label, value, icon: Icon, cta, warn }: {
  label: string; value: string; icon: typeof CreditCard;
  cta?: { label: string; onClick: () => void };
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>
        <Icon className="w-3.5 h-3.5 text-[#9DCBFF]" strokeWidth={1.5} />
      </div>
      <div className={warn ? 'mt-2 text-2xl font-display font-light text-[#FF9F0A]' : 'mt-2 text-2xl font-display font-light text-white'}>
        {value}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#9DCBFF] hover:text-white transition"
        >
          {cta.label} <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-white/35 mt-1.5">{hint}</span>}
    </label>
  );
}
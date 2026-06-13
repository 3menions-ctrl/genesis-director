/**
 * Credits — beta-free experience.
 *
 * Small Bridges is free during beta. There is no paid checkout flow today.
 * This page surfaces:
 *   1) The user's current credit balance + lifetime usage
 *   2) A "Request additional credits" form (writes to support_messages so
 *      we can manually top up power users while we're in beta)
 *   3) Recent credit transactions (uses existing credit_transactions table)
 *
 * The Stripe-driven version of this page is preserved in version control;
 * when paid plans return we can swap this back. Everything below this comment
 * runs without any payment processor.
 */

import { useEffect, useState } from 'react';
import { Sparkles, Send, History, BadgeCheck, ArrowUpRight, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSafeNavigation } from '@/lib/navigation';
import { toast } from 'sonner';
import { BetaHero, Stat, StatGrid } from '@/components/ui/BetaHero';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { Spinner } from '@/components/ui/Spinner';

interface CreditTransaction {
  id: string;
  amount: number;
  transaction_type: 'grant' | 'consume' | 'refund' | 'adjustment' | string;
  description: string | null;
  created_at: string;
}

export default function Credits() {
  usePageMeta({
    title: 'Credits — Small Bridges',
    description: 'See your current Small Bridges credit balance and request more during beta.',
  });

  const { user, profile } = useAuth();
  const { navigate } = useSafeNavigation();
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('200');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      const { data } = await supabase
        .from('credit_transactions')
        .select('id, amount, transaction_type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);
      if (!cancelled) {
        setHistory((data ?? []) as CreditTransaction[]);
        setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const balance = profile?.credits_balance ?? 0;
  const used = profile?.total_credits_used ?? 0;
  const purchased = profile?.total_credits_purchased ?? 0;

  const submitRequest = async () => {
    if (!user || !profile) return;
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 50 || amount > 5000) {
      toast.error('Pick an amount between 50 and 5,000 credits');
      return;
    }
    setRequestSubmitting(true);
    const { error } = await supabase.from('support_messages').insert({
      user_id: user.id,
      name: profile.display_name ?? profile.email?.split('@')[0] ?? 'Small Bridges user',
      email: profile.email ?? user.email ?? '',
      source: 'credits_request',
      subject: `Beta credit top-up — ${amount} credits`,
      message:
        `User requesting ${amount} additional credits while Small Bridges is in beta.\n` +
        `Current balance: ${balance}\n` +
        `Lifetime used: ${used}\n\n` +
        `Reason:\n${requestReason || '(none provided)'}`,
    });
    setRequestSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Could not send request');
      return;
    }
    setRequestSent(true);
    toast.success("Request sent — we'll reply within one business day");
  };

  return (
    <div className="text-white">
      <div className="max-w-[1280px] mx-auto px-6 pt-16 pb-24 space-y-10">
        <BetaHero
          eyebrow="Small Bridges"
          title={<>Small Bridges is free while we&rsquo;re in beta.</>}
          body={
            <>You don&rsquo;t pay for anything yet. Generate, edit, and ship — we&rsquo;ll let you know when paid plans go live, well in advance.</>
          }
          rail={
            <StatGrid>
              <Stat label="Balance" value={balance.toLocaleString()} tone="blue" />
              <Stat label="Used" value={used.toLocaleString()} tone="emerald" />
              <Stat label="Granted" value={purchased.toLocaleString()} tone="neutral" />
            </StatGrid>
          }
        />

        {/* Request more credits — floating, no container */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-4 h-4 text-primary/80" />
            <h2 className="text-[18px] text-white font-display font-light">
              Need more credits?
            </h2>
          </div>
          {requestSent ? (
            <div className="flex items-start gap-4 py-2">
              <BadgeCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
              <div>
                <div className="text-white text-[14px] mb-1">Request received</div>
                <p className="text-white/65 text-[13px] leading-relaxed max-w-2xl">
                  We&rsquo;ll review and reply within one business day. In the meantime keep building — refunds for failed generations land back in your balance automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-white/55 text-[13px] mb-5 leading-relaxed max-w-2xl">
                During beta we hand-allocate credits to power users. Tell us how many you need and what you&rsquo;re building, and we&rsquo;ll top you up.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 max-w-3xl">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
                    Credits requested
                  </span>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    step={50}
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="ds-input mt-1 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
                    What are you building? (optional)
                  </span>
                  <textarea
                    rows={3}
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="A short product video for a launch on Friday…"
                    className="ds-input mt-1 resize-none"
                  />
                </label>
              </div>
              <div className="mt-6">
                <PrimaryCTA
                  size="lg"
                  loading={requestSubmitting}
                  onClick={submitRequest}
                  icon={Send}
                >
                  Send request
                </PrimaryCTA>
              </div>
            </>
          )}
        </section>

        {/* CTA back to creation — floating */}
        <section className="flex items-center justify-between gap-6 py-2">
          <div>
            <div className="text-white text-[16px] font-display mb-1">
              Ready to make something?
            </div>
            <p className="text-white/55 text-[13px]">
              Open the studio — your balance is debited only when a render completes successfully.
            </p>
          </div>
          <button
            onClick={() => navigate('/create')}
            className="group/cta inline-flex items-center gap-2 text-[13px] text-white/85 hover:text-white transition-colors"
          >
            <Wand2 className="w-4 h-4 text-accent" strokeWidth={1.5} />
            <span className="relative">
              Open studio
              <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/cta:scale-x-100" />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" strokeWidth={1.5} />
          </button>
        </section>

        {/* Usage history — floating, no card */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <History className="w-4 h-4 text-white/55" />
            <h2 className="text-[15px] text-white font-display font-light">
              Recent credit activity
            </h2>
          </div>
          {loadingHistory ? (
            <div className="py-8 flex items-center text-white/40 gap-2">
              <Spinner size="sm" tone="muted" />
              <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-white/45">
              <p className="text-[14px] font-display mb-2">No activity yet</p>
              <p className="text-[12px] text-white/35">
                Once you generate your first clip, your credit ledger appears here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">When</th>
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Type</th>
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Description</th>
                    <th className="py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.03]">
                      <td className="py-3 pr-6 text-white/55 font-mono text-[11px] whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-6">
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary/80">
                          {t.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 pr-6 text-white/75">{t.description ?? '—'}</td>
                      <td
                        className={`py-3 text-right font-mono tabular-nums ${
                          t.amount > 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {t.amount > 0 ? '+' : ''}
                        {t.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Local Stat shim retained for backwards-compat with older imports; the
// canonical Stat lives in `BetaHero.tsx` and is what's used in the hero rail.
// Kept private (un-exported) so nothing new accidentally consumes it.
function _UnusedLocalStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'neutral';
}) {
  const toneClass =
    tone === 'blue'
      ? 'text-primary/80'
      : tone === 'emerald'
        ? 'text-emerald-300'
        : 'text-white';
  return (
    <div>
      <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.32em] mb-2">
        {label}
      </div>
      <div className={`text-3xl font-display font-light tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Credits — live experience.
 *
 * Small Bridges is free to start (first 5-sec video on Wan). Paid checkout IS
 * live: one-time credit packs and monthly subscriptions both run through the
 * configured payment provider (Polar) via startCreditCheckout /
 * provider.createSubscriptionCheckout below.
 *
 * This page surfaces:
 *   1) The user's current credit balance + lifetime usage
 *   2) One-time credit packs + monthly subscription plans (paid checkout)
 *   3) Recent credit transactions (uses the credit_transactions table)
 *
 * (AUDIT FIX L-10: prior header claimed "no paid checkout flow today" /
 * "runs without any payment processor", which contradicted the live code.)
 */

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, History, ArrowUpRight, Wand2, Coins, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { supabase } from '@/integrations/supabase/client';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSafeNavigation } from '@/lib/navigation';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { CREDIT_PACKAGES, approxClips, startCreditCheckout, type CreditPackage } from '@/lib/payments/creditPackages';

/** Recurring monthly plans — priceId is the planLookupKey the backend
 *  resolves to POLAR_PRODUCT_<KEY>. Authoritative price lives in Polar. */
const SUBSCRIPTION_PLANS: ReadonlyArray<{
  key: string; name: string; price: number; credits: number; blurb: string; popular?: boolean;
}> = [
  { key: 'sub_creator_monthly', name: 'Indie',  price: 19,  credits: 220,  blurb: 'For solo creators shipping monthly.' },
  { key: 'sub_pro_monthly',     name: 'Pro',    price: 49,  credits: 600,  blurb: 'For creators publishing every week.', popular: true },
  { key: 'sub_studio_monthly',  name: 'Studio', price: 149, credits: 2000, blurb: 'For teams and studios at scale.' },
];

interface CreditTransaction {
  id: string;
  amount: number;
  transaction_type: 'grant' | 'consume' | 'refund' | 'adjustment' | string;
  description: string | null;
  created_at: string;
}

/** Orb — a credit pack OR a subscription plan as a large glossy glass circle
 *  (pricing-page language): a credit-volume ring around a translucent sphere,
 *  price + credits inside; the whole orb is the buy/subscribe action. */
function Orb({ name, price, credits, popular, busy, disabled, onSelect, priceSuffix, creditsLabel = 'credits', ctaLabel = 'Buy' }: {
  name: string; price: number; credits: number; popular?: boolean; busy: boolean; disabled: boolean; onSelect: () => void;
  priceSuffix?: string; creditsLabel?: string; ctaLabel?: string;
}) {
  const min = Math.log(90), max = Math.log(75000);
  const ratio = Math.min(1, Math.max(0.2, (Math.log(Math.max(credits, 90)) - min) / (max - min)));
  const deg = Math.round(ratio * 360);
  const size = popular
    ? 'h-[clamp(17rem,28vw,22rem)] w-[clamp(17rem,28vw,22rem)]'
    : 'h-[clamp(15rem,23vw,18.5rem)] w-[clamp(15rem,23vw,18.5rem)]';
  return (
    <button type="button" onClick={onSelect} disabled={disabled} className="group relative flex flex-col items-center outline-none disabled:opacity-60">
      <div aria-hidden className={cn('pointer-events-none absolute -inset-6 rounded-full blur-3xl transition-opacity duration-500', popular ? 'opacity-80' : 'opacity-40 group-hover:opacity-70')} style={{ background: 'radial-gradient(closest-side, hsl(var(--accent) / 0.42), transparent 70%)' }} />
      <div
        className={cn('relative flex flex-col items-center justify-center rounded-full text-center transition-transform duration-300 group-hover:-translate-y-1.5', size)}
        style={{
          background: 'radial-gradient(120% 120% at 50% 20%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 55%, rgba(8,10,18,0.55))',
          boxShadow: popular
            ? '0 50px 130px -34px hsl(var(--accent) / 0.6), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -40px 74px -34px hsl(var(--accent) / 0.5)'
            : '0 38px 104px -44px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -34px 64px -34px hsl(var(--accent) / 0.38)',
        }}
      >
        <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from -90deg, hsl(var(--accent)) 0deg, hsl(var(--accent) / 0.85) ${deg * 0.5}deg, hsl(var(--accent) / 0.5) ${deg}deg, rgba(255,255,255,0.06) ${deg}deg 360deg)`, padding: '3px', WebkitMask: 'radial-gradient(circle, transparent calc(100% - 4px), #000 calc(100% - 3px))', mask: 'radial-gradient(circle, transparent calc(100% - 4px), #000 calc(100% - 3px))' }} />
        <div className="relative z-10 flex flex-col items-center px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em]" style={{ color: 'hsl(var(--accent))' }}>{name}</span>
          <div className="mt-2 flex items-baseline gap-0.5">
            <span className="text-[15px] text-white/50">$</span>
            <span className={cn('font-display font-semibold leading-none tracking-[-0.02em] tabular-nums text-white', popular ? 'text-[clamp(3.4rem,6.4vw,4.6rem)]' : 'text-[clamp(2.8rem,5.2vw,3.6rem)]')}>{price.toLocaleString()}</span>
            {priceSuffix && <span className="text-[13px] text-white/45">{priceSuffix}</span>}
          </div>
          <span className="mt-2 text-[13px] tabular-nums text-white/70">{credits.toLocaleString()} {creditsLabel}</span>
          <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">~{approxClips(credits)} clips</span>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/[0.1] px-5 py-2 text-[13px] font-semibold text-white transition-colors group-hover:bg-white/[0.16]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {ctaLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Credits() {
  usePageMeta({
    title: 'Credits — Small Bridges',
    description: 'See your current Small Bridges credit balance and top up anytime.',
  });

  const { user, profile, refreshProfile } = useAuth();
  const { navigate } = useSafeNavigation();
  const credits = useCredits();
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);

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

  // Handle the return from Stripe Checkout. Credits are granted
  // server-side by the payments webhook; here we just confirm + refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!payment) return;
    if (payment === 'success') {
      toast.success('Payment complete — your credits have been added.');
      void refreshProfile();
      void credits.reconcile();
    } else if (payment === 'cancelled') {
      toast.info('Checkout cancelled — no charge was made.');
    }
    params.delete('payment');
    params.delete('credits');
    params.delete('session_id');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    // Run once on mount; refreshProfile/credits are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUDIT FIX L-4: show the authoritative spendable balance (available =
  // ledger balance − active holds) from useCredits, not the profiles
  // credits_balance display cache, which can overstate while renders hold
  // credits or before reconciliation. Fall back to the cache only until the
  // credit state loads.
  // Show the authoritative available (ledger − holds) once loaded — including a
  // legitimate 0 (spent down / fully held). Fall back to the profile cache only
  // while the credit state is still loading. (Was `||`, which also fell back on
  // a real 0 and re-showed the too-high cache.)
  const balance = credits.loading ? (profile?.credits_balance ?? 0) : credits.available;
  const used = profile?.total_credits_used ?? 0;
  const purchased = profile?.total_credits_purchased ?? 0;

  const buy = async (pkg: CreditPackage) => {
    if (!user) { navigate('/auth'); return; }
    if (buying || subscribing) return;
    setBuying(pkg.id);
    try {
      await startCreditCheckout(pkg.id); // redirects on success
    } catch (e) {
      setBuying(null);
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
    }
  };

  const subscribe = async (planKey: string) => {
    if (!user) { navigate('/auth'); return; }
    if (buying || subscribing) return;
    setSubscribing(planKey);
    try {
      const { getPaymentsProvider } = await import('@/lib/payments');
      const provider = await getPaymentsProvider();
      const session = await provider.createSubscriptionCheckout({
        priceId: planKey,
        kind: 'personal',
        returnUrl: `${window.location.origin}/credits?payment=success`,
      });
      window.location.href = session.url; // redirect to the active provider
    } catch (e) {
      setSubscribing(null);
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
    }
  };

  return (
    <div className="text-white">
      {/* The molten-orange backdrop is rendered by the Account page (non-lazy)
          so it paints instantly on navigation — see Account.tsx. */}
      <div className="relative z-10 max-w-[1180px] mx-auto px-6 pt-16 pb-24 space-y-16">
        {/* HERO — floating typography, animated balance counter, sparkline */}
        <CreditsHero
          balance={balance}
          used={used}
          purchased={purchased}
          history={history}
        />

        {/* Buy credits — package cards → Stripe checkout */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-4 h-4 text-primary/80" />
            <h2 className="text-[18px] text-white font-display font-light">
              Buy more credits
            </h2>
          </div>
          <p className="text-white/55 text-[13px] mb-8 leading-relaxed max-w-2xl">
            One-time top-ups — credits never expire, and refunds for failed renders land back in your balance automatically. Prefer a monthly plan? See subscriptions below. Secure checkout via Polar.
          </p>

          {/* Personal — regular creator packs */}
          <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.28em] text-white/40">For creators</div>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-16 py-8">
            {CREDIT_PACKAGES.filter((p) => p.tier !== 'business').map((pkg) => (
              <Orb key={pkg.id} name={pkg.name} price={pkg.price} credits={pkg.credits} popular={pkg.popular} busy={buying === pkg.id} disabled={!!buying} onSelect={() => buy(pkg)} ctaLabel="Buy" />
            ))}
          </div>

          {/* Business — higher-volume team/agency packs.
              AUDIT FIX M-1: account type is mutually exclusive (personal vs
              business). This personal /credits surface previously rendered the
              business packs unconditionally; gate them so only business/
              enterprise accounts ever see them.
              Presentation kept on main's borderless language (no border-t). */}
          {(profile?.account_type === 'business' || profile?.account_type === 'enterprise') && (
            <div className="mt-12 pt-10">
              <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.28em]" style={{ color: 'hsl(var(--accent))' }}>For teams &amp; business</div>
              <p className="text-white/45 text-[12px] mb-2 max-w-2xl">Higher-volume one-time packs for studios and agencies.</p>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-16 py-8">
                {CREDIT_PACKAGES.filter((p) => p.tier === 'business').map((pkg) => (
                  <Orb key={pkg.id} name={pkg.name} price={pkg.price} credits={pkg.credits} popular={pkg.popular} busy={buying === pkg.id} disabled={!!buying} onSelect={() => buy(pkg)} ctaLabel="Buy" />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Subscriptions — recurring monthly plans (Polar) */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Coins className="w-4 h-4 text-accent/80" />
            <h2 className="text-[18px] text-white font-display font-light">
              Monthly plans
            </h2>
          </div>
          <p className="text-white/55 text-[13px] mb-6 leading-relaxed max-w-2xl">
            A fresh credit grant every month — best value if you create regularly. Cancel anytime; manage your plan from the billing portal.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-16 py-8">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Orb
                key={plan.key}
                name={plan.name}
                price={plan.price}
                credits={plan.credits}
                popular={plan.popular}
                busy={subscribing === plan.key}
                disabled={!!buying || !!subscribing}
                onSelect={() => subscribe(plan.key)}
                priceSuffix="/mo"
                creditsLabel="credits / mo"
                ctaLabel="Subscribe"
              />
            ))}
          </div>
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
                  <tr>
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">When</th>
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Type</th>
                    <th className="py-3 pr-6 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Description</th>
                    <th className="py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
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

// ─────────────────────────────────────────────────────────────────────────────
// CreditsHero — floating hero. Big animated balance, sparkline of 30-day
// activity, three floating stats. No card, no border, no glass.
// ─────────────────────────────────────────────────────────────────────────────
function CreditsHero({
  balance,
  used,
  purchased,
  history,
}: {
  balance: number;
  used: number;
  purchased: number;
  history: CreditTransaction[];
}) {
  const animBalance = useAnimatedNumber(balance);
  // Aggregate last 30 days of activity into a per-day net delta and
  // turn it into a tiny sparkline of cumulative balance over time.
  const spark = useMemo(() => buildSparkline(history, 30, balance), [history, balance]);

  return (
    <section>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">
        <span>◆ Treasury</span>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-10 items-end">
        <div>
          <h1
            className="font-display italic font-light tracking-tight leading-[0.95]"
            style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2.6rem, 5vw, 4.2rem)" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Your credits.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] font-light leading-relaxed text-muted-foreground/70">
            Generate, edit, and ship — every credit you spend is tracked here, and every refund for a failed render lands back in your balance automatically.
          </p>
        </div>

        {/* Balance — huge floating number with the sparkline running underneath */}
        <div className="lg:text-right">
          <div className="flex items-center gap-2 lg:justify-end text-[10px] uppercase tracking-[0.32em] text-accent/80 font-mono">
            <Coins className="h-3 w-3" strokeWidth={1.5} />
            <span>Balance</span>
          </div>
          <div
            className="mt-2 font-display italic font-light tabular-nums leading-[0.95]"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(3.6rem, 7vw, 6rem)",
              textShadow: "0 4px 30px hsl(var(--accent) / 0.30)",
            }}
          >
            {animBalance.toLocaleString()}
          </div>
          {spark.points.length > 1 && (
            <div className="mt-3 lg:flex lg:justify-end">
              <Sparkline points={spark.points} accent />
            </div>
          )}
        </div>
      </div>

      {/* Three floating sub-stats below */}
      <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6">
        <FloatingNumber label="Lifetime used" value={used} tone="emerald" />
        <FloatingNumber label="Lifetime granted" value={purchased} />
        <FloatingNumber label="Last 30 days" value={spark.spent} tone="rose" sub={`${spark.activeDays}/30 active days`} />
      </div>
    </section>
  );
}

function FloatingNumber({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'rose' | 'neutral';
  sub?: string;
}) {
  const v = useAnimatedNumber(value);
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'rose'
        ? 'text-rose-300'
        : 'text-foreground/95';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 font-mono">{label}</div>
      <div
        className={cn('mt-2 font-display italic font-light tabular-nums leading-[0.95]', toneClass)}
        style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 3vw, 2.4rem)" }}
      >
        {v.toLocaleString()}
      </div>
      {sub && <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50 font-mono">{sub}</div>}
    </div>
  );
}

// Inline SVG sparkline — accent-coloured polyline with a soft area fill
// under it. No axes, no labels, just a gesture of motion.
function Sparkline({ points, accent }: { points: Array<[number, number]>; accent?: boolean }) {
  const W = 220;
  const H = 56;
  if (points.length < 2) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const nx = (x: number) => ((x - xMin) / xRange) * (W - 4) + 2;
  const ny = (y: number) => H - 4 - ((y - yMin) / yRange) * (H - 8);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${nx(p[0]).toFixed(1)} ${ny(p[1]).toFixed(1)}`).join(' ');
  const area = `${path} L ${nx(xs[xs.length - 1]).toFixed(1)} ${H - 2} L ${nx(xs[0]).toFixed(1)} ${H - 2} Z`;
  const stroke = accent ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.6)';
  const fillId = accent ? 'spark-fill-accent' : 'spark-fill-mute';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="inline-block">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent ? 'hsl(var(--accent))' : 'hsl(var(--foreground))'} stopOpacity={0.25} />
          <stop offset="100%" stopColor={accent ? 'hsl(var(--accent))' : 'hsl(var(--foreground))'} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Final dot — the "you are here" punch */}
      <circle
        cx={nx(xs[xs.length - 1])}
        cy={ny(ys[ys.length - 1])}
        r={2.5}
        fill={stroke}
      />
    </svg>
  );
}

// useAnimatedNumber — ease-out cubic from 0 to target over ~900ms.
function useAnimatedNumber(target: number) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

/**
 * buildSparkline — given the last N days of credit_transactions and the
 * current balance, produce a cumulative-balance line going BACKWARD from
 * today (so the rightmost point is today's balance). Also returns total
 * credits spent in the window and the number of days that had activity.
 */
function buildSparkline(
  history: CreditTransaction[],
  days: number,
  currentBalance: number,
): { points: Array<[number, number]>; spent: number; activeDays: number } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  const buckets: number[] = new Array(days).fill(0); // net change per day, oldest → newest
  let spent = 0;
  const activeDaysSet = new Set<string>();
  for (const t of history) {
    const created = new Date(t.created_at);
    const diff = Math.floor((now.getTime() - created.setHours(0, 0, 0, 0)) / dayMs);
    if (diff < 0 || diff >= days) continue;
    const idx = days - 1 - diff; // newest at the end
    buckets[idx] += t.amount;
    if (t.amount < 0) spent += -t.amount;
    activeDaysSet.add(created.toISOString().slice(0, 10));
  }
  // Reconstruct daily balance by walking back from today's balance.
  // balance[i] = balance[i+1] - net_change_on_day(i+1)
  const balances: number[] = new Array(days).fill(0);
  balances[days - 1] = currentBalance;
  for (let i = days - 2; i >= 0; i--) {
    balances[i] = balances[i + 1] - buckets[i + 1];
  }
  const points: Array<[number, number]> = balances.map((b, i) => [i, b]);
  return { points, spent, activeDays: activeDaysSet.size };
}

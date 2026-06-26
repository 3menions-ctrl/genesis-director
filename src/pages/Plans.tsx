/**
 * Plans — a VIEW-ONLY pricing screen for iOS. Shows the credit packs + benefits
 * but never charges in-app (Apple 3.1.1 / spend-only): "Manage on the web" opens
 * smallbridges.co in the system browser. No StoreKit, no in-app purchase.
 */
import { ChevronLeft, Check, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '@/contexts/CreditsContext';
import { CREDIT_PACKAGES, approxClips } from '@/lib/payments/creditPackages';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { cn } from '@/lib/utils';

const PACKS = CREDIT_PACKAGES.filter((p) => p.tier === 'personal');
const PERKS = ['Text, image & avatar generation', 'One-tap remix of any film', 'Preset looks & editor', 'Credits never expire'];

export default function Plans() {
  const navigate = useNavigate();
  const { available } = useCredits();

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">Plans &amp; credits</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>
        {/* Balance */}
        <div className="msg-glass-accent mt-3 flex items-center gap-3 rounded-[20px] px-5 py-4">
          <Sparkles className="h-6 w-6 text-white" />
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">Your balance</div>
            <div className="font-display text-[22px] font-bold leading-tight">◇ {available.toLocaleString()} credits</div>
          </div>
        </div>

        {/* Packs */}
        <div className="mt-6 space-y-3">
          {PACKS.map((p) => (
            <div key={p.id} className={cn('relative rounded-[20px] px-5 py-4', p.popular ? 'msg-glass-accent' : 'msg-glass')}>
              {p.popular && <span className="absolute -top-2 right-4 rounded-full bg-[#8fb4ff] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#0a0a0f]">Most popular</span>}
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[18px] font-bold">{p.name}</span>
                <span className="font-display text-[18px] font-bold">${p.price}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-white/70">
                <span className="text-[#8fb4ff]">◇ {p.credits.toLocaleString()} credits</span>
                <span className="text-white/35">·</span>
                <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />≈ {approxClips(p.credits)} clips</span>
              </div>
              <div className="mt-1 text-[12.5px] text-white/45">{p.blurb}</div>
            </div>
          ))}
        </div>

        {/* Perks */}
        <div className="mt-7">
          <div className="mb-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Every plan includes</div>
          <div className="msg-glass space-y-2.5 rounded-[20px] px-5 py-4">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-2.5 text-[13.5px] text-white/85"><Check className="h-[15px] w-[15px] shrink-0 text-[#5ee08a]" />{perk}</div>
            ))}
          </div>
        </div>

        {/* Apple 3.1.1 / IOS_SETUP.md §5: spend-only — a NEUTRAL notice only, with
            NO link out to the web checkout. (Was a tappable "Manage plan on the
            web" Browser.open button → that steered to external purchase, the exact
            pattern 3.1.1 rejects; removed to match the documented policy.) */}
        <p className="mt-6 px-2 text-center text-[12.5px] leading-relaxed text-white/40">Credits are purchased and managed on smallbridges.co. The app uses your balance to create — there's nothing to buy in-app.</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { PURCHASING_ENABLED } from '@/lib/native/purchases';
import { cn } from '@/lib/utils';

interface CreditLowInlineProps {
  /** User's current credit balance. */
  balance: number;
  /** Estimated credit cost of the next generation. */
  required: number;
  /** Optional className for outer container. */
  className?: string;
  /** Optional label shown before the deficit number (e.g. "Training video"). */
  context?: string;
}

/**
 * Inline credit-low upsell — surfaced at script-review / pre-generate points.
 * Renders nothing when the balance is comfortable; otherwise shows a
 * cinematic warning strip with a one-tap "Buy credits" CTA.
 *
 * Two states:
 *  - `insufficient` (balance < required) → blocking-tone amber strip.
 *  - `running-low`  (balance < required * 2, within 20cr) → soft hint.
 */
export function CreditLowInline({ balance, required, className, context }: CreditLowInlineProps) {
  const [open, setOpen] = useState(false);

  if (required <= 0) return null;
  const deficit = Math.max(0, required - balance);
  const insufficient = deficit > 0;
  const runningLow = !insufficient && balance < required * 2 && balance - required <= 20;
  if (!insufficient && !runningLow) return null;

  const tone = insufficient
    ? 'border-amber-500/40 bg-amber-500/[0.06] text-amber-200'
    : 'border-white/10 bg-glass text-white/80';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm',
          tone,
          className,
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            insufficient ? 'bg-amber-500/20' : 'bg-glass-active',
          )}
        >
          {insufficient ? <Coins className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          {insufficient ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.14em]">
              {deficit} credits short {context ? `for ${context}` : 'for this generation'} ·{' '}
              <span className="opacity-70">Balance {balance} / Need {required}</span>
            </div>
          ) : (
            <div className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Credits running low — {Math.max(0, balance - required)} left after this {context || 'generation'} costs {required}
            </div>
          )}
        </div>
        {/* Top-up CTA hidden in the iOS spend-only shell (Apple 3.1.1); the
            deficit message above still informs the user. */}
        {PURCHASING_ENABLED && (
          <Button
            size="sm"
            variant={insufficient ? 'default' : 'outline'}
            onClick={() => setOpen(true)}
            className={cn(
              'h-8 shrink-0 rounded-lg px-3 font-mono text-[10px] uppercase tracking-[0.16em]',
              insufficient
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'border-white/15 bg-transparent text-white/85 hover:bg-glass-hover',
            )}
          >
            Top up <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </motion.div>
      <BuyCreditsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
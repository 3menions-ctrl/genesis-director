import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuyCreditsModal } from './BuyCreditsModal';
import { cn } from '@/lib/utils';

interface PostGenerationUpsellProps {
  creditsRemaining: number;
  projectTitle?: string;
  onDismiss: () => void;
  visible: boolean;
}

/**
 * Shows after a video generation completes to encourage more purchases.
 * Contextual messaging based on remaining credits.
 */
export const PostGenerationUpsell = memo(function PostGenerationUpsell({
  creditsRemaining,
  projectTitle,
  onDismiss,
  visible,
}: PostGenerationUpsellProps) {
  const [showBuyModal, setShowBuyModal] = useState(false);

  const getMessage = () => {
    if (creditsRemaining === 0) {
      return {
        title: "Great work! You're out of credits",
        subtitle: 'Top up to keep the momentum going.',
        cta: 'Get Credits Now',
        urgency: 'high' as const,
      };
    }
    if (creditsRemaining <= 10) {
      return {
        title: 'Almost there!',
        subtitle: `Only ${creditsRemaining} credits left — enough for ~${Math.floor(creditsRemaining / 10)} more clip${creditsRemaining >= 20 ? 's' : ''}.`,
        cta: 'Stock Up',
        urgency: 'medium' as const,
      };
    }
    return {
      title: 'Video complete! 🎬',
      subtitle: "Loved the result? Create even more with bonus credits.",
      cta: 'Get More Credits',
      urgency: 'low' as const,
    };
  };

  const msg = getMessage();

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={cn(
              "fixed bottom-6 right-6 z-50 max-w-sm w-full rounded-2xl border p-5 shadow-2xl backdrop-blur-xl",
              msg.urgency === 'high'
                ? "bg-gradient-to-br from-amber-950/90 to-black/90 border-amber-500/20"
                : "bg-black/90 border-white/10"
            )}
          >
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/50" />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                msg.urgency === 'high' ? "bg-amber-500/20" : "bg-white/5"
              )}>
                <Film className={cn("w-5 h-5", msg.urgency === 'high' ? "text-amber-400" : "text-white/60")} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{msg.title}</h4>
                <p className="text-xs text-white/40 mt-0.5">{msg.subtitle}</p>
              </div>
            </div>

            <Button
              onClick={() => setShowBuyModal(true)}
              className={cn(
                "w-full h-10 rounded-full text-sm font-medium gap-2",
                msg.urgency === 'high'
                  ? "bg-amber-500 hover:bg-amber-400 text-black"
                  : "bg-white hover:bg-white/90 text-black"
              )}
            >
              <Sparkles className="w-4 h-4" />
              {msg.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <BuyCreditsModal
        open={showBuyModal}
        onOpenChange={setShowBuyModal}
      />
    </>
  );
});

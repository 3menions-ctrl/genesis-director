import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ExitIntentPopupProps {
  enabled?: boolean;
}

export default function ExitIntentPopup({ enabled = true }: ExitIntentPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const navigate = useNavigate();

  const handleExitIntent = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves viewport from top
    if (e.clientY <= 0 && !hasShown && enabled) {
      setIsOpen(true);
      setHasShown(true);
      // Store in session so it doesn't show again this session
      sessionStorage.setItem('exitIntentShown', 'true');
    }
  }, [hasShown, enabled]);

  useEffect(() => {
    // Check if already shown this session
    if (sessionStorage.getItem('exitIntentShown')) {
      setHasShown(true);
      return;
    }

    // Wait 5 seconds before enabling exit intent
    const timeout = setTimeout(() => {
      document.addEventListener('mouseout', handleExitIntent);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mouseout', handleExitIntent);
    };
  }, [handleExitIntent]);

  const handleClose = () => setIsOpen(false);

  const handleClaim = () => {
    setIsOpen(false);
    navigate('/auth?mode=signup');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
          >
            <div className="relative bg-background rounded-3xl shadow-2xl overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Gradient top */}
              <div className="h-32 bg-gradient-to-br from-violet-500 via-purple-500 to-violet-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent)]" />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30"
                  >
                    <Gift className="w-8 h-8 text-white" />
                  </motion.div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 text-center">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Wait! Don't miss out
                </h3>
                <p className="text-muted-foreground mb-6">
                  Get <span className="font-bold text-foreground">60 free credits</span> — enough to create your first AI video. No credit card required.
                </p>

                {/* Urgency badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 mb-6">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">Limited time offer</span>
                </div>

                {/* CTA buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handleClaim}
                    size="lg"
                    className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-xl"
                  >
                    Claim My Free Credits
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <button
                    onClick={handleClose}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    No thanks, I'll pass on free credits
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

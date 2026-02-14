import { memo, forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Maximize2, X } from 'lucide-react';
import { UniversalHLSPlayer, type UniversalHLSPlayerHandle } from '@/components/player/UniversalHLSPlayer';

const PRICING_STATS = [
  { value: '$0.10', label: 'per credit' },
  { value: '10-15', label: 'credits/clip' },
  { value: '∞', label: 'no expiry' },
] as const;

const STORYTELLING_HLS_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/temp-frames/hls_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c_1771087015077.m3u8';

interface PricingSectionProps {
  onNavigate: (path: string) => void;
}

// Immersive background overlay that renders the HLS video fullscreen
const ImmersiveVideoBackground = memo(function ImmersiveVideoBackground({ onClose }: { onClose: () => void }) {
  const playerRef = useRef<UniversalHLSPlayerHandle>(null);

  // Escape key to exit - using document-level capture phase
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2] animate-fade-in" style={{ animationDuration: '1.2s', pointerEvents: 'none' }}>
      {/* Fullscreen HLS video */}
      <div className="absolute inset-0 [&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full [&>div]:!w-full [&>div]:!h-full">
        <UniversalHLSPlayer
          ref={playerRef}
          hlsUrl={STORYTELLING_HLS_URL}
          className="w-full h-full"
          showControls={false}
          autoPlay={true}
          loop={true}
          aspectRatio="auto"
        />
      </div>
      
      {/* Dark gradient overlay for content readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/65" />
      
      {/* Floating close button - fixed position, fully interactive */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="fixed top-20 right-6 z-[60] group flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 hover:bg-white/15 hover:border-white/30 transition-all duration-300 animate-fade-in"
        style={{ pointerEvents: 'auto', animationDelay: '0.6s' }}
        aria-label="Exit immersive mode"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] text-white/70 group-hover:text-white font-medium tracking-[0.08em] uppercase transition-colors">Exit Immersive</span>
        <X className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
      </button>
    </div>
  );
});

export const PricingSection = memo(forwardRef<HTMLElement, PricingSectionProps>(
  function PricingSection({ onNavigate }, ref) {
    const [isImmersive, setIsImmersive] = useState(false);

    const handleEnterImmersive = useCallback(() => {
      setIsImmersive(true);
    }, []);

    const handleExitImmersive = useCallback(() => {
      setIsImmersive(false);
    }, []);

    return (
      <>
        {/* Immersive fullscreen background */}
        {isImmersive && (
          <ImmersiveVideoBackground onClose={handleExitImmersive} />
        )}

        <section ref={ref} id="pricing" className="relative z-10 py-24 px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-5xl mx-auto"
          >
            {/* Video Showcase */}
            <div className="mb-16">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
                  <Sparkles className="h-4 w-4" />
                  See it in action
                </div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white mb-2">
                  Your Storytelling Journey
                </h3>
                <p className="text-white/40 max-w-md mx-auto">
                  Watch how creators bring their stories to life with AI-powered video
                </p>
              </div>
              
              <div className="relative aspect-video max-w-3xl mx-auto rounded-2xl overflow-hidden bg-black/50 border border-white/[0.08]">
                <UniversalHLSPlayer
                  hlsUrl={STORYTELLING_HLS_URL}
                  className="w-full h-full"
                  showControls={true}
                />
                
                {/* Immersive mode button */}
                {!isImmersive && (
                  <button
                    onClick={handleEnterImmersive}
                    className="absolute bottom-4 right-4 z-20 group flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    title="Immersive mode — video becomes your background while you scroll"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                    <span className="text-[10px] text-white/50 group-hover:text-white/80 font-medium tracking-wider uppercase transition-colors">Immersive</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div 
                onClick={() => onNavigate('/pricing')}
                className="relative rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] p-12 md:p-16 cursor-pointer transition-all duration-500 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/[0.03] to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-white/50">Simple pricing</span>
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-3">
                      Pay once. Create forever.
                    </h2>
                    <p className="text-white/40 text-lg">
                      No subscriptions. Credits that never expire.
                    </p>
                  </div>
                  
                  <div className="shrink-0">
                    <div className="group/btn relative">
                      <div className="absolute -inset-1 bg-white/20 rounded-full blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                      <Button
                        size="lg"
                        className="relative h-14 px-8 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300"
                      >
                        View Pricing
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="relative mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                  {PRICING_STATS.map((stat, i) => (
                    <div key={i} className="text-center">
                      <div className="text-2xl md:text-3xl font-semibold text-white">{stat.value}</div>
                      <div className="text-xs text-white/30 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </>
    );
  }
));

PricingSection.displayName = 'PricingSection';

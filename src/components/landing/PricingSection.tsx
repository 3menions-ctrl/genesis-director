import { memo, forwardRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Star, Rocket, Building2 } from 'lucide-react';
import { SimpleVideoPlayer } from '@/components/player';

const PACKAGES: Array<{ name: string; credits: number; price: number; icon: typeof Zap; color: string; glow: string; label: string; popular?: boolean }> = [
  { name: 'Mini', credits: 90, price: 9, icon: Zap, color: 'from-sky-400 to-cyan-400', glow: 'sky', label: 'Try it out' },
  { name: 'Starter', credits: 370, price: 37, icon: Star, color: 'from-violet-400 to-purple-400', glow: 'violet', label: 'Most flexible' },
  { name: 'Growth', credits: 1000, price: 99, icon: Rocket, color: 'from-amber-400 to-orange-400', glow: 'amber', label: 'Most popular', popular: true },
  { name: 'Agency', credits: 2500, price: 249, icon: Building2, color: 'from-emerald-400 to-teal-400', glow: 'emerald', label: 'Best value' },
];

const PRICING_STATS = [
  { value: '$0.10', label: 'per credit' },
  { value: '10-15', label: 'credits/clip' },
  { value: '∞', label: 'no expiry' },
] as const;

const STUDIO_VIDEO_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4';

interface PricingSectionProps {
  onNavigate: (path: string) => void;
}

export const PricingSection = memo(forwardRef<HTMLElement, PricingSectionProps>(
  function PricingSection({ onNavigate }, ref) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    
    const handlePlayVideo = useCallback(() => {
      setIsVideoPlaying(true);
      const video = document.getElementById('pricing-video') as HTMLVideoElement;
      if (video) {
        video.play().catch(console.error);
      }
    }, []);

    return (
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
              <SimpleVideoPlayer
                src={STUDIO_VIDEO_URL}
                className="w-full h-full object-contain"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
                showControls={isVideoPlaying}
              />
              
              {/* Play overlay */}
              {!isVideoPlaying && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition-opacity hover:bg-black/30"
                  onClick={handlePlayVideo}
                >
                  <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg shadow-white/20 transition-transform hover:scale-110">
                    <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Package Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {PACKAGES.map((pkg, i) => {
              const Icon = pkg.icon;
              return (
                <motion.div
                  key={pkg.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
                  onClick={() => onNavigate('/pricing')}
                  className={`relative group/card cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
                    pkg.popular
                      ? 'bg-white/[0.06] border-amber-400/30 hover:border-amber-400/50'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-[10px] font-bold text-black uppercase tracking-wider">
                      Popular
                    </div>
                  )}
                  
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  
                  <div className="text-xs text-white/40 mb-1">{pkg.label}</div>
                  <div className="text-lg font-semibold text-white">{pkg.name}</div>
                  
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <span className="text-2xl font-bold text-white">${pkg.price}</span>
                    <span className="text-xs text-white/30 ml-1">one-time</span>
                  </div>
                  <div className="text-sm text-white/50 mt-1">{pkg.credits} credits</div>
                </motion.div>
              );
            })}
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
    );
  }
));

PricingSection.displayName = 'PricingSection';

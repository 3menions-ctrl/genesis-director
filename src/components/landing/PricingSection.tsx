import { memo, forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Sparkles, Maximize2, X, Volume2, VolumeX, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { UniversalHLSPlayer, type UniversalHLSPlayerHandle } from '@/components/player/UniversalHLSPlayer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PRICING_STATS = [
  { value: '$0.10', label: 'per credit' },
  { value: '10-15', label: 'credits/clip' },
  { value: '∞', label: 'no expiry' },
] as const;

const STORYTELLING_HLS_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/temp-frames/hls_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c_1771087015077.m3u8';
const STORYTELLING_MP4_FALLBACK = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/e7cb67eb-85e5-4ca3-b85c-e5a17051b07c/avatar_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c_clip1_lipsync_1771086006879.mp4';

const INACTIVITY_TIMEOUT_MS = 10_000;

interface PricingSectionProps {
  onNavigate: (path: string) => void;
}

// Signup popup modal
const SignupPopup = memo(function SignupPopup({ onClose, onNavigate }: { onClose: () => void; onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Using sonner toast directly

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success('Check your email — we sent you a confirmation link to verify your account.', {
        duration: 8000,
        action: { label: 'Got it', onClick: () => {} },
      });
      onClose();
    } catch (err: any) {
      const msg = err.message?.includes('already registered')
        ? 'This email is already registered. Try logging in instead.'
        : 'Signup failed. Please try again.';
      toast.error(msg, {
        action: { label: 'Try Again', onClick: () => {} },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-[#0e0e14] border border-white/[0.08] p-8 shadow-[0_0_80px_rgba(255,255,255,0.06)]"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-white/50" />
        </button>

        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] mb-4">
            <Sparkles className="w-6 h-6 text-white/80" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Start creating</h2>
          <p className="text-sm text-white/40">Purchase credits to start creating cinematic videos.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11 h-12 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:border-white/20"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11 pr-11 h-12 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:border-white/20"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'Creating account...' : 'Get Started Free'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { onClose(); onNavigate('/auth'); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Already have an account? <span className="text-white/50 underline underline-offset-2">Sign in</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});

// Glowing star-like "Let's Go" CTA — white button that opens signup popup
const LetsGoCTA = memo(function LetsGoCTA({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [showSignup, setShowSignup] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-[9998] flex items-center justify-center animate-fade-in" style={{ pointerEvents: 'none' }}>
        <div className="absolute inset-0 bg-black/70" />
        
        <button
          onClick={() => setShowSignup(true)}
          className="relative z-10 w-40 h-40 md:w-52 md:h-52 rounded-full flex items-center justify-center cursor-pointer group transition-transform duration-300 hover:scale-110"
          style={{ pointerEvents: 'auto' }}
        >
          <span className="absolute inset-0 rounded-full animate-ping opacity-15 bg-white" style={{ animationDuration: '2s' }} />
          <span className="absolute -inset-3 rounded-full bg-gradient-to-r from-white/30 via-white/10 to-white/30 blur-2xl animate-pulse" style={{ animationDuration: '1.5s' }} />
          <span className="absolute -inset-6 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
          
          <span className="absolute inset-0 rounded-full overflow-hidden">
            <span className="absolute inset-0 bg-gradient-conic from-white via-white/20 to-white rounded-full animate-spin" style={{ animationDuration: '4s' }} />
          </span>
          
          <span className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.4),0_0_120px_rgba(255,255,255,0.15)]">
            <span className="text-black font-bold text-xl md:text-2xl tracking-wide">
              Let's Go!
            </span>
          </span>
        </button>
      </div>

      <AnimatePresence>
        {showSignup && (
          <SignupPopup onClose={() => setShowSignup(false)} onNavigate={onNavigate} />
        )}
      </AnimatePresence>
    </>
  );
});

// Immersive background overlay that renders the HLS video fullscreen
const CrackedGlassOverlay = memo(function CrackedGlassOverlay() {
  return (
    <div className="fixed inset-0 z-[3] pointer-events-none animate-crack-appear">
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        {/* Impact point — slightly off-center for realism */}
        <circle cx="920" cy="480" r="6" fill="rgba(255,255,255,0.25)" className="animate-crack-flash" />
        
        {/* Primary radial cracks from impact */}
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" className="animate-crack-lines-1" strokeLinecap="round">
          <path d="M920,480 L1120,280 L1200,250" />
          <path d="M920,480 L1150,500 L1350,460 L1500,420" />
          <path d="M920,480 L1080,650 L1200,780 L1280,900" />
          <path d="M920,480 L750,250 L680,150" />
          <path d="M920,480 L650,520 L450,540 L300,580" />
          <path d="M920,480 L780,700 L700,850 L650,980" />
          <path d="M920,480 L950,300 L980,150 L1010,50" />
          <path d="M920,480 L900,700 L880,900 L860,1020" />
        </g>
        
        {/* Secondary branching cracks */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" className="animate-crack-lines-2" strokeLinecap="round">
          <path d="M1120,280 L1180,320 L1250,330" />
          <path d="M1120,280 L1100,200 L1130,120" />
          <path d="M1150,500 L1180,580 L1250,620" />
          <path d="M750,250 L700,280 L620,260" />
          <path d="M750,250 L780,180 L800,100" />
          <path d="M650,520 L620,600 L580,650" />
          <path d="M1080,650 L1150,680 L1220,660" />
          <path d="M780,700 L720,730 L660,710" />
          <path d="M950,300 L1020,280 L1060,230" />
          <path d="M900,700 L960,740 L1020,800" />
        </g>
        
        {/* Tertiary micro-cracks */}
        <g stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" fill="none" className="animate-crack-lines-3" strokeLinecap="round">
          <path d="M1200,250 L1260,210 L1320,220" />
          <path d="M1350,460 L1380,500 L1430,490" />
          <path d="M1200,780 L1250,810 L1300,790" />
          <path d="M680,150 L640,120 L600,140" />
          <path d="M450,540 L430,490 L390,480" />
          <path d="M700,850 L750,880 L780,920" />
          <path d="M980,150 L940,120 L900,90" />
          <path d="M1250,330 L1290,380 L1340,370" />
          <path d="M620,260 L570,230 L530,250" />
          <path d="M580,650 L540,700 L500,690" />
        </g>
        
        {/* Concentric stress rings around impact */}
        <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" fill="none" className="animate-crack-rings">
          <ellipse cx="920" cy="480" rx="80" ry="60" />
          <ellipse cx="920" cy="480" rx="160" ry="120" />
          <ellipse cx="920" cy="480" rx="280" ry="200" />
        </g>

        {/* Shard highlight — subtle refraction */}
        <g className="animate-crack-shards">
          <polygon points="920,480 1120,280 1150,500" fill="rgba(255,255,255,0.03)" />
          <polygon points="920,480 750,250 650,520" fill="rgba(255,255,255,0.02)" />
          <polygon points="920,480 1080,650 900,700" fill="rgba(255,255,255,0.025)" />
          <polygon points="920,480 950,300 1120,280" fill="rgba(255,255,255,0.015)" />
        </g>
      </svg>
    </div>
  );
});

const ImmersiveVideoBackground = memo(function ImmersiveVideoBackground({ 
  onClose, 
  onVideoEnded 
}: { 
  onClose: () => void;
  onVideoEnded: () => void;
}) {
  const playerRef = useRef<UniversalHLSPlayerHandle>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showCrack, setShowCrack] = useState(false);

  // Trigger cracked glass effect after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCrack(true), 20_000);
    return () => clearTimeout(timer);
  }, []);

  // Escape key to exit
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

  // Sync muted state to the underlying video element
  useEffect(() => {
    const video = playerRef.current?.getVideoElement?.();
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <>
      {/* Video background layer - behind content */}
      <div className="fixed inset-0 z-[2] animate-fade-in" style={{ animationDuration: '1.2s', pointerEvents: 'none' }}>
        {/* Fullscreen HLS video */}
        <div className="absolute inset-0 [&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full [&>div]:!w-full [&>div]:!h-full">
          <UniversalHLSPlayer
            ref={playerRef}
            hlsUrl={STORYTELLING_HLS_URL}
            fallbackMp4Url={STORYTELLING_MP4_FALLBACK}
            className="w-full h-full"
            showControls={false}
            autoPlay={true}
            muted={true}
            loop={false}
            aspectRatio="auto"
            onEnded={onVideoEnded}
          />
        </div>
        
        {/* Dark gradient overlay for content readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/65" />
      </div>

      {/* Cracked glass overlay */}
      {showCrack && <CrackedGlassOverlay />}

      {/* Controls - separate from video layer so z-index works */}
      <div className="fixed top-20 right-6 z-[9999] flex items-center gap-2 animate-fade-in" style={{ pointerEvents: 'auto', animationDelay: '0.6s' }}>
        {/* Unmute/Mute button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }}
          className="group flex items-center gap-2 px-3 py-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 hover:bg-white/15 hover:border-white/30 transition-all duration-300 cursor-pointer"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
              <span className="text-[10px] text-white/50 group-hover:text-white/80 font-medium tracking-wider uppercase transition-colors hidden md:inline">Unmute</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
              <span className="text-[10px] text-white/50 group-hover:text-white/80 font-medium tracking-wider uppercase transition-colors hidden md:inline">Mute</span>
            </>
          )}
        </button>

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 hover:bg-white/15 hover:border-white/30 transition-all duration-300 cursor-pointer"
          aria-label="Exit immersive mode"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-white/70 group-hover:text-white font-medium tracking-[0.08em] uppercase transition-colors">Exit Immersive</span>
          <X className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
        </button>
      </div>
    </>
  );
});

export const PricingSection = memo(forwardRef<HTMLElement, PricingSectionProps>(
  function PricingSection({ onNavigate }, ref) {
    const [isImmersive, setIsImmersive] = useState(false);
    const [showCTA, setShowCTA] = useState(false);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasAutoTriggeredRef = useRef(false);

    // Inactivity detection — auto-enter immersive after 10s of no clicks/taps/keys
    useEffect(() => {
      if (isImmersive || hasAutoTriggeredRef.current) return;

      const startTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          if (!hasAutoTriggeredRef.current) {
            hasAutoTriggeredRef.current = true;
            setIsImmersive(true);
          }
        }, INACTIVITY_TIMEOUT_MS);
      };

      // Only track deliberate user actions, not passive movements/scrolls
      const handleActivity = () => startTimer();
      const events = ['mousedown', 'keydown', 'touchstart', 'click'];
      events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
      
      // Start the initial timer immediately
      startTimer();

      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        events.forEach(e => window.removeEventListener(e, handleActivity));
      };
    }, [isImmersive]);

    const handleEnterImmersive = useCallback(() => {
      hasAutoTriggeredRef.current = true;
      setIsImmersive(true);
      setShowCTA(false);
    }, []);

    const handleExitImmersive = useCallback(() => {
      setIsImmersive(false);
      setShowCTA(false);
    }, []);

    const handleVideoEnded = useCallback(() => {
      setShowCTA(true);
    }, []);

    return (
      <>
        {/* Immersive fullscreen background */}
        {isImmersive && (
          <ImmersiveVideoBackground 
            onClose={handleExitImmersive} 
            onVideoEnded={handleVideoEnded}
          />
        )}

        {/* Glowing CTA after video ends */}
        {showCTA && <LetsGoCTA onNavigate={onNavigate} />}

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
                  fallbackMp4Url={STORYTELLING_MP4_FALLBACK}
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

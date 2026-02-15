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
      {/* White flash on impact */}
      <div className="absolute inset-0 animate-crack-whiteflash" />

      <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Glow filter for bright crack edges */}
          <filter id="crackGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="crackGlowSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Impact point with bright center */}
        <circle cx="870" cy="420" r="3" fill="rgba(255,255,255,0.9)" className="animate-crack-flash" filter="url(#crackGlow)" />
        <circle cx="870" cy="420" r="18" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" className="animate-crack-flash" />
        
        {/* ── LAYER 1: Major radial cracks (thick, bright) ── */}
        <g stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" className="animate-crack-lines-1" strokeLinecap="round" filter="url(#crackGlow)">
          <path d="M870,420 L1020,310 L1150,240 L1300,180 L1500,120" />
          <path d="M870,420 L1080,430 L1280,400 L1480,370 L1700,330" />
          <path d="M870,420 L1020,560 L1140,680 L1250,800 L1340,960" />
          <path d="M870,420 L990,600 L1080,780 L1120,950" />
          <path d="M870,420 L720,280 L600,180 L480,90 L350,20" />
          <path d="M870,420 L650,390 L440,380 L250,400 L80,430" />
          <path d="M870,420 L730,560 L600,700 L490,850 L400,1000" />
          <path d="M870,420 L780,600 L700,780 L650,950 L620,1060" />
          <path d="M870,420 L900,270 L920,140 L940,30" />
          <path d="M870,420 L830,260 L780,120 L740,10" />
          <path d="M870,420 L870,580 L860,750 L850,950" />
          <path d="M870,420 L1000,480 L1150,560 L1320,650 L1500,740" />
        </g>

        {/* ── LAYER 2: Secondary branches ── */}
        <g stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" fill="none" className="animate-crack-lines-2" strokeLinecap="round">
          <path d="M1020,310 L1060,360 L1130,380" />
          <path d="M1020,310 L980,240 L960,160" />
          <path d="M1150,240 L1200,290 L1270,300" />
          <path d="M1150,240 L1130,170 L1150,100" />
          <path d="M1080,430 L1100,500 L1160,540" />
          <path d="M1280,400 L1310,460 L1380,480" />
          <path d="M1020,560 L1080,530 L1150,550" />
          <path d="M1140,680 L1200,650 L1270,670" />
          <path d="M1140,680 L1110,740 L1060,790" />
          <path d="M720,280 L680,330 L620,340" />
          <path d="M720,280 L750,210 L770,140" />
          <path d="M600,180 L560,230 L500,240" />
          <path d="M650,390 L630,450 L580,480" />
          <path d="M440,380 L420,320 L380,280" />
          <path d="M440,380 L410,440 L360,470" />
          <path d="M730,560 L780,590 L840,620" />
          <path d="M600,700 L550,670 L490,680" />
          <path d="M600,700 L630,760 L620,830" />
          <path d="M900,270 L960,250 L1020,220" />
          <path d="M900,270 L850,220 L800,200" />
          <path d="M870,580 L920,610 L970,650" />
          <path d="M870,580 L810,610 L760,640" />
          <path d="M990,600 L1050,620 L1120,610" />
          <path d="M1000,480 L1040,520 L1090,510" />
          <path d="M1150,560 L1190,600 L1240,590" />
        </g>

        {/* ── LAYER 3: Tertiary micro-fractures ── */}
        <g stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none" className="animate-crack-lines-3" strokeLinecap="round">
          <path d="M1300,180 L1340,220 L1390,210" />
          <path d="M1500,120 L1540,160 L1590,140" />
          <path d="M1480,370 L1520,410 L1570,400" />
          <path d="M1700,330 L1740,370 L1800,350" />
          <path d="M1250,800 L1290,830 L1340,810" />
          <path d="M1340,960 L1380,990 L1420,970" />
          <path d="M480,90 L440,130 L390,120" />
          <path d="M350,20 L310,60 L260,40" />
          <path d="M250,400 L220,360 L170,370" />
          <path d="M80,430 L50,470 L20,460" />
          <path d="M490,850 L440,880 L400,860" />
          <path d="M400,1000 L360,1030 L320,1010" />
          <path d="M940,30 L970,70 L1020,50" />
          <path d="M740,10 L700,50 L660,30" />
          <path d="M850,950 L890,980 L930,960" />
          <path d="M1320,650 L1360,690 L1410,670" />
          <path d="M1500,740 L1540,780 L1590,760" />
          <path d="M1120,950 L1160,980 L1200,960" />
          <path d="M620,1060 L660,1040 L700,1060" />
          <path d="M1130,380 L1170,410 L1220,400" />
          <path d="M620,340 L580,370 L540,350" />
          <path d="M500,240 L460,270 L420,250" />
          <path d="M580,480 L540,510 L500,500" />
          <path d="M360,470 L320,500 L280,490" />
        </g>

        {/* ── LAYER 4: Concentric stress rings (spider web) ── */}
        <g stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" fill="none" className="animate-crack-rings">
          <ellipse cx="870" cy="420" rx="40" ry="30" />
          <ellipse cx="870" cy="420" rx="90" ry="65" />
          <ellipse cx="870" cy="420" rx="160" ry="115" />
          <ellipse cx="870" cy="420" rx="260" ry="190" />
          <ellipse cx="870" cy="420" rx="400" ry="290" />
        </g>

        {/* ── LAYER 5: Shard regions with subtle refraction ── */}
        <g className="animate-crack-shards">
          <polygon points="870,420 1020,310 1080,430" fill="rgba(255,255,255,0.04)" />
          <polygon points="870,420 1080,430 1020,560" fill="rgba(255,255,255,0.025)" />
          <polygon points="870,420 1020,560 990,600" fill="rgba(255,255,255,0.035)" />
          <polygon points="870,420 720,280 650,390" fill="rgba(255,255,255,0.03)" />
          <polygon points="870,420 650,390 730,560" fill="rgba(255,255,255,0.02)" />
          <polygon points="870,420 900,270 1020,310" fill="rgba(255,255,255,0.015)" />
          <polygon points="870,420 830,260 720,280" fill="rgba(255,255,255,0.025)" />
          <polygon points="870,420 870,580 780,600" fill="rgba(255,255,255,0.03)" />
          <polygon points="870,420 870,580 990,600" fill="rgba(255,255,255,0.02)" />
          <polygon points="870,420 1000,480 1080,430" fill="rgba(255,255,255,0.015)" />
        </g>

        {/* ── LAYER 6: Bright edge highlights on major cracks ── */}
        <g stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" className="animate-crack-lines-1" strokeLinecap="round" filter="url(#crackGlowSoft)">
          <path d="M870,420 L1020,310 L1150,240" />
          <path d="M870,420 L720,280 L600,180" />
          <path d="M870,420 L1020,560 L1140,680" />
          <path d="M870,420 L730,560 L600,700" />
          <path d="M870,420 L900,270 L920,140" />
          <path d="M870,420 L870,580 L860,750" />
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

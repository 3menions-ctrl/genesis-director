import { memo, forwardRef } from 'react';
import { Sparkles } from 'lucide-react';

// STABILITY: Removed framer-motion to prevent ref-injection crashes
// Using CSS animations via Tailwind for all entrance effects

export const AvatarsHero = memo(forwardRef<HTMLElement, Record<string, never>>(function AvatarsHero(_, ref) {
  return (
    <section ref={ref} className="relative pt-24 pb-8 md:pt-32 md:pb-12 px-4 md:px-6 text-center">
      <div className="max-w-5xl mx-auto" style={{ perspective: '1000px' }}>
        {/* Floating badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-white/60">AI-Powered Presenters</span>
        </div>

        {/* Main title with CSS animation */}
        <div className="relative mb-6">
          {/* Glow effect - reduced animation for stability */}
          <div 
            className="absolute inset-0 blur-[100px] pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(ellipse 60% 40% at center, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
            }}
          />
          
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h1 className="relative text-[clamp(2.5rem,10vw,7rem)] font-black leading-[0.9] tracking-[-0.03em]">
              <span 
                className="inline-block text-white"
                style={{ 
                  textShadow: '0 4px 30px rgba(0,0,0,0.4)',
                }}
              >
                CHOOSE
              </span>
              
              <span className="inline-block mx-2 md:mx-4 text-white/15">
                –
              </span>
              
              <span 
                className="inline-block text-white/25"
                style={{ 
                  textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                AVATAR
              </span>
            </h1>
          </div>

          {/* Underline with CSS animation */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 h-[2px] w-1/2 animate-scale-in origin-center"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 50%, transparent 100%)',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
              animationDelay: '0.8s',
            }}
          />
        </div>

        {/* Subtitle */}
        <p
          className="text-base md:text-lg text-white/40 max-w-md mx-auto tracking-wide animate-fade-in"
          style={{ animationDelay: '1s' }}
        >
          Select a photorealistic or animated presenter for your next video
        </p>
      </div>
    </section>
  );
}));

AvatarsHero.displayName = 'AvatarsHero';

export default AvatarsHero;

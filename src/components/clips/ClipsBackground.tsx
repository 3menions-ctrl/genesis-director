import { useEffect, useState, memo, forwardRef } from 'react';

/**
 * Premium background for Clips/Projects pages
 * Uses pure CSS gradients — NO SVG filters, NO feGaussianBlur
 * This eliminates GPU contention with video thumbnails in the project grid
 */
const ClipsBackground = memo(forwardRef<HTMLDivElement, Record<string, never>>(function ClipsBackground(_, ref) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref} className={`fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Deep black base */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Ambient orbs — pure CSS radial gradients, zero SVG filters */}
      <div 
        className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] rounded-full animate-[pulse_15s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, hsl(270 100% 65% / 0.08) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute -bottom-[15%] -right-[10%] w-[55%] h-[65%] rounded-full animate-[pulse_18s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, hsl(260 100% 70% / 0.06) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
      <div 
        className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(275 100% 60% / 0.04) 0%, transparent 60%)',
        }}
      />

      {/* Subtle gradient sweep */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, hsl(270 60% 20% / 0.05) 0%, transparent 40%, hsl(280 60% 20% / 0.03) 100%)',
        }}
      />
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      
      {/* Noise texture for premium feel */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}));

export default ClipsBackground;

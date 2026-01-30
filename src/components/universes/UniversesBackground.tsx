import { useEffect, useState, memo, forwardRef } from 'react';

/**
 * Premium background for the Universes page
 * Uses CSS animations instead of framer-motion to prevent constant React re-renders
 * and eliminate visual flickering/blinking
 */
const UniversesBackground = memo(forwardRef<HTMLDivElement, Record<string, never>>(function UniversesBackground(_, ref) {
  const [isVisible, setIsVisible] = useState(false);
  
  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Deep black base */}
      <div className="absolute inset-0 bg-[#030303]" />
      
      {/* Static flowing circles - stunning amber/gold palette */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1920 1080" 
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ willChange: 'auto' }}
      >
        <defs>
          {/* Premium amber/gold gradients */}
          <linearGradient id="amberGlow1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(45 100% 55%)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="hsl(38 100% 50%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(30 100% 45%)" stopOpacity="0.2" />
          </linearGradient>
          
          <linearGradient id="amberGlow2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(50 100% 60%)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="hsl(42 95% 55%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(35 90% 48%)" stopOpacity="0.15" />
          </linearGradient>
          
          <linearGradient id="amberGlow3" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="hsl(48 100% 62%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(40 100% 52%)" stopOpacity="0.1" />
          </linearGradient>
          
          <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(45 100% 60%)" stopOpacity="0" />
            <stop offset="30%" stopColor="hsl(42 100% 55%)" stopOpacity="0.8" />
            <stop offset="70%" stopColor="hsl(38 100% 50%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(32 90% 45%)" stopOpacity="0" />
          </linearGradient>
          
          <linearGradient id="orangeLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(35 100% 62%)" stopOpacity="0" />
            <stop offset="40%" stopColor="hsl(30 100% 55%)" stopOpacity="0.7" />
            <stop offset="60%" stopColor="hsl(40 100% 52%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(48 95% 50%)" stopOpacity="0" />
          </linearGradient>
          
          {/* Radial glow for circles */}
          <radialGradient id="circleGlowAmber1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(45 100% 58%)" stopOpacity="0.3" />
            <stop offset="70%" stopColor="hsl(40 100% 52%)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(35 90% 45%)" stopOpacity="0" />
          </radialGradient>
          
          <radialGradient id="circleGlowAmber2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(50 100% 62%)" stopOpacity="0.25" />
            <stop offset="60%" stopColor="hsl(45 100% 55%)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(38 90% 48%)" stopOpacity="0" />
          </radialGradient>
          
          {/* Blur filter for soft glow */}
          <filter id="softGlowAmber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="20" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="heavyGlowAmber" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="40" result="blur" />
          </filter>
        </defs>
        
        {/* Large ambient orbs - static with CSS opacity */}
        <circle
          cx="15%"
          cy="20%"
          r="250"
          fill="url(#circleGlowAmber1)"
          filter="url(#heavyGlowAmber)"
          className="animate-[pulse_15s_ease-in-out_infinite]"
          style={{ opacity: 0.4 }}
        />
        
        <circle
          cx="85%"
          cy="75%"
          r="300"
          fill="url(#circleGlowAmber2)"
          filter="url(#heavyGlowAmber)"
          className="animate-[pulse_18s_ease-in-out_infinite]"
          style={{ opacity: 0.3, animationDelay: '2s' }}
        />
        
        <circle
          cx="50%"
          cy="50%"
          r="400"
          fill="url(#circleGlowAmber1)"
          filter="url(#heavyGlowAmber)"
          style={{ opacity: 0.2 }}
        />
        
        {/* Static flowing curved lines */}
        <path
          d="M-100,400 Q300,200 600,350 T1200,300 T1800,450 T2200,350"
          stroke="url(#goldLine)"
          strokeWidth="2"
          fill="none"
          filter="url(#softGlowAmber)"
        />
        
        <path
          d="M-50,600 Q400,450 800,550 T1400,480 T2000,580"
          stroke="url(#orangeLine)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#softGlowAmber)"
          style={{ opacity: 0.8 }}
        />
        
        <path
          d="M-200,250 Q200,150 500,280 T1100,180 T1700,300 T2100,200"
          stroke="url(#goldLine)"
          strokeWidth="1"
          fill="none"
          filter="url(#softGlowAmber)"
          style={{ opacity: 0.6 }}
        />
        
        {/* Elegant static circles */}
        <circle
          cx="20%"
          cy="60%"
          r="80"
          stroke="url(#amberGlow1)"
          strokeWidth="1"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        <circle
          cx="75%"
          cy="25%"
          r="120"
          stroke="url(#amberGlow2)"
          strokeWidth="1.5"
          fill="none"
          style={{ opacity: 0.4 }}
        />
        
        <circle
          cx="45%"
          cy="85%"
          r="60"
          stroke="url(#amberGlow3)"
          strokeWidth="1"
          fill="none"
          style={{ opacity: 0.6 }}
        />
        
        {/* Small accent circles */}
        <circle
          cx="90%"
          cy="45%"
          r="40"
          stroke="url(#goldLine)"
          strokeWidth="0.5"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        <circle
          cx="10%"
          cy="90%"
          r="50"
          stroke="url(#orangeLine)"
          strokeWidth="0.5"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        {/* Static arc lines */}
        <path
          d="M200,800 Q600,600 400,400"
          stroke="url(#amberGlow1)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        <path
          d="M1600,200 Q1400,500 1700,700"
          stroke="url(#amberGlow2)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0.4 }}
        />
      </svg>
      
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

export default UniversesBackground;
import { useEffect, useState } from 'react';

/**
 * Premium background for the Avatars page
 * Uses CSS animations with violet/magenta palette for a modern, advanced aesthetic
 */
export default function AvatarsBackground() {
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
      
      {/* Premium flowing elements - violet/magenta palette */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1920 1080" 
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ willChange: 'auto' }}
      >
        <defs>
          {/* Premium violet/magenta gradients */}
          <linearGradient id="avatarVioletGlow1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(280 100% 65%)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="hsl(290 100% 55%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(300 90% 50%)" stopOpacity="0.2" />
          </linearGradient>
          
          <linearGradient id="avatarVioletGlow2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270 100% 70%)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="hsl(285 95% 60%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(295 90% 52%)" stopOpacity="0.15" />
          </linearGradient>
          
          <linearGradient id="avatarVioletGlow3" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="hsl(275 100% 72%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(290 100% 58%)" stopOpacity="0.1" />
          </linearGradient>
          
          <linearGradient id="avatarMagentaLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(280 100% 70%)" stopOpacity="0" />
            <stop offset="30%" stopColor="hsl(290 100% 65%)" stopOpacity="0.8" />
            <stop offset="70%" stopColor="hsl(300 100% 58%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(310 90% 52%)" stopOpacity="0" />
          </linearGradient>
          
          <linearGradient id="avatarFuchsiaLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(320 100% 72%)" stopOpacity="0" />
            <stop offset="40%" stopColor="hsl(305 100% 65%)" stopOpacity="0.7" />
            <stop offset="60%" stopColor="hsl(290 100% 60%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(275 95% 55%)" stopOpacity="0" />
          </linearGradient>
          
          {/* Radial glow for orbs */}
          <radialGradient id="avatarCircleGlow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(285 100% 68%)" stopOpacity="0.35" />
            <stop offset="70%" stopColor="hsl(295 100% 58%)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(300 90% 50%)" stopOpacity="0" />
          </radialGradient>
          
          <radialGradient id="avatarCircleGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(275 100% 72%)" stopOpacity="0.28" />
            <stop offset="60%" stopColor="hsl(285 100% 62%)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(295 90% 55%)" stopOpacity="0" />
          </radialGradient>
          
          <radialGradient id="avatarCircleGlow3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(310 100% 70%)" stopOpacity="0.22" />
            <stop offset="50%" stopColor="hsl(300 100% 60%)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(290 90% 52%)" stopOpacity="0" />
          </radialGradient>
          
          {/* Blur filters for soft glow */}
          <filter id="avatarSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="20" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="avatarHeavyGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="45" result="blur" />
          </filter>
          
          <filter id="avatarUltraGlow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="80" result="blur" />
          </filter>
        </defs>
        
        {/* Large ambient orbs with subtle pulse animation */}
        <circle
          cx="10%"
          cy="15%"
          r="280"
          fill="url(#avatarCircleGlow1)"
          filter="url(#avatarHeavyGlow)"
          className="animate-[pulse_12s_ease-in-out_infinite]"
          style={{ opacity: 0.45 }}
        />
        
        <circle
          cx="90%"
          cy="80%"
          r="320"
          fill="url(#avatarCircleGlow2)"
          filter="url(#avatarHeavyGlow)"
          className="animate-[pulse_15s_ease-in-out_infinite]"
          style={{ opacity: 0.35, animationDelay: '3s' }}
        />
        
        <circle
          cx="55%"
          cy="45%"
          r="450"
          fill="url(#avatarCircleGlow1)"
          filter="url(#avatarUltraGlow)"
          className="animate-[pulse_18s_ease-in-out_infinite]"
          style={{ opacity: 0.18, animationDelay: '1s' }}
        />
        
        <circle
          cx="25%"
          cy="75%"
          r="200"
          fill="url(#avatarCircleGlow3)"
          filter="url(#avatarHeavyGlow)"
          className="animate-[pulse_14s_ease-in-out_infinite]"
          style={{ opacity: 0.3, animationDelay: '5s' }}
        />
        
        <circle
          cx="80%"
          cy="25%"
          r="180"
          fill="url(#avatarCircleGlow3)"
          filter="url(#avatarHeavyGlow)"
          className="animate-[pulse_16s_ease-in-out_infinite]"
          style={{ opacity: 0.25, animationDelay: '2s' }}
        />
        
        {/* Flowing curved lines - primary */}
        <path
          d="M-100,350 Q350,150 700,320 T1300,250 T1900,400 T2300,300"
          stroke="url(#avatarMagentaLine)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#avatarSoftGlow)"
        />
        
        <path
          d="M-50,550 Q450,400 850,520 T1500,440 T2100,550"
          stroke="url(#avatarFuchsiaLine)"
          strokeWidth="2"
          fill="none"
          filter="url(#avatarSoftGlow)"
          style={{ opacity: 0.85 }}
        />
        
        <path
          d="M-200,200 Q250,100 550,240 T1150,150 T1750,280 T2200,180"
          stroke="url(#avatarMagentaLine)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#avatarSoftGlow)"
          style={{ opacity: 0.65 }}
        />
        
        {/* Secondary flowing lines */}
        <path
          d="M-150,700 Q300,550 650,680 T1250,600 T1850,720"
          stroke="url(#avatarFuchsiaLine)"
          strokeWidth="1.2"
          fill="none"
          filter="url(#avatarSoftGlow)"
          style={{ opacity: 0.55 }}
        />
        
        <path
          d="M-80,850 Q400,750 780,850 T1400,780 T2000,880"
          stroke="url(#avatarMagentaLine)"
          strokeWidth="1"
          fill="none"
          filter="url(#avatarSoftGlow)"
          style={{ opacity: 0.45 }}
        />
        
        {/* Elegant ring elements */}
        <circle
          cx="18%"
          cy="55%"
          r="100"
          stroke="url(#avatarVioletGlow1)"
          strokeWidth="1.5"
          fill="none"
          style={{ opacity: 0.55 }}
        />
        
        <circle
          cx="78%"
          cy="22%"
          r="140"
          stroke="url(#avatarVioletGlow2)"
          strokeWidth="2"
          fill="none"
          style={{ opacity: 0.45 }}
        />
        
        <circle
          cx="42%"
          cy="88%"
          r="75"
          stroke="url(#avatarVioletGlow3)"
          strokeWidth="1.2"
          fill="none"
          style={{ opacity: 0.6 }}
        />
        
        <circle
          cx="65%"
          cy="65%"
          r="90"
          stroke="url(#avatarVioletGlow1)"
          strokeWidth="1"
          fill="none"
          style={{ opacity: 0.4 }}
        />
        
        {/* Small accent circles */}
        <circle
          cx="92%"
          cy="50%"
          r="45"
          stroke="url(#avatarMagentaLine)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0.55 }}
        />
        
        <circle
          cx="8%"
          cy="88%"
          r="55"
          stroke="url(#avatarFuchsiaLine)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        <circle
          cx="35%"
          cy="18%"
          r="35"
          stroke="url(#avatarVioletGlow2)"
          strokeWidth="0.6"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        {/* Arc accents */}
        <path
          d="M180,850 Q580,650 380,450"
          stroke="url(#avatarVioletGlow1)"
          strokeWidth="1"
          fill="none"
          style={{ opacity: 0.5 }}
        />
        
        <path
          d="M1650,180 Q1450,480 1750,680"
          stroke="url(#avatarVioletGlow2)"
          strokeWidth="1"
          fill="none"
          style={{ opacity: 0.45 }}
        />
        
        <path
          d="M950,120 Q1100,350 900,550"
          stroke="url(#avatarVioletGlow3)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0.4 }}
        />
      </svg>
      
      {/* Cinematic vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 15%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      
      {/* Premium noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

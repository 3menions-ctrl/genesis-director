import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import pipelinePremiumBg from '@/assets/pipeline-premium-bg.jpg';

interface PipelineBackgroundProps {
  className?: string;
}

/**
 * Premium background for the Production/Pipeline page
 * Deep violet/indigo flowing light streaks with holographic particles
 */
const PipelineBackground = memo(forwardRef<HTMLDivElement, PipelineBackgroundProps>(function PipelineBackground({ className }, ref) {
  return (
    <div className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${pipelinePremiumBg})` }}
      />
      
      {/* Deep overlay for legibility */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Violet ambient glow - top */}
      <div 
        className="absolute top-[-25%] left-[10%] w-[80vw] h-[60vw] rounded-full opacity-[0.07] blur-[150px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(270 80% 55%) 0%, transparent 70%)' }}
      />
      
      {/* Indigo ambient glow - bottom right */}
      <div 
        className="absolute bottom-[-20%] right-[-5%] w-[60vw] h-[50vw] rounded-full opacity-[0.05] blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(240 70% 50%) 0%, transparent 70%)' }}
      />

      {/* Animated scan line effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
          backgroundSize: '100% 4px',
        }}
      />
      
      {/* Cinematic vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)' }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}));

export default PipelineBackground;

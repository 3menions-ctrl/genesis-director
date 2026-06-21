import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import pipelineAbstractBg from '@/assets/pipeline-abstract-bg.jpg';

interface ProfileBackgroundProps {
  className?: string;
}

/**
 * Premium background for the Profile page
 * Features elegant green flowing lines on pure black - matching Create page
 */
const ProfileBackground = memo(forwardRef<HTMLDivElement, ProfileBackgroundProps>(function ProfileBackground({ className }, ref) {
  return (
    <div ref={ref} className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background image - emerald green flowing lines */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${pipelineAbstractBg})`,
        }}
      />
      
      {/* Subtle dark overlay for depth */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Ambient glow - top left emerald */}
      <div 
        className="absolute top-[-20%] left-[-15%] w-[70vw] h-[70vw] rounded-full opacity-[0.08] blur-[150px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(145 70% 40%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Ambient glow - bottom right jade */}
      <div 
        className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.06] blur-[120px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(160 60% 35%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Center subtle teal accent */}
      <div 
        className="absolute top-[30%] right-[20%] w-[40vw] h-[40vw] rounded-full opacity-[0.04] blur-[100px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(155 55% 45%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Cinematic vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      
      {/* Premium noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}));

export default ProfileBackground;

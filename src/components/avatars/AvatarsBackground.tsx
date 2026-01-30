import { memo } from 'react';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface AvatarsBackgroundProps {
  className?: string;
}

export const AvatarsBackground = memo(function AvatarsBackground({ className }: AvatarsBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 z-0", className)}>
      {/* Premium abstract background - same as landing */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      
      {/* Subtle violet tint overlay for avatar page identity */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(139,92,246,0.08) 0%, transparent 60%)'
        }}
      />
      
      {/* Keep the black intact with minimal overlay */}
      <div className="absolute inset-0 bg-black/15" />
      
      {/* Cinematic vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
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
});

export default AvatarsBackground;

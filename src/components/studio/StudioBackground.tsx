import { cn } from '@/lib/utils';
import studioAbstractBg from '@/assets/studio-abstract-bg.jpg';

interface StudioBackgroundProps {
  className?: string;
}

export default function StudioBackground({ className }: StudioBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background with neon lines */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${studioAbstractBg})` }}
      />
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Gradient vignette for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      
      {/* Subtle animated glow spots */}
      <div 
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse-soft"
        style={{ background: 'radial-gradient(circle, hsl(180 100% 50%) 0%, transparent 70%)' }}
      />
      <div 
        className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl animate-pulse-soft"
        style={{ 
          background: 'radial-gradient(circle, hsl(320 100% 60%) 0%, transparent 70%)',
          animationDelay: '1s'
        }}
      />
      <div 
        className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-15 blur-3xl animate-pulse-soft"
        style={{ 
          background: 'radial-gradient(circle, hsl(45 100% 55%) 0%, transparent 70%)',
          animationDelay: '2s'
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

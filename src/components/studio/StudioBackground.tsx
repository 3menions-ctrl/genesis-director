import { cn } from '@/lib/utils';
import studioAbstractBg from '@/assets/studio-abstract-bg.jpg';

interface StudioBackgroundProps {
  className?: string;
}

export default function StudioBackground({ className }: StudioBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background - black, white, grey, navy blue */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${studioAbstractBg})` }}
      />
      
      {/* Very subtle overlay to maintain depth */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Gradient vignette for cinematic depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      
      {/* Subtle ambient glow - matching navy blue theme */}
      <div 
        className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.08] blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(220 60% 40%) 0%, transparent 70%)' }}
      />
      <div 
        className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(0 0% 100%) 0%, transparent 70%)' }}
      />
      
      {/* Premium noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

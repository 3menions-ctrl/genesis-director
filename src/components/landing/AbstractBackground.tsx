import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      {/* Premium abstract background image - pure black with colored lines */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      
      {/* Very subtle overlay to blend with page - keeping the black intact */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Soft vignette for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
        }}
      />
      
      {/* Subtle noise texture for premium feel */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

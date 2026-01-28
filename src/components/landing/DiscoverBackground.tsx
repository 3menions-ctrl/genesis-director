import { cn } from '@/lib/utils';
import discoverAbstractBg from '@/assets/discover-abstract-bg.jpg';

interface DiscoverBackgroundProps {
  className?: string;
}

/**
 * Premium background for the Discover/Library page
 * Features warm copper/rose gold flowing lines on pure black
 * Different color palette from landing page but same premium aesthetic
 */
export default function DiscoverBackground({ className }: DiscoverBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background image - warm copper/rose tones */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${discoverAbstractBg})`,
        }}
      />
      
      {/* Very subtle overlay to blend with page */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Ambient glow - top left warm copper */}
      <div 
        className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.12] blur-[120px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(25 60% 50%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Ambient glow - bottom right rose gold */}
      <div 
        className="absolute bottom-[-10%] right-[-15%] w-[55vw] h-[55vw] rounded-full opacity-[0.10] blur-[100px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(15 50% 45%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Center accent glow - soft coral */}
      <div 
        className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full opacity-[0.06] blur-[90px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(20 70% 60%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Soft vignette for cinematic depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      
      {/* Premium noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

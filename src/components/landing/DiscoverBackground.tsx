import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface DiscoverBackgroundProps {
  className?: string;
}

/**
 * Premium background for the Discover/Library page
 * Uses the same base image as the landing page with the same black & white aesthetic
 * - Rotated/mirrored for visual distinction
 * - Maintains silver/white/navy color scheme
 */
export default function DiscoverBackground({ className }: DiscoverBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 -z-10", className)}>
      {/* Premium abstract background image - rotated 180deg for different line direction */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${landingAbstractBg})`,
          transform: 'rotate(180deg) scaleX(-1)',
        }}
      />
      
      {/* Subtle overlay to blend with page - maintains black & white theme */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Ambient glow - top left silver/white */}
      <div 
        className="absolute top-[-10%] left-[-5%] w-[50vw] h-[50vw] rounded-full opacity-[0.08] blur-[100px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(220 10% 90%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Ambient glow - bottom right deep navy */}
      <div 
        className="absolute bottom-[-5%] right-[-10%] w-[45vw] h-[45vw] rounded-full opacity-[0.06] blur-[90px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(220 40% 25%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Accent glow - center silver */}
      <div 
        className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] rounded-full opacity-[0.04] blur-[80px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, hsl(0 0% 85%) 0%, transparent 70%)' 
        }}
      />
      
      {/* Soft vignette for cinematic depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.5) 100%)',
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
}

import { forwardRef, memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/bg-idea-6-epic-landscape.jpg';

interface AbstractBackgroundProps {
  className?: string;
}

const AbstractBackground = memo(forwardRef<HTMLDivElement, AbstractBackgroundProps>(
  function AbstractBackground({ className }, ref) {
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    // Subtle parallax on mouse move (throttled)
    useEffect(() => {
      let rafId: number;
      const handleMove = (e: MouseEvent) => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setMousePos({
            x: (e.clientX / window.innerWidth) * 100,
            y: (e.clientY / window.innerHeight) * 100,
          });
        });
      };
      window.addEventListener('mousemove', handleMove, { passive: true });
      return () => {
        window.removeEventListener('mousemove', handleMove);
        cancelAnimationFrame(rafId);
      };
    }, []);

    return (
      <div ref={ref} className={cn("absolute inset-0", className)}>
        {/* Base image layer */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[2000ms] ease-out"
          style={{ 
            backgroundImage: `url(${landingAbstractBg})`,
            transform: `scale(1.05) translate(${(mousePos.x - 50) * -0.02}%, ${(mousePos.y - 50) * -0.02}%)`,
          }}
        />
        
        {/* Animated gradient mesh overlay — futuristic feel */}
        <div 
          className="absolute inset-0 animate-gradient-mesh opacity-30 pointer-events-none mix-blend-overlay"
          style={{
            background: `
              radial-gradient(ellipse at ${mousePos.x}% ${mousePos.y}%, hsl(263 70% 58% / 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at ${100 - mousePos.x}% ${100 - mousePos.y}%, hsl(195 90% 50% / 0.1) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, hsl(160 84% 45% / 0.05) 0%, transparent 60%)
            `,
          }}
        />

        {/* Holographic grid overlay */}
        <div 
          className="absolute inset-0 animate-holo-grid-pulse pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(hsl(263 70% 58% / 0.08) 1px, transparent 1px),
              linear-gradient(90deg, hsl(263 70% 58% / 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        
        {/* Scan line sweep */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute left-0 right-0 h-[2px] animate-scan-line"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(195 90% 50% / 0.3), hsl(263 70% 58% / 0.2), transparent)',
              boxShadow: '0 0 20px hsl(195 90% 50% / 0.15)',
            }}
          />
        </div>

        {/* Darker overlay */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Vignette */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    );
  }
));

export default AbstractBackground;

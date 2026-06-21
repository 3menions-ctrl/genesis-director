/**
 * ProjectsBackground — Ambient cinematic atmosphere
 * Living background with aurora gradients, subtle particle dust,
 * and shifting light. Pure CSS — no SVG filters for GPU safety.
 */

import { memo, forwardRef, useEffect, useState } from 'react';

const ProjectsBackground = memo(forwardRef<HTMLDivElement>(function ProjectsBackground(_, ref) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={ref}
      className={`fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Deep base */}
      <div className="absolute inset-0 bg-background" />

      {/* Aurora sweep — slow drifting gradients */}
      <div
        className="absolute -top-[30%] -left-[20%] w-[80%] h-[80%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(270 80% 50% / 0.07) 0%, hsl(260 60% 40% / 0.03) 40%, transparent 70%)',
          animation: 'aurora-drift-1 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-[20%] -right-[15%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(280 70% 55% / 0.06) 0%, hsl(300 50% 40% / 0.02) 45%, transparent 70%)',
          animation: 'aurora-drift-2 30s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-[20%] right-[10%] w-[50%] h-[50%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(220 70% 60% / 0.04) 0%, transparent 60%)',
          animation: 'aurora-drift-3 20s ease-in-out infinite',
        }}
      />

      {/* Warm accent — subtle golden light leak */}
      <div
        className="absolute top-[50%] left-[30%] w-[30%] h-[30%] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(35 80% 55% / 0.025) 0%, transparent 60%)',
          animation: 'aurora-drift-2 22s ease-in-out infinite reverse',
        }}
      />

      {/* Gradient mesh overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, hsl(270 40% 15% / 0.06) 0%, transparent 35%, hsl(220 40% 15% / 0.04) 65%, transparent 100%)',
        }}
      />

      {/* Vignette — cinematic edge darkening */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, hsl(0 0% 0% / 0.5) 100%)',
        }}
      />

      {/* Film grain texture */}
      <div
        className="absolute inset-0 opacity-[0.018] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Particle dust — CSS-only floating dots */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${1 + Math.random() * 1.5}px`,
              height: `${1 + Math.random() * 1.5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.03 + Math.random() * 0.06,
              animation: `particle-float ${15 + Math.random() * 20}s ease-in-out infinite`,
              animationDelay: `${Math.random() * -20}s`,
            }}
          />
        ))}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes aurora-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, 3%) scale(1.05); }
          66% { transform: translate(-3%, -2%) scale(0.97); }
        }
        @keyframes aurora-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4%, 5%) scale(1.08); }
        }
        @keyframes aurora-drift-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(3%, -4%) rotate(3deg); }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.03; }
          25% { opacity: 0.08; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.05; }
          75% { opacity: 0.07; }
        }
      `}</style>
    </div>
  );
}));

export default ProjectsBackground;

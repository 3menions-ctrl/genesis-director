import { memo, forwardRef } from 'react';

/**
 * AvatarsBackground — mirrors the Create page's StudioAurora composition
 * so the Avatars studio shares the exact same premium, boundary-less
 * canvas. Pro-Dark base + conic aurora sweep + primary blue radial +
 * cool counter-glow + vignette + film grain + top hairline.
 */
const AvatarsBackground = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AvatarsBackground(_, ref) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* deep base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220_14%_6%)_0%,hsl(220_14%_2%)_60%)]" />

      {/* keyframes shared with Create page */}
      <style>{`
        @keyframes avatarsAurora { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>

      {/* conic aurora sweep */}
      <div
        className="absolute -inset-[20%] opacity-[0.18]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.2) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
          filter: 'blur(80px)',
          animation: 'avatarsAurora 60s linear infinite',
        }}
      />

      {/* primary aurora */}
      <div
        className="absolute -top-1/3 left-1/2 h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full opacity-[0.35] blur-3xl animate-[pulse_12s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, hsl(212 100% 50% / 0.55) 0%, transparent 60%)' }}
      />

      {/* cool counter-glow */}
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[55vmax] w-[55vmax] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(190 100% 55% / 0.35) 0%, transparent 65%)' }}
      />

      {/* edge vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsl(220 14% 1%) 100%)' }}
      />

      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* top hairline highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}));

AvatarsBackground.displayName = 'AvatarsBackground';

export default AvatarsBackground;

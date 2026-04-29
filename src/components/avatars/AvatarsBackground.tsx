import { useEffect, useState, memo, forwardRef } from 'react';

/**
 * AvatarsBackground — Pro-Dark cinematic canvas
 * Apple-clean dark base (hsl(220,14%,2%)) with #0A84FF aurora glows.
 * Replaces the legacy violet/magenta composition (violated no-purple Core rule).
 */
const AvatarsBackground = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AvatarsBackground(_, ref) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={ref}
      className={`fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Pro-Dark base */}
      <div className="absolute inset-0" style={{ background: 'hsl(220, 14%, 2%)' }} />

      {/* Cinematic blue aurora — heavy radial glows */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 900px 600px at 12% 18%, hsla(212, 100%, 55%, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse 1100px 700px at 88% 82%, hsla(215, 100%, 60%, 0.08) 0%, transparent 65%),
            radial-gradient(ellipse 1400px 900px at 50% 50%, hsla(218, 100%, 50%, 0.04) 0%, transparent 70%)
          `,
        }}
      />

      {/* Slow-pulsing accent orbs */}
      <div
        className="absolute rounded-full animate-[pulse_14s_ease-in-out_infinite]"
        style={{
          top: '8%',
          left: '6%',
          width: '420px',
          height: '420px',
          background: 'radial-gradient(circle, hsla(212, 100%, 60%, 0.18) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.7,
        }}
      />
      <div
        className="absolute rounded-full animate-[pulse_18s_ease-in-out_infinite]"
        style={{
          bottom: '5%',
          right: '8%',
          width: '520px',
          height: '520px',
          background: 'radial-gradient(circle, hsla(215, 100%, 55%, 0.14) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.55,
          animationDelay: '4s',
        }}
      />
      <div
        className="absolute rounded-full animate-[pulse_22s_ease-in-out_infinite]"
        style={{
          top: '40%',
          left: '55%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, hsla(220, 100%, 65%, 0.06) 0%, transparent 70%)',
          filter: 'blur(100px)',
          opacity: 0.4,
          animationDelay: '2s',
        }}
      />

      {/* Subtle horizon line — single luminous thread */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="avatarBlueLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(212, 100%, 65%)" stopOpacity="0" />
            <stop offset="40%" stopColor="hsl(215, 100%, 70%)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="hsl(215, 100%, 70%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(218, 100%, 65%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="avatarBlueLineSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(212, 100%, 65%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(215, 100%, 75%)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(218, 100%, 65%)" stopOpacity="0" />
          </linearGradient>
          <filter id="avatarSoftGlow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <path
          d="M-50,420 Q480,360 960,420 T1980,400"
          stroke="url(#avatarBlueLine)"
          strokeWidth="1"
          fill="none"
          filter="url(#avatarSoftGlow)"
          opacity="0.6"
        />
        <path
          d="M-50,680 Q500,640 980,680 T1980,660"
          stroke="url(#avatarBlueLineSoft)"
          strokeWidth="0.8"
          fill="none"
          filter="url(#avatarSoftGlow)"
          opacity="0.45"
        />
      </svg>

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, hsla(220, 14%, 1%, 0.6) 100%)',
        }}
      />

      {/* Premium grain */}
      <div
        className="absolute inset-0 opacity-[0.022] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}));

AvatarsBackground.displayName = 'AvatarsBackground';

export default AvatarsBackground;

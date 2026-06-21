/**
 * Brandmark — the Small Bridges logo. A single, bold, beautiful arch with a
 * glowing keystone — clean and iconic, no deck or suspension lines. Reads as a
 * bridge / a rising gateway, premium and legible down to ~16px. The arch +
 * keystone use the accent (gradient + soft glow).
 */
import { useId } from "react";
import { ACCENT } from "./ui";

export function Brandmark({ className, accent = `hsl(${ACCENT})`, title }: { className?: string; accent?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const gid = `sb-arch-${uid}`;
  const fid = `sb-glow-${uid}`;

  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gid} x1="5" y1="9" x2="35" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#cfe1fb" />
          <stop offset="0.5" stopColor={accent} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* the arch — bold gradient accent, softly glowing */}
      <path d="M5 31 Q20 -14 35 31" stroke={`url(#${gid})`} strokeWidth="3.1" strokeLinecap="round" filter={`url(#${fid})`} />

      {/* keystone with a gleam */}
      <circle cx="20" cy="8.6" r="2.5" fill={accent} />
      <circle cx="19.1" cy="7.7" r="0.85" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  );
}

/** The mark in a premium rounded tile (app-icon / nav use). */
export function BrandTile({ className }: { className?: string }) {
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden rounded-[11px] ${className ?? "h-8 w-8"}`}
      style={{
        background: "linear-gradient(152deg, #1b212b 0%, #11141b 52%, #07080b 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -10px 22px rgba(0,0,0,0.55), 0 6px 18px -6px rgba(0,0,0,0.8)",
      }}
    >
      {/* outer hairline ring */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[11px] ring-1 ring-inset ring-white/12" />
      {/* accent glow from the top */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(125% 120% at 50% -10%, hsl(${ACCENT} / 0.34), transparent 62%)` }} />
      {/* top bevel highlight */}
      <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }} />
      <Brandmark className="relative h-[74%] w-[74%] text-white" />
    </span>
  );
}

/** Full lockup: tile + gradient-ink wordmark. */
export function Logo({ className, tileClass }: { className?: string; tileClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BrandTile className={tileClass} />
      <span
        className="font-display text-[17px] tracking-[-0.01em]"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #d4e0f3 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
      >
        Small <span className="font-semibold italic">Bridges</span>
      </span>
    </span>
  );
}

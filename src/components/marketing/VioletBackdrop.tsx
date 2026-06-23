/**
 * VioletBackdrop — the shared premium, glossy violet page backdrop for the
 * marketing surfaces (Pricing, How It Works).
 *
 * Research-backed for pricing pages: a deep, legible indigo→violet base keeps
 * cards and white CTAs popping, while a brighter focal bloom is positioned to
 * sit *behind the recommended plan* (top-centre) so the eye is guided there — a
 * gradient that directs, not just decorates. Layered: base gradient, focal
 * bloom, top gloss, two corner blooms, a diagonal specular sheen, a legibility
 * vignette, a violet hairline and fine grain. No external images.
 *
 * `focal` (0–1) nudges the bright bloom's vertical position; default 0.40 lands
 * it behind a "Most Popular" card row near the top of a pricing grid.
 */
import { memo, type CSSProperties } from 'react';

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

function VioletBackdropImpl({ focal = 0.4 }: { focal?: number }) {
  const layers: CSSProperties = {
    backgroundImage: [
      `radial-gradient(46% 52% at 50% ${Math.round(focal * 100)}%, rgba(168,85,247,0.34), transparent 60%)`,
      'radial-gradient(120% 55% at 50% -8%, rgba(233,213,255,0.18), transparent 58%)',
      'radial-gradient(70% 60% at 92% 102%, rgba(192,38,211,0.22), transparent 55%)',
      'radial-gradient(60% 50% at 6% 6%, rgba(99,102,241,0.20), transparent 50%)',
      'linear-gradient(160deg, #0c0820 0%, #1a0b3e 28%, #2e1065 52%, #4c1d95 80%, #5b21b6 100%)',
    ].join(', '),
  };

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#0c0820]">
      <div className="absolute inset-0" style={layers} />
      {/* diagonal specular sheen — the "gloss" */}
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{ backgroundImage: 'linear-gradient(122deg, transparent 34%, rgba(255,255,255,0.07) 47%, transparent 56%)' }}
      />
      {/* 60% dark blind — dims the violet for depth + legibility */}
      <div className="absolute inset-0 bg-black/60" />
      {/* legibility vignette */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(130% 120% at 50% 32%, transparent 52%, rgba(5,4,12,0.62))' }}
      />
      {/* faint structure grid, masked toward the top */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(216,180,254,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(216,180,254,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(120% 95% at 50% 0%, #000 26%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(120% 95% at 50% 0%, #000 26%, transparent 72%)',
        }}
      />
      {/* violet hairline */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(216,180,254,0.6), transparent)' }}
      />
      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
      />
    </div>
  );
}

export const VioletBackdrop = memo(VioletBackdropImpl);
export default VioletBackdrop;

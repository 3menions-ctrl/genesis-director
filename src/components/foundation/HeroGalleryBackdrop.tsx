/**
 * HeroGalleryBackdrop — shared full-bleed wrapper for a page-hero
 * auto-gallery. Handles three things every page needs identically:
 *
 *   1. Breaks out of the page's max-w-[1440px] wrapper so the bg
 *      reaches both viewport edges.
 *   2. Shifts an extra 160px further left ONLY when the LeftRail is
 *      open at md+ — that's when FoundationShell pushes content right
 *      by 320px, so the parent's center is 160px right of the
 *      viewport's center. With the rail closed, the page is
 *      viewport-centered and no extra shift is needed (over-shifting
 *      would trim the right edge).
 *   3. Lays a horizontal-then-vertical scrim over the image so the
 *      left side stays dark enough for typography while the right side
 *      breathes and reads as image-forward.
 *
 * Children render INSIDE the bg wrapper as the cycling visual (we
 * expect <AutoGallery variant="hero" .../> here). The host page is
 * expected to wrap this in a `<section className="relative …">` and
 * render its foreground in `<div className="relative z-10 …">` as a
 * sibling.
 */
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional override of the horizontal scrim. Keeps the left side
   *  darker than the right by default. */
  scrim?: string;
}

const DEFAULT_SCRIM =
  "linear-gradient(to right, hsl(220 30% 3% / 0.78) 0%, hsl(220 30% 3% / 0.68) 32%, hsl(220 30% 3% / 0.42) 62%, hsl(220 30% 3% / 0.22) 100%)";

export function HeroGalleryBackdrop({ children, scrim = DEFAULT_SCRIM }: Props) {
  // The always-on LeftRail (72px mobile / 96px md+) shifts page content right,
  // so the parent's centre sits half-a-rail right of the viewport centre. Pull
  // the 100vw bed left by that half-rail so it spans the FULL page edge-to-edge.
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 overflow-hidden left-[calc(50%_-_50vw_-_36px)] md:left-[calc(50%_-_50vw_-_48px)]"
      style={{ width: "100vw" }}
    >
      {children}
      <div aria-hidden className="absolute inset-0" style={{ background: scrim }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[hsl(220_30%_3%/0.55)] to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[hsl(220_30%_3%)] to-transparent" />
    </div>
  );
}

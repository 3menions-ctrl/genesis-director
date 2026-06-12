/**
 * EditorialCanvas — the foundation surface of the Small Bridges app.
 *
 * Captures the "Tell me about your film." design language from the
 * Studio's StartHero and exposes it as a reusable primitive. Every
 * spine surface (Landing · Studio · Library · Reel · Account) wraps
 * its main content in this so the entire app feels like one room.
 *
 * Anatomy (back → front):
 *   1. <Atmosphere/>        — ambient blurred accent orbs behind the canvas
 *   2. <Canvas>             — the glass container itself
 *        - gradient-tinted card background, backdrop-blur
 *        - massive multi-layer shadow (drop + accent glow + inner hairline)
 *        - SVG fractal grain overlay at ~2.5% opacity, mix-blend-overlay
 *        - 1px luminous inner ring
 *        - 4 corner registration brackets (camera-viewfinder feel)
 *        - <Chrome/>      optional mac-window title bar (dots + breadcrumb + timecode)
 *        - <Body/>        the actual content region with proper padding
 *
 * Composed pieces:
 *   - <EditorialCanvas>     the whole thing
 *   - <EditorialChrome>     standalone title bar (if you need it elsewhere)
 *   - <EditorialEyebrow>    "STEP 01 · BRIEF" small mono label with accent line
 *   - <EditorialHeadline>   the giant gradient-bleed serif headline
 *   - <EditorialAtmosphere> standalone ambient orbs (also used by full-bleed surfaces)
 *
 * Motion: opt-in via the `enter` prop. Reduced-motion aware by default.
 */

import { type ReactNode, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Tokens (also exported from design-system, kept inline here for ease) ──────
const EASE_PREMIUM: [number, number, number, number] = [0.22, 1, 0.36, 1];

const GRAIN_SVG_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")";

// ─────────────────────────────────────────────────────────────────────────────
// EditorialAtmosphere — ambient cinematic backdrop (blurred orbs + top wash)
// ─────────────────────────────────────────────────────────────────────────────
interface AtmosphereProps {
  className?: string;
  /** When true, expands outside the canvas (uses -inset-16). Default true. */
  bleed?: boolean;
}

export function EditorialAtmosphere({ className, bleed = true }: AtmosphereProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10",
        bleed ? "-inset-16" : "inset-0",
        className,
      )}
    >
      <div className="absolute left-[8%] top-[10%] h-[420px] w-[420px] rounded-full bg-[hsl(215_100%_55%/0.18)] blur-[140px]" />
      <div className="absolute right-[4%] bottom-[8%] h-[360px] w-[360px] rounded-full bg-[hsl(215_100%_60%/0.10)] blur-[160px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,hsl(var(--foreground)/0.06),transparent_60%)]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialChrome — mac-window title bar with breadcrumb + timecode
// ─────────────────────────────────────────────────────────────────────────────
interface ChromeProps {
  /** Centered breadcrumb segments. e.g. ["Small Bridges", "studio", projectSlug] */
  crumbs?: ReactNode[];
  /** Right-side timecode / status text. e.g. "REC · 01:01" */
  timecode?: ReactNode;
  className?: string;
}

export function EditorialChrome({ crumbs, timecode, className }: ChromeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border/30 bg-[hsl(var(--foreground)/0.015)] px-6 h-12",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
      </div>
      {crumbs && crumbs.length > 0 && (
        <div className="mx-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
          <span className="text-accent/80">◆</span>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-3">
              {i > 0 && <span className="text-muted-foreground/30">·</span>}
              <span className={i === crumbs.length - 1 ? "text-foreground/85" : ""}>{c}</span>
            </span>
          ))}
        </div>
      )}
      {timecode && (
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">
          {timecode}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialEyebrow — "STEP 01 · BRIEF" small label with leading accent line
// ─────────────────────────────────────────────────────────────────────────────
interface EyebrowProps {
  children: ReactNode;
  className?: string;
  /** Tint of the leading rule + tracking. Default uses --accent. */
  tone?: "accent" | "muted";
}

export function EditorialEyebrow({ children, className, tone = "accent" }: EyebrowProps) {
  const isAccent = tone === "accent";
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[10px] uppercase tracking-[0.42em]",
        isAccent ? "text-accent/80" : "text-muted-foreground/70",
        className,
      )}
    >
      <span className={cn("h-px w-8", isAccent ? "bg-accent/40" : "bg-border/60")} />
      <span>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialHeadline — large gradient-bleed serif italic display headline
// ─────────────────────────────────────────────────────────────────────────────
interface HeadlineProps {
  children: ReactNode;
  className?: string;
  /** Size scale. Defaults to "xl" (the StartHero size). */
  size?: "md" | "lg" | "xl";
  as?: "h1" | "h2" | "h3";
}

export function EditorialHeadline({
  children,
  className,
  size = "xl",
  as = "h1",
}: HeadlineProps) {
  const Tag = as;
  const sizeCls = {
    md: "text-[28px] md:text-[40px] xl:text-[48px]",
    lg: "text-[34px] md:text-[52px] xl:text-[60px]",
    xl: "text-[42px] md:text-[64px] xl:text-[76px]",
  }[size];
  return (
    <Tag
      className={cn(
        "font-display leading-[0.98] tracking-[-0.025em] text-foreground",
        sizeCls,
        className,
      )}
      style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
    >
      <span className="italic font-light bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
        {children}
      </span>
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialCanvas — the full composed primitive
// ─────────────────────────────────────────────────────────────────────────────
interface CanvasProps {
  children: ReactNode;
  className?: string;
  /** Container max width. Defaults to 1180px (StartHero's). */
  maxWidth?: number | string;
  /** When provided, renders <EditorialChrome/> at the top. */
  chrome?: ChromeProps;
  /** When false, omits the ambient orbs (useful on dark full-bleed pages). */
  atmosphere?: boolean;
  /** When false, omits the entrance motion. Default true. */
  enter?: boolean;
  /** Inner body padding override. Defaults follow StartHero spacing. */
  bodyClassName?: string;
  /** Outer wrapper style override (e.g., custom margins). */
  style?: CSSProperties;
}

export function EditorialCanvas({
  children,
  className,
  maxWidth = 1180,
  chrome,
  atmosphere = true,
  enter = true,
  bodyClassName,
  style,
}: CanvasProps) {
  const reducedMotion = useReducedMotion();
  const Wrapper = enter ? motion.div : "div";
  const motionProps = enter
    ? {
        initial: reducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: EASE_PREMIUM },
      }
    : {};

  return (
    <Wrapper
      {...(motionProps as object)}
      className={cn("relative mx-auto w-full", className)}
      style={{
        maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        ...style,
      }}
    >
      {atmosphere && <EditorialAtmosphere />}

      <div
        className={cn(
          "group/canvas relative overflow-hidden rounded-[28px] border border-border/40",
          "bg-gradient-to-b from-card/50 via-card/20 to-card/5 backdrop-blur-2xl",
          // outer drop + accent glow + inner top hairline
          "shadow-[0_80px_200px_-50px_hsl(0_0%_0%/0.7),0_30px_80px_-30px_hsl(215_100%_50%/0.18),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]",
        )}
      >
        {/* SVG fractal grain — keeps gradients off banding */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay"
          style={{ backgroundImage: GRAIN_SVG_URL }}
        />
        {/* Inner luminous frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-px rounded-[27px] ring-1 ring-inset ring-[hsl(var(--foreground)/0.04)]"
        />
        {/* Corner registration brackets */}
        <div aria-hidden className="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l border-t border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r border-t border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute left-4 bottom-4 h-3 w-3 border-l border-b border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute right-4 bottom-4 h-3 w-3 border-r border-b border-accent/40" />

        {chrome && <EditorialChrome {...chrome} />}

        <div
          className={cn(
            "px-6 py-8 md:px-12 md:py-12 xl:px-16 xl:py-14",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </Wrapper>
  );
}

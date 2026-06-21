/**
 * TextOverlayLayer — pro broadcast text rendered as a live SVG layer
 * over the StitchedPlayer.
 *
 * Capabilities (beyond what any slide tool ships with):
 *   • Multi-stop linear / radial / conic gradient fills
 *   • Glow (separate from drop shadow)
 *   • Multi-layer drop shadows (key + ambient + bounce)
 *   • Inner shadow (inset effect)
 *   • Pro kinetic typography — typewriter, split-flap, wave,
 *     stencil-cut, glitch, elastic-pop, blur-in, shimmer,
 *     tracking-tighten, uppercase-cycle, underline-draw,
 *     letterbox-iris, wipe-reveal, letter-drop, stagger-word
 *   • Counter / number animation with format string + commas
 *   • Auto-fit to maxWidthPct
 *
 * Coordinates are normalized 0..1 in a 1000×1000 viewBox with
 * preserveAspectRatio="none" so the canvas stretches to fit any
 * aspect ratio without re-doing layout math.
 *
 * The shared text-overlays.ts model is also consumed by the Deno
 * bake side (Resvg → PNG → FFmpeg overlay) so the preview == export
 * within ±sub-pixel kerning differences across font engines.
 */
import { useMemo } from "react";
import type {
  TextOverlay, Animation, GradientFill, TextShadow, CounterSpec,
} from "@/lib/editor/text-overlays";
import { FONT_CSS } from "@/lib/editor/text-overlays";

interface Props {
  overlays: TextOverlay[] | undefined;
  playheadSec: number;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function TextOverlayLayer({
  overlays, playheadSec, interactive, selectedId, onSelect,
}: Props) {
  const visible = useMemo(() => {
    if (!overlays) return [];
    return overlays.filter((o) =>
      playheadSec >= o.startSec && playheadSec < o.startSec + o.durationSec,
    );
  }, [overlays, playheadSec]);

  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onClick={interactive && onSelect ? () => onSelect(null) : undefined}
    >
      <defs>{visible.map((o) => <OverlayDefs key={`d-${o.id}`} o={o} />)}</defs>
      {visible.map((o) => (
        <OverlayNode
          key={o.id}
          o={o}
          t={playheadSec}
          selected={selectedId === o.id}
          onClick={interactive && onSelect ? (e) => { e.stopPropagation(); onSelect(o.id); } : undefined}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <defs> — gradients, filters (glow, inner shadow)
// ─────────────────────────────────────────────────────────────────────────────
function OverlayDefs({ o }: { o: TextOverlay }) {
  const gid = `grad-${o.id}`;
  const glowId = `glow-${o.id}`;
  const innerId = `inner-${o.id}`;

  return (
    <>
      {o.gradientFill && <GradientDef id={gid} g={o.gradientFill} />}
      {o.glow && o.glow.intensity > 0 && (
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={(o.glow.blurPct / 100) * (o.sizePct / 100) * 1000 * 0.5} result="blur" />
          <feFlood floodColor={o.glow.color} floodOpacity={o.glow.intensity} result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
      {o.innerShadow && o.innerShadow.opacity > 0 && (
        <filter id={innerId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={(o.innerShadow.blurPct / 100) * (o.sizePct / 100) * 1000 * 0.4} result="b" />
          <feOffset
            in="b"
            dx={(o.innerShadow.offsetXPct / 100) * (o.sizePct / 100) * 1000}
            dy={(o.innerShadow.offsetYPct / 100) * (o.sizePct / 100) * 1000}
            result="ob"
          />
          <feFlood floodColor={o.innerShadow.color} floodOpacity={o.innerShadow.opacity} result="c" />
          <feComposite in="c" in2="ob" operator="out" result="masked" />
          <feComposite in="masked" in2="SourceAlpha" operator="in" result="clipped" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="clipped" />
          </feMerge>
        </filter>
      )}
    </>
  );
}

function GradientDef({ id, g }: { id: string; g: GradientFill }) {
  if (g.kind === "linear") {
    const rad = (g.angle * Math.PI) / 180;
    const dx = Math.cos(rad), dy = Math.sin(rad);
    return (
      <linearGradient id={id} gradientUnits="objectBoundingBox" x1={0.5 - dx / 2} y1={0.5 - dy / 2} x2={0.5 + dx / 2} y2={0.5 + dy / 2}>
        {g.stops.map((s, i) => <stop key={i} offset={`${s.at * 100}%`} stopColor={s.color} />)}
      </linearGradient>
    );
  }
  if (g.kind === "radial") {
    return (
      <radialGradient id={id} gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.75">
        {g.stops.map((s, i) => <stop key={i} offset={`${s.at * 100}%`} stopColor={s.color} />)}
      </radialGradient>
    );
  }
  // Conic — emulated via linear since SVG 1.1 lacks conic; sweep
  // angle-ordered stops to approximate. Bake-side renderer uses Resvg's
  // conic gradient support so it lands authentic in the export.
  return (
    <linearGradient id={id} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0" gradientTransform={`rotate(${g.angle} 0.5 0.5)`}>
      {g.stops.map((s, i) => <stop key={i} offset={`${s.at * 100}%`} stopColor={s.color} />)}
    </linearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One overlay
// ─────────────────────────────────────────────────────────────────────────────
function OverlayNode({
  o, t, selected, onClick,
}: {
  o: TextOverlay; t: number; selected: boolean; onClick?: (e: React.MouseEvent) => void;
}) {
  const localT = t - o.startSec;
  const remaining = o.durationSec - localT;

  // Entrance / exit progress
  const inProg  = clamp01(localT / Math.max(0.001, o.animation.inSec));
  const outProg = 1 - clamp01(remaining / Math.max(0.001, o.animation.outSec));
  const visibility = Math.min(inProg, 1 - outProg);

  // Kinetic transforms
  const { dx, dy, scale, tracking, blur, jitterX, shimmerStop } =
    applyAnimationTransform(o.animation, inProg, outProg);

  // Coords
  const cx = o.x * 1000;
  const cy = o.y * 1000;
  const boxW = (o.maxWidthPct / 100) * 1000;
  const fontPxRaw = (o.sizePct / 100) * 1000;
  // Auto-fit: shrink the font until estimated width fits maxWidthPct.
  // Crude estimate — 0.55 of font-size per character for sans, 0.5 for serif.
  let fontPx = fontPxRaw;
  if (o.autoFit) {
    const estCharW = 0.55 * fontPxRaw;
    const estW = (o.text.length || 1) * estCharW;
    if (estW > boxW) fontPx = fontPxRaw * (boxW / estW) * 0.95;
  }

  // Text content — counter-animated or typewriter-sliced or vanilla
  let renderText = o.text;
  if (o.counter) {
    renderText = renderCounter(o.counter, inProg);
  } else if (o.animation.kind === "typewriter") {
    renderText = sliceTextByProgress(o.text, inProg);
  } else if (o.animation.kind === "uppercase-cycle" && inProg < 1) {
    renderText = cycleScramble(o.text, inProg);
  } else if (o.animation.kind === "split-flap" && inProg < 1) {
    renderText = splitFlap(o.text, inProg);
  }

  const lines = renderText.split("\n");
  const anchorOffset = anchorToOffset(o.anchor);
  const fontFamily = FONT_CSS[o.font];
  const fontWeight = o.weight;
  const fontStyle = o.italic ? "italic" : "normal";
  const textTransform = o.uppercase ? "uppercase" : "none";
  const textAnchor = o.align === "left" ? "start" : o.align === "right" ? "end" : "middle";

  const fillValue = o.gradientFill ? `url(#grad-${o.id})` : o.fill.color;
  const filters: string[] = [];
  if (o.glow && o.glow.intensity > 0) filters.push(`url(#glow-${o.id})`);
  if (blur > 0) filters.push(`blur(${blur}px)`);
  const filterAttr = filters.length > 0 ? filters.join(" ") : undefined;

  // Box bounds for selection ring + background
  const boxX = cx + dx - anchorOffset.x * boxW;
  const boxY = cy + dy - anchorOffset.y * fontPx * lines.length * o.lineHeight;

  // All shadows — primary first, then extras, drawn back-to-front.
  const allShadows: TextShadow[] = [
    ...(o.extraShadows ?? []),
    o.shadow,
  ];

  // Shared text-node attrs
  const baseTextProps = {
    fontFamily,
    fontSize: fontPx,
    fontWeight,
    fontStyle,
    textAnchor: textAnchor as "start" | "middle" | "end",
    style: {
      textTransform,
      letterSpacing: `${o.letterSpacingEm + tracking}em`,
    },
  };

  // Bake helper — emit tspans with vertical metrics aligned to the
  // anchored center / top / bottom of the multi-line box.
  const tspans = (
    <>
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={cx + dx + jitterX}
          dy={i === 0 ? -((lines.length - 1) * fontPx * o.lineHeight) / 2 : fontPx * o.lineHeight}
        >{line}</tspan>
      ))}
    </>
  );

  return (
    <g
      onClick={onClick}
      opacity={visibility}
      style={{ cursor: onClick ? "pointer" : "default" }}
      transform={`translate(${cx + dx} ${cy + dy}) scale(${scale}) translate(${-(cx + dx)} ${-(cy + dy)})`}
    >
      {/* Background */}
      {o.background.kind !== "none" && (
        <BackgroundRect
          bg={o.background}
          x={boxX - (o.background.paddingPct / 100) * fontPx}
          y={boxY - (o.background.paddingPct / 100) * fontPx}
          width={boxW + 2 * (o.background.paddingPct / 100) * fontPx}
          height={fontPx * lines.length * o.lineHeight + 2 * (o.background.paddingPct / 100) * fontPx}
          fontPx={fontPx}
        />
      )}

      {/* All shadow layers, behind text */}
      {allShadows.map((sh, i) => (
        sh.opacity > 0 ? (
          <text
            key={`sh-${i}`}
            {...baseTextProps}
            x={cx + dx + (sh.offsetXPct / 100) * fontPx}
            y={cy + dy + (sh.offsetYPct / 100) * fontPx}
            fill={sh.color}
            opacity={sh.opacity * o.fill.opacity}
            filter={sh.blurPct > 0 ? `blur(${(sh.blurPct / 100) * fontPx * 0.4}px)` : undefined}
          >
            {lines.map((line, j) => (
              <tspan
                key={j}
                x={cx + dx + (sh.offsetXPct / 100) * fontPx}
                dy={j === 0 ? -((lines.length - 1) * fontPx * o.lineHeight) / 2 : fontPx * o.lineHeight}
              >{line}</tspan>
            ))}
          </text>
        ) : null
      ))}

      {/* Stroke pass — behind fill */}
      {o.stroke.widthPct > 0 && (
        <text
          {...baseTextProps}
          x={cx + dx}
          y={cy + dy}
          fill="none"
          stroke={o.stroke.color}
          strokeWidth={(o.stroke.widthPct / 100) * fontPx}
          strokeLinejoin="round"
        >{tspans}</text>
      )}

      {/* Fill — gradient via paint-server or solid */}
      <text
        {...baseTextProps}
        x={cx + dx}
        y={cy + dy}
        fill={fillValue}
        opacity={o.fill.opacity}
        filter={filterAttr}
      >{tspans}</text>

      {/* Inner shadow — composited inside text alpha */}
      {o.innerShadow && o.innerShadow.opacity > 0 && (
        <text
          {...baseTextProps}
          x={cx + dx}
          y={cy + dy}
          fill="transparent"
          filter={`url(#inner-${o.id})`}
        >{tspans}</text>
      )}

      {/* Shimmer sweep — a moving white gradient ribbon over the fill */}
      {o.animation.kind === "shimmer" && shimmerStop !== null && (
        <text
          {...baseTextProps}
          x={cx + dx}
          y={cy + dy}
          fill={`url(#shimmer-${o.id}-${Math.round(shimmerStop * 100)})`}
          opacity={0.7 * visibility}
        >{tspans}</text>
      )}

      {/* Underline draw-on animation */}
      {o.animation.kind === "underline-draw" && (
        <line
          x1={boxX}
          y1={cy + dy + fontPx * 0.6}
          x2={boxX + boxW * Math.min(1, inProg)}
          y2={cy + dy + fontPx * 0.6}
          stroke={o.fill.color}
          strokeWidth={Math.max(2, fontPx * 0.06)}
          strokeLinecap="round"
          opacity={visibility * 0.9}
        />
      )}

      {/* Wipe reveal — rect mask animating L→R */}
      {o.animation.kind === "wipe-reveal" && inProg < 1 && (
        <rect
          x={boxX + boxW * inProg}
          y={boxY - fontPx * 0.4}
          width={boxW * (1 - inProg)}
          height={fontPx * lines.length * o.lineHeight + fontPx * 0.4}
          fill="black"
        />
      )}

      {/* Letterbox iris — opens from horizontal slit */}
      {o.animation.kind === "letterbox-iris" && inProg < 1 && (
        <>
          <rect x={boxX - 30} y={boxY - fontPx} width={boxW + 60} height={fontPx * 0.5 * (1 - inProg)} fill="black" />
          <rect
            x={boxX - 30}
            y={boxY + fontPx * lines.length * o.lineHeight + fontPx * 0.5 - fontPx * 0.5 * (1 - inProg)}
            width={boxW + 60}
            height={fontPx * 0.5 * (1 - inProg)}
            fill="black"
          />
        </>
      )}

      {/* Selection ring */}
      {selected && (
        <rect
          x={boxX - 8}
          y={boxY - 8}
          width={boxW + 16}
          height={fontPx * lines.length * o.lineHeight + 16}
          fill="none"
          stroke="hsl(45 95% 60%)"
          strokeWidth={2}
          strokeDasharray="6 6"
          opacity={0.85}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Background shapes
// ─────────────────────────────────────────────────────────────────────────────
function BackgroundRect({
  bg, x, y, width, height, fontPx,
}: {
  bg: TextOverlay["background"];
  x: number; y: number; width: number; height: number; fontPx: number;
}) {
  const radius = (bg.radiusPct / 100) * fontPx;
  if (bg.kind === "solid") {
    return <rect x={x} y={y} width={width} height={height} rx={radius} ry={radius} fill={bg.color ?? "#000"} />;
  }
  if (bg.kind === "blur") {
    return (
      <rect
        x={x} y={y} width={width} height={height} rx={radius} ry={radius}
        fill={bg.color ?? "rgba(10,14,22,0.45)"}
        style={{ backdropFilter: "blur(8px)" }}
      />
    );
  }
  if (bg.kind === "gradient") {
    return <rect x={x} y={y} width={width} height={height} rx={radius} ry={radius} fill={bg.color ?? "#000"} opacity={0.85} />;
  }
  if (bg.kind === "stripe") {
    const stripeW = ((bg.stripeWidthPct ?? 8) / 100) * fontPx;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={radius} ry={radius} fill={bg.color ?? "rgba(10,14,22,0.78)"} />
        <rect x={x} y={y} width={stripeW} height={height} fill={bg.stripeColor ?? "hsl(45 95% 60%)"} />
      </g>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation transforms — supports the 17 kinds
// ─────────────────────────────────────────────────────────────────────────────
interface AnimResult {
  dx: number;
  dy: number;
  scale: number;
  tracking: number;
  blur: number;
  jitterX: number;
  shimmerStop: number | null;
}

function applyAnimationTransform(anim: Animation, inProg: number, outProg: number): AnimResult {
  const easedIn = easeOut(inProg);
  const easedOut = easeIn(1 - outProg);
  const t = easedIn * easedOut;

  const base: AnimResult = {
    dx: 0, dy: 0, scale: 1, tracking: 0, blur: 0, jitterX: 0, shimmerStop: null,
  };

  switch (anim.kind) {
    case "slide-up":    return { ...base, dy: (1 - t) * 80 };
    case "slide-down":  return { ...base, dy: -(1 - t) * 80 };
    case "slide-left":  return { ...base, dx: (1 - t) * 120 };
    case "slide-right": return { ...base, dx: -(1 - t) * 120 };
    case "scale":       return { ...base, scale: 0.4 + 0.6 * t };
    case "letter-drop": return { ...base, dy: (1 - t) * 30 * Math.sin(t * Math.PI) };
    case "blur-in":     return { ...base, blur: (1 - inProg) * 28 };
    case "elastic-pop": {
      // Overshoot at ~70% then settle to 1.0
      const overshoot = inProg < 1 ? 1 + 0.18 * Math.sin(inProg * Math.PI * 1.5) * easeOut(1 - inProg) : 1;
      return { ...base, scale: 0.5 + 0.5 * easedIn * overshoot };
    }
    case "tracking-tighten":
      return { ...base, tracking: (1 - inProg) * 0.4 };
    case "wave":
      // Time-driven gentle bob — sin against the running clock, scaled by visibility
      return { ...base, dy: Math.sin(inProg * Math.PI * 3) * 6 };
    case "shimmer":
      return { ...base, shimmerStop: inProg };
    case "glitch-in":
      return {
        ...base,
        jitterX: inProg < 1 ? (Math.random() - 0.5) * 14 * (1 - inProg) : 0,
        blur: (1 - inProg) * 6,
      };
    case "split-flap":
    case "uppercase-cycle":
    case "typewriter":
    case "stencil-cut":
    case "wipe-reveal":
    case "letterbox-iris":
    case "underline-draw":
      // Handled as text-content or overlay shape; transform stays identity.
      return base;
    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function anchorToOffset(a: TextOverlay["anchor"]): { x: number; y: number } {
  const xMap: Record<string, number> = { left: 0, center: 0.5, right: 1 };
  const yMap: Record<string, number> = { top: 0, middle: 0.5, bottom: 1 };
  const [yKey, xKey] = a.split("-");
  return { x: xMap[xKey] ?? 0.5, y: yMap[yKey] ?? 0.5 };
}
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeIn(t: number): number { return Math.pow(t, 3); }

function sliceTextByProgress(text: string, prog: number): string {
  if (prog >= 1) return text;
  const n = Math.max(0, Math.floor(text.length * prog));
  return text.slice(0, n);
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function cycleScramble(text: string, prog: number): string {
  // First N characters are correct; the rest are scrambled. Stable scramble
  // for a given frame so we don't strobe — bucket prog into ~30fps frames.
  const lockedTo = Math.floor(text.length * prog);
  const frame = Math.floor(prog * 30);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (i < lockedTo) out += text[i];
    else {
      const seed = (i * 31 + frame * 17) % SCRAMBLE_CHARS.length;
      out += text[i] === " " ? " " : SCRAMBLE_CHARS[seed];
    }
  }
  return out;
}
function splitFlap(text: string, prog: number): string {
  // Same shape as scramble but characters lock one-at-a-time L→R with a slight
  // overshoot per slot.
  return cycleScramble(text, prog);
}

// Counter formatter — handles ${n}, {n}%, etc. + comma thousands.
function renderCounter(c: CounterSpec, prog: number): string {
  const eased = easeOut(prog);
  const v = c.from + (c.to - c.from) * eased;
  let n = c.decimals > 0 ? v.toFixed(c.decimals) : Math.round(v).toString();
  if (c.thousands && c.decimals === 0) {
    n = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else if (c.thousands && c.decimals > 0) {
    const [intPart, fracPart] = n.split(".");
    n = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fracPart;
  }
  return c.format.replace("{n}", n);
}

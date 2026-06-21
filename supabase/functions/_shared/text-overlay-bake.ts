/**
 * text-overlay-bake — pure Deno SVG generator for TextOverlay.
 *
 * Mirrors the React TextOverlayLayer renderer so live preview == bake.
 * Output is a standalone SVG string that the rasterize worker turns
 * into a PNG, which seamless-stitcher then `overlay=`s onto the video
 * at the right timecode via `enable='between(t,start,end)'`.
 *
 * Coordinate convention: SVG viewBox is the project canvas in pixels
 * (e.g. 1920×1080 for 16:9 at 1080p). All TextOverlay coordinates are
 * normalized 0..1 and we scale them here so the bake matches the
 * preview at any aspect ratio.
 *
 * What this renderer supports vs. the live preview:
 *   • Gradient fills (linear/radial — conic falls back to linear)
 *   • Drop shadows (multi-layer + primary)
 *   • Inner shadow
 *   • Glow filter
 *   • Background (solid / blur (rendered as solid) / stripe)
 *   • Strokes
 *   • All static-state typography (font, weight, italic, tracking,
 *     line-height, uppercase, alignment, max-width, anchor)
 *
 * What does NOT yet bake (rendered as the static end-state instead):
 *   • Animation transforms (slide/scale/blur — clamps to t=1)
 *   • Typewriter / scramble / split-flap text rewrites — bakes full
 *     text on screen for the whole window
 *   • Wipe / iris / underline-draw — bakes the final reveal
 *   • Shimmer / glitch dynamics
 *   Animation bake = phase 2; static state is enough to make the
 *   overlay visible on the export.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shape mirror — keep in sync with src/lib/editor/text-overlays.ts
// ─────────────────────────────────────────────────────────────────────────────

export type FontFamily =
  | "fraunces" | "inter" | "space-mono" | "playfair"
  | "bebas-neue" | "ibm-plex-mono" | "dm-serif";

export type Anchor =
  | "top-left"   | "top-center"    | "top-right"
  | "middle-left"| "middle-center" | "middle-right"
  | "bottom-left"| "bottom-center" | "bottom-right";

export interface BakeOverlay {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  x: number; y: number;
  anchor: Anchor;
  maxWidthPct: number;
  align: "left" | "center" | "right";
  font: FontFamily;
  weight: number;
  italic: boolean;
  sizePct: number;
  letterSpacingEm: number;
  lineHeight: number;
  uppercase: boolean;
  fill: { color: string; opacity: number };
  gradientFill?: { kind: "linear" | "radial" | "conic"; angle: number; stops: Array<{ at: number; color: string }> } | null;
  stroke: { color: string; widthPct: number };
  shadow: { color: string; offsetXPct: number; offsetYPct: number; blurPct: number; opacity: number };
  extraShadows?: Array<{ color: string; offsetXPct: number; offsetYPct: number; blurPct: number; opacity: number }>;
  innerShadow?: { color: string; offsetXPct: number; offsetYPct: number; blurPct: number; opacity: number } | null;
  glow?: { color: string; blurPct: number; intensity: number } | null;
  background: {
    kind: "none" | "solid" | "gradient" | "blur" | "stripe";
    color?: string;
    paddingPct: number;
    radiusPct: number;
    stripeColor?: string;
    stripeWidthPct?: number;
  };
  counter?: { from: number; to: number; format: string; decimals: number; thousands: boolean } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FONT_CSS — system-safe fallbacks for the bake side
// ─────────────────────────────────────────────────────────────────────────────
// The rasterize worker doesn't have Fraunces/Playfair/DM-Serif installed;
// it falls back to a similar-genre system family for each. Premium font
// embedding via base64 WOFF2 lands in a later pass — for now the genre
// match keeps the look right and the export legible.
const FONT_CSS: Record<FontFamily, string> = {
  "fraunces":      "'Times New Roman', Georgia, serif",
  "inter":         "Arial, Helvetica, sans-serif",
  "space-mono":    "'Courier New', Courier, monospace",
  "playfair":      "Georgia, 'Times New Roman', serif",
  "bebas-neue":    "Impact, 'Arial Black', sans-serif",
  "ibm-plex-mono": "'Courier New', Courier, monospace",
  "dm-serif":      "Georgia, 'Times New Roman', serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// Builder — pure string, no DOM
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildOpts {
  /** Project canvas in pixels — e.g. 1920×1080. SVG viewBox matches. */
  canvasW: number;
  canvasH: number;
}

/** Build a self-contained SVG string for one overlay at its static
 *  end-state (post entrance animation). The output is ready to feed
 *  to Resvg or any standards-compliant SVG renderer. */
export function overlayToSvg(o: BakeOverlay, opts: BuildOpts): string {
  const { canvasW, canvasH } = opts;

  // Convert normalized → canvas pixels.
  const cx = o.x * canvasW;
  const cy = o.y * canvasH;
  const boxW = (o.maxWidthPct / 100) * canvasW;
  const fontPx = (o.sizePct / 100) * canvasH;

  // For animated content (typewriter / counter), render the END STATE.
  let text = o.text;
  if (o.counter) {
    text = renderCounter(o.counter, 1);
  }
  const lines = text.split("\n");

  const anchorOff = anchorToOffset(o.anchor);
  const fontFamily = FONT_CSS[o.font] ?? FONT_CSS["inter"];
  const fontStyle = o.italic ? "italic" : "normal";
  const textTransform = o.uppercase ? text.toUpperCase() : text;
  const textAnchor = o.align === "left" ? "start" : o.align === "right" ? "end" : "middle";

  // Pre-resolve transformed lines so we don't re-uppercase per pass.
  const renderLines = o.uppercase ? lines.map((l) => l.toUpperCase()) : lines;
  void textTransform;

  // Bounding box for background.
  const boxX = cx - anchorOff.x * boxW;
  const boxY = cy - anchorOff.y * fontPx * renderLines.length * o.lineHeight;

  // ── <defs> — gradient + glow + inner shadow ─────────────────────
  const defsParts: string[] = [];

  if (o.gradientFill) defsParts.push(buildGradientDef(`grad-${o.id}`, o.gradientFill));
  if (o.glow && o.glow.intensity > 0) defsParts.push(buildGlowFilter(`glow-${o.id}`, o.glow, fontPx));
  if (o.innerShadow && o.innerShadow.opacity > 0) {
    defsParts.push(buildInnerShadowFilter(`inner-${o.id}`, o.innerShadow, fontPx));
  }

  // ── Layers (back-to-front) ───────────────────────────────────────
  const layers: string[] = [];

  // Background
  if (o.background.kind !== "none") {
    layers.push(buildBackgroundRect(
      o.background,
      boxX - (o.background.paddingPct / 100) * fontPx,
      boxY - (o.background.paddingPct / 100) * fontPx,
      boxW + 2 * (o.background.paddingPct / 100) * fontPx,
      fontPx * renderLines.length * o.lineHeight + 2 * (o.background.paddingPct / 100) * fontPx,
      fontPx,
    ));
  }

  // Extra shadows then primary shadow — all behind the fill.
  const allShadows = [...(o.extraShadows ?? []), o.shadow].filter((s) => s && s.opacity > 0);
  for (const sh of allShadows) {
    layers.push(buildTextNode({
      x: cx + (sh.offsetXPct / 100) * fontPx,
      y: cy + (sh.offsetYPct / 100) * fontPx,
      lines: renderLines,
      lineHeight: o.lineHeight,
      fontPx, fontFamily, weight: o.weight, fontStyle, textAnchor,
      letterSpacingEm: o.letterSpacingEm,
      fill: sh.color,
      opacity: sh.opacity * o.fill.opacity,
      filter: sh.blurPct > 0 ? `blur(${(sh.blurPct / 100) * fontPx * 0.4})` : undefined,
    }));
  }

  // Stroke pass — behind fill.
  if (o.stroke.widthPct > 0) {
    layers.push(buildTextNode({
      x: cx, y: cy,
      lines: renderLines,
      lineHeight: o.lineHeight,
      fontPx, fontFamily, weight: o.weight, fontStyle, textAnchor,
      letterSpacingEm: o.letterSpacingEm,
      fill: "none",
      stroke: o.stroke.color,
      strokeWidth: (o.stroke.widthPct / 100) * fontPx,
      strokeLinejoin: "round",
    }));
  }

  // Fill — gradient via paint-server or solid.
  layers.push(buildTextNode({
    x: cx, y: cy,
    lines: renderLines,
    lineHeight: o.lineHeight,
    fontPx, fontFamily, weight: o.weight, fontStyle, textAnchor,
    letterSpacingEm: o.letterSpacingEm,
    fill: o.gradientFill ? `url(#grad-${o.id})` : o.fill.color,
    opacity: o.fill.opacity,
    filter: o.glow && o.glow.intensity > 0 ? `url(#glow-${o.id})` : undefined,
  }));

  // Inner shadow — composited inside text alpha.
  if (o.innerShadow && o.innerShadow.opacity > 0) {
    layers.push(buildTextNode({
      x: cx, y: cy,
      lines: renderLines,
      lineHeight: o.lineHeight,
      fontPx, fontFamily, weight: o.weight, fontStyle, textAnchor,
      letterSpacingEm: o.letterSpacingEm,
      fill: "transparent",
      filter: `url(#inner-${o.id})`,
    }));
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`,
    `<defs>${defsParts.join("")}</defs>`,
    layers.join(""),
    `</svg>`,
  ].join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Node builders
// ─────────────────────────────────────────────────────────────────────────────

interface TextNodeOpts {
  x: number; y: number;
  lines: string[];
  lineHeight: number;
  fontPx: number;
  fontFamily: string;
  weight: number;
  fontStyle: string;
  textAnchor: string;
  letterSpacingEm: number;
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: string;
  filter?: string;
}

function buildTextNode(o: TextNodeOpts): string {
  const attrs: string[] = [
    `x="${o.x.toFixed(1)}"`,
    `y="${o.y.toFixed(1)}"`,
    `font-family="${escAttr(o.fontFamily)}"`,
    `font-size="${o.fontPx.toFixed(1)}"`,
    `font-weight="${o.weight}"`,
    `font-style="${o.fontStyle}"`,
    `text-anchor="${o.textAnchor}"`,
    `fill="${escAttr(o.fill)}"`,
    `letter-spacing="${o.letterSpacingEm}em"`,
  ];
  if (o.opacity !== undefined) attrs.push(`opacity="${o.opacity}"`);
  if (o.stroke) attrs.push(`stroke="${escAttr(o.stroke)}"`);
  if (o.strokeWidth) attrs.push(`stroke-width="${o.strokeWidth.toFixed(2)}"`);
  if (o.strokeLinejoin) attrs.push(`stroke-linejoin="${o.strokeLinejoin}"`);
  if (o.filter) attrs.push(`filter="${o.filter}"`);

  const tspans = o.lines.map((line, i) => {
    const dy = i === 0
      ? -((o.lines.length - 1) * o.fontPx * o.lineHeight) / 2
      : o.fontPx * o.lineHeight;
    return `<tspan x="${o.x.toFixed(1)}" dy="${dy.toFixed(1)}">${escText(line)}</tspan>`;
  }).join("");

  return `<text ${attrs.join(" ")}>${tspans}</text>`;
}

function buildGradientDef(id: string, g: { kind: "linear" | "radial" | "conic"; angle: number; stops: Array<{ at: number; color: string }> }): string {
  const stops = g.stops.map((s) => `<stop offset="${(s.at * 100).toFixed(0)}%" stop-color="${escAttr(s.color)}"/>`).join("");
  if (g.kind === "radial") {
    return `<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.75">${stops}</radialGradient>`;
  }
  // Linear (and conic fallback).
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  return `<linearGradient id="${id}" gradientUnits="objectBoundingBox" x1="${(0.5 - dx / 2).toFixed(3)}" y1="${(0.5 - dy / 2).toFixed(3)}" x2="${(0.5 + dx / 2).toFixed(3)}" y2="${(0.5 + dy / 2).toFixed(3)}">${stops}</linearGradient>`;
}

function buildGlowFilter(id: string, g: { color: string; blurPct: number; intensity: number }, fontPx: number): string {
  const sd = ((g.blurPct / 100) * fontPx * 0.5).toFixed(1);
  return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${sd}" result="blur"/>
    <feFlood flood-color="${escAttr(g.color)}" flood-opacity="${g.intensity}" result="color"/>
    <feComposite in="color" in2="blur" operator="in" result="glow"/>
    <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

function buildInnerShadowFilter(id: string, s: { color: string; offsetXPct: number; offsetYPct: number; blurPct: number; opacity: number }, fontPx: number): string {
  const sd = ((s.blurPct / 100) * fontPx * 0.4).toFixed(1);
  const dx = ((s.offsetXPct / 100) * fontPx).toFixed(1);
  const dy = ((s.offsetYPct / 100) * fontPx).toFixed(1);
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${sd}" result="b"/>
    <feOffset in="b" dx="${dx}" dy="${dy}" result="ob"/>
    <feFlood flood-color="${escAttr(s.color)}" flood-opacity="${s.opacity}" result="c"/>
    <feComposite in="c" in2="ob" operator="out" result="masked"/>
    <feComposite in="masked" in2="SourceAlpha" operator="in" result="clipped"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="clipped"/></feMerge>
  </filter>`;
}

function buildBackgroundRect(
  bg: BakeOverlay["background"],
  x: number, y: number, w: number, h: number, fontPx: number,
): string {
  const r = (bg.radiusPct / 100) * fontPx;
  const radiusAttrs = r > 0 ? `rx="${r.toFixed(1)}" ry="${r.toFixed(1)}"` : "";
  const xy = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"`;
  if (bg.kind === "solid" || bg.kind === "gradient" || bg.kind === "blur") {
    return `<rect ${xy} ${radiusAttrs} fill="${escAttr(bg.color ?? "#000")}"/>`;
  }
  if (bg.kind === "stripe") {
    const stripeW = ((bg.stripeWidthPct ?? 8) / 100) * fontPx;
    return `<g>
      <rect ${xy} ${radiusAttrs} fill="${escAttr(bg.color ?? "rgba(10,14,22,0.78)")}"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${stripeW.toFixed(1)}" height="${h.toFixed(1)}" fill="${escAttr(bg.stripeColor ?? "hsl(45 95% 60%)")}"/>
    </g>`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function anchorToOffset(a: Anchor): { x: number; y: number } {
  const xMap: Record<string, number> = { left: 0, center: 0.5, right: 1 };
  const yMap: Record<string, number> = { top: 0, middle: 0.5, bottom: 1 };
  const [yKey, xKey] = a.split("-");
  return { x: xMap[xKey] ?? 0.5, y: yMap[yKey] ?? 0.5 };
}

function renderCounter(c: NonNullable<BakeOverlay["counter"]>, prog: number): string {
  const v = c.from + (c.to - c.from) * prog;
  let n = c.decimals > 0 ? v.toFixed(c.decimals) : Math.round(v).toString();
  if (c.thousands && c.decimals === 0) {
    n = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else if (c.thousands && c.decimals > 0) {
    const parts = n.split(".");
    n = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + parts[1];
  }
  return c.format.replace("{n}", n);
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

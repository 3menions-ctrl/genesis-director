/**
 * clip-css — translate a clip's post-prod properties into the CSS the
 * browser can apply live (filter + transform + opacity). Used by the
 * free, render-free timeline player so the Library/Reel preview matches
 * what the editor shows, without an FFmpeg bake.
 *
 * Color grade fidelity is whatever CSS can express (brightness,
 * contrast, saturate, hue-rotate, sepia, blur, …) — the same
 * approximation the editor's canvas preview uses via gradeToCss.
 */
import { gradeToCss } from "./color-grade-filters";
import { getLut } from "./lut-library";
import { getClipProperty, type EditorClip } from "./types";

/** CSS `filter` string for a clip — mirrors PlayerCanvas's preview
 *  composition exactly: the legacy preset filter PLUS the color-grade
 *  contribution (with its LUT resolved + folded into CSS). Combining
 *  both — and resolving the LUT — is what makes applied looks actually
 *  show in the free player. */
export function clipFilterCss(clip: EditorClip): string {
  const legacy = clip.properties?.filter ?? "";
  const grade = clip.properties?.colorGrade ?? null;
  if (!grade) return legacy;
  try {
    const lut = grade.lutId ? getLut(grade.lutId) ?? null : null;
    const gradeCss = gradeToCss(grade, lut);
    if (!gradeCss) return legacy;
    return legacy ? `${legacy} ${gradeCss}` : gradeCss;
  } catch {
    return legacy;
  }
}

/** CSS `transform` string for a clip — scale, position, rotation,
 *  mirror. Empty when the clip is untransformed. */
export function clipTransformCss(clip: EditorClip): string {
  const scale = getClipProperty(clip, "scale");
  const x = getClipProperty(clip, "positionX");
  const y = getClipProperty(clip, "positionY");
  const rotation = getClipProperty(clip, "rotation");
  const mirror = clip.properties?.mirror ?? false;

  const parts: string[] = [];
  if (x !== 0 || y !== 0) parts.push(`translate(${x}px, ${y}px)`);
  if (scale !== 1) parts.push(`scale(${scale})`);
  if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
  if (mirror) parts.push("scaleX(-1)");
  return parts.join(" ");
}

export interface ClipVisual {
  filter: string;
  transform: string;
  opacity: number;
}

/** Full visual style for a clip in one call. */
export function clipVisual(clip: EditorClip): ClipVisual {
  return {
    filter: clipFilterCss(clip),
    transform: clipTransformCss(clip),
    opacity: getClipProperty(clip, "opacity"),
  };
}

export interface ClipTransformParts {
  scale: number;
  x: number;
  y: number;
  rotationDeg: number;
  mirror: boolean;
  opacity: number;
}

/** Structured transform — for the canvas baker (which can't parse a CSS
 *  transform string). Same values clipTransformCss encodes. */
export function clipTransformParts(clip: EditorClip): ClipTransformParts {
  return {
    scale: getClipProperty(clip, "scale"),
    x: getClipProperty(clip, "positionX"),
    y: getClipProperty(clip, "positionY"),
    rotationDeg: getClipProperty(clip, "rotation"),
    mirror: clip.properties?.mirror ?? false,
    opacity: getClipProperty(clip, "opacity"),
  };
}

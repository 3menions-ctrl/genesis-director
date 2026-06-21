/**
 * EffectsOverlay — mounts on top of the PlayerCanvas video element
 * and renders every effect on the currently-active clip whose time
 * window contains the playhead.
 *
 * Sustained effects show for their entire duration. Stingers appear
 * briefly. Transitions are not handled here — they live on the
 * project's `transitions` array and are rendered by the transition
 * surface.
 */
import { useMemo } from "react";
import type { EditorClip } from "@/lib/editor/types";
import { effectProgress } from "@/lib/editor/effects";
import { EffectRenderer } from "./EffectRenderer";

interface Props {
  /** The clip the playhead is currently inside. */
  clip: EditorClip | null;
  /** Time within the clip, in seconds (0..clip.durationSec). */
  clipRelativeSec: number;
}

export function EffectsOverlay({ clip, clipRelativeSec }: Props) {
  const activeEffects = useMemo(() => {
    if (!clip?.effects?.length) return [];
    return clip.effects
      .filter(fx => fx.mode !== "transition")
      .map(fx => ({ fx, progress: effectProgress(fx, clipRelativeSec) }))
      .filter(e => e.progress >= 0);
  }, [clip, clipRelativeSec]);

  if (!activeEffects.length) return null;

  return (
    <>
      {activeEffects.map(({ fx, progress }) => (
        <EffectRenderer key={fx.id} fx={fx} progress={progress} />
      ))}
    </>
  );
}

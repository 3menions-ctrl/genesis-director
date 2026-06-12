/**
 * useLiveRenderTimecode — a shared helper that produces the chrome
 * timecode string used by every Foundation surface when a render is in
 * flight. Builds on useActiveProjects so realtime updates tick the
 * chrome in lockstep with the pipeline.
 *
 * Returns a formatted string like "CHERRY BLOSSOM · 47%" — or
 * "CHERRY BLOSSOM · 47% · +2" when multiple films are rendering.
 * Returns null when nothing is active so the calling surface can fall
 * back to its own idle timecode (e.g. "47 FILMS · 3 ACTIVE").
 *
 * Centralizing this so the Library / Studio / Account / Reel chrome
 * never disagree about render state.
 */
import { useMemo } from "react";
import { useActiveProjects } from "@/hooks/useActiveProjects";

export function useLiveRenderTimecode(): string | null {
  const { projects } = useActiveProjects();
  return useMemo(() => {
    if (projects.length === 0) return null;
    const lead = projects[0];
    const title =
      lead.title.length > 22 ? `${lead.title.slice(0, 22)}…` : lead.title;
    const rest = projects.length > 1 ? ` · +${projects.length - 1}` : "";
    return `${title.toUpperCase()} · ${lead.progress}%${rest}`;
  }, [projects]);
}

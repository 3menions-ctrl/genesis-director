/**
 * TemplatePreviewPlayer — Schematic pacing preview for catalog templates.
 *
 * Catalog templates have no real media yet, only metadata (clip_count,
 * target_duration_minutes, mood, genre). This component synthesizes a clip
 * schedule from those fields and animates a playhead across mood-tinted
 * segments so creators can sanity-check pacing & clip order before applying.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ArrowRight, Film, Clock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TemplateLike {
  id: string;
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  clip_count?: number | null;
  target_duration_minutes?: number | null;
  mood?: string | null;
  genre?: string | null;
}

interface Props {
  template: TemplateLike | null;
  onClose: () => void;
  onApply: (t: TemplateLike) => void;
}

// Mood → HSL accent (kept inside the locked blue-leaning palette).
const MOOD_ACCENT: Record<string, string> = {
  uplifting: "215 100% 62%",
  epic: "210 100% 55%",
  calm: "200 60% 55%",
  dramatic: "220 80% 50%",
  default: "215 100% 60%",
};

// Generate a deterministic but visually varied segment distribution from id.
function buildSegments(id: string, clipCount: number, totalSec: number) {
  // Seeded weights so the same template always renders the same pacing.
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < clipCount; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    // 0.6 – 1.6 weight range so segments differ but no extreme outliers.
    const w = 0.6 + (h % 1000) / 1000;
    weights.push(w);
    sum += w;
  }
  let cursor = 0;
  return weights.map((w, i) => {
    const dur = (w / sum) * totalSec;
    const seg = {
      idx: i,
      label: i === 0 ? "Hook" : i === clipCount - 1 ? "Payoff" : `Beat ${i}`,
      start: cursor,
      end: cursor + dur,
      duration: dur,
    };
    cursor += dur;
    return seg;
  });
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const TemplatePreviewPlayer = memo(function TemplatePreviewPlayer({
  template,
  onClose,
  onApply,
}: Props) {
  const open = !!template;

  const totalSec = Math.max(15, (template?.target_duration_minutes ?? 1) * 60);
  const clipCount = Math.max(2, template?.clip_count ?? 4);
  const accent = MOOD_ACCENT[template?.mood ?? "default"] ?? MOOD_ACCENT.default;

  const segments = useMemo(
    () => (template ? buildSegments(template.id, clipCount, totalSec) : []),
    [template, clipCount, totalSec]
  );

  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Reset playback whenever the previewed template changes / dialog opens.
  useEffect(() => {
    setT(0);
    setPlaying(open);
  }, [open, template?.id]);

  // rAF loop — schematic playback at 4x real time so a 3-min preview
  // scrubs in ~45s without feeling sluggish.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const PLAYBACK_RATE = 4;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setT((prev) => {
        const next = prev + dt * PLAYBACK_RATE;
        if (next >= totalSec) {
          setPlaying(false);
          return totalSec;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, totalSec]);

  const activeIdx = useMemo(() => {
    const i = segments.findIndex((s) => t >= s.start && t < s.end);
    return i === -1 ? Math.max(0, segments.length - 1) : i;
  }, [t, segments]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      setT(ratio * totalSec);
    },
    [totalSec]
  );

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[hsl(220,14%,4%)] border-[hsla(215,100%,60%,0.18)] text-white p-0 overflow-hidden">
        {/* Header strip with hero thumb */}
        <div className="relative h-44 w-full overflow-hidden">
          {template.thumbnail_url ? (
            <img
              src={template.thumbnail_url}
              alt={template.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[hsl(220,14%,6%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,14%,4%)] via-[hsla(220,14%,4%,0.6)] to-transparent" />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background: `radial-gradient(ellipse at 50% 100%, hsla(${accent}, 0.35), transparent 65%)`,
            }}
          />
          <DialogHeader className="absolute bottom-3 left-5 right-5 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">
              {template.name}
            </DialogTitle>
            {template.description && (
              <p className="text-xs text-white/65 line-clamp-2 mt-1">
                {template.description}
              </p>
            )}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Stat chips */}
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
              <Film className="w-3 h-3" /> {clipCount} clips
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
              <Clock className="w-3 h-3" /> {fmt(totalSec)}
            </span>
            {template.mood && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] capitalize">
                <Sparkles className="w-3 h-3" /> {template.mood}
              </span>
            )}
            <span className="ml-auto text-white/35">
              schematic preview · no media
            </span>
          </div>

          {/* Active segment label */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Now playing
              </div>
              <div className="text-base font-medium text-white/90 mt-0.5">
                {segments[activeIdx]?.label ?? "—"}
                <span className="text-white/40 text-xs ml-2">
                  {fmt(segments[activeIdx]?.start ?? 0)} –{" "}
                  {fmt(segments[activeIdx]?.end ?? 0)}
                </span>
              </div>
            </div>
            <div className="font-mono text-xs text-white/45">
              {fmt(t)} / {fmt(totalSec)}
            </div>
          </div>

          {/* Schematic timeline */}
          <div
            onClick={seek}
            className="relative h-14 rounded-lg bg-[hsl(220,14%,6%)] border border-white/[0.05] cursor-pointer overflow-hidden flex"
          >
            {segments.map((s, i) => {
              const isActive = i === activeIdx;
              return (
                <div
                  key={s.idx}
                  style={{
                    flex: `${s.duration} 0 0`,
                    background: isActive
                      ? `linear-gradient(180deg, hsla(${accent}, 0.45), hsla(${accent}, 0.18))`
                      : `linear-gradient(180deg, hsla(${accent}, 0.10), hsla(${accent}, 0.04))`,
                    borderRight:
                      i < segments.length - 1
                        ? "1px solid hsla(220, 14%, 2%, 0.7)"
                        : undefined,
                  }}
                  className={cn(
                    "relative flex items-center justify-center text-[10px] font-mono transition-colors",
                    isActive ? "text-white/90" : "text-white/35"
                  )}
                >
                  <span className="truncate px-1">{s.label}</span>
                </div>
              );
            })}
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px pointer-events-none"
              style={{
                left: `${(t / totalSec) * 100}%`,
                background: `hsl(${accent})`,
                boxShadow: `0 0 10px hsla(${accent}, 0.9)`,
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPlaying((p) => !p)}
              className="bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08] hover:text-white"
            >
              {playing ? (
                <><Pause className="w-3.5 h-3.5 mr-1.5" /> Pause</>
              ) : (
                <><Play className="w-3.5 h-3.5 mr-1.5" /> Play</>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setT(0); setPlaying(true); }}
              className="text-white/60 hover:text-white hover:bg-white/[0.05]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restart
            </Button>
            <div className="ml-auto" />
            <Button
              type="button"
              size="sm"
              onClick={() => { onApply(template); onClose(); }}
              className="bg-[hsl(215,100%,55%)] hover:bg-[hsl(215,100%,60%)] text-white shadow-[0_8px_24px_-8px_hsla(215,100%,60%,0.7)]"
            >
              Use template <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default TemplatePreviewPlayer;
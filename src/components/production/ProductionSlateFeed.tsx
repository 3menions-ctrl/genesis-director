/**
 * ProductionSlateFeed — the cinematic generation experience.
 *
 * Replaces the generic "Production in progress" spinner with a real
 * dailies feed: every shot under generation shows up as a film slate
 * (12A · TAKE 1, 12A · TAKE 2…) with status. Completed takes drop into
 * the timeline below; in-flight takes pulse softly; failures get a tasteful
 * red strip with a one-click retry.
 *
 * Driven entirely by `video_clips` + `shot_takes` rows for the current
 * project. Reading from existing tables — no new generation backend needed
 * for the visual transformation.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export interface SlateClip {
  id: string;
  shot_index: number | null;
  take_number?: number;
  status: 'pending' | 'generating' | 'completed' | 'failed' | string;
  thumbnail_url?: string | null;
  video_url?: string | null;
  prompt?: string | null;
  duration_seconds?: number | null;
  started_at?: string | null;
  error_message?: string | null;
}

interface Props {
  /** Project title — surfaces in the slate's "PROD." line. */
  projectTitle?: string;
  /** All clips + takes for this project. Ordered by shot index. */
  clips: SlateClip[];
  /** Expected total shots for this production. */
  expectedShots: number;
  /** Eyebrow date / shoot-day label. */
  shootDay?: string;
  /** Optional retry handler — fires with the failing clip's id. */
  onRetryShot?: (clipId: string) => void;
  /** Optional "three more takes" handler — fires with the source clip id. */
  onMoreTakes?: (clipId: string) => void;
}

export function ProductionSlateFeed({
  projectTitle = 'Small Bridges Project',
  clips,
  expectedShots,
  shootDay,
  onRetryShot,
  onMoreTakes,
}: Props) {
  const sorted = useMemo(
    () => [...clips].sort((a, b) => (a.shot_index ?? 0) - (b.shot_index ?? 0)),
    [clips],
  );
  const completed = sorted.filter((c) => c.status === 'completed').length;
  const generating = sorted.filter((c) => c.status === 'generating' || c.status === 'pending').length;
  const failed = sorted.filter((c) => c.status === 'failed').length;

  return (
    <div className="space-y-8">
      {/* Sticky production-board header */}
      <div className="relative rounded-3xl border border-white/[0.08] bg-[hsl(0_0%_3%/0.9)] backdrop-blur-xl overflow-hidden">
        {/* Clapper stripe */}
        <div
          aria-hidden
          className="h-2 bg-[repeating-linear-gradient(115deg,#fff_0_14px,#000_14px_28px)] opacity-[0.85]"
        />
        <div className="p-6 lg:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/35">
                PROD. {projectTitle}
              </span>
              {shootDay && (
                <>
                  <span className="h-px w-6 bg-white/10" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/35">
                    {shootDay}
                  </span>
                </>
              )}
            </div>
            <h2
              className="font-display text-[26px] sm:text-[32px] text-white font-light leading-tight"
              style={{ fontVariant: 'small-caps' }}
            >
              The Production Board
            </h2>
            <p className="text-white/55 text-[12.5px] mt-2">
              Every take logs as it lands. Pause, retry, request alternates — like dailies in a real production.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-5 sm:gap-7 shrink-0">
            <Counter label="Live" value={generating} tone="amber" />
            <Counter label="In Can" value={completed} tone="emerald" />
            <Counter
              label="Total"
              value={`${completed}/${expectedShots}`}
              tone="neutral"
            />
          </div>
        </div>
        {failed > 0 && (
          <div className="px-6 pb-4 -mt-2 flex items-center gap-2 text-[11px] text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            {failed} take{failed === 1 ? '' : 's'} need attention
          </div>
        )}
      </div>

      {/* Slate stack — one card per shot, takes nested */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {Array.from({ length: Math.max(expectedShots, sorted.length) }).map((_, idx) => {
            const shotClips = sorted.filter((c) => (c.shot_index ?? 0) === idx);
            // Placeholder shot row — not yet started.
            if (shotClips.length === 0) {
              return (
                <SlateRow key={`empty-${idx}`}
                  shotIndex={idx}
                  status="pending"
                />
              );
            }
            const primary = shotClips.find((c) => c.status === 'completed') ?? shotClips[shotClips.length - 1];
            return (
              <SlateRow
                key={primary.id}
                clip={primary}
                allTakes={shotClips}
                shotIndex={idx}
                status={primary.status}
                onRetry={() => onRetryShot?.(primary.id)}
                onMoreTakes={() => onMoreTakes?.(primary.id)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'amber' | 'emerald' | 'neutral' | 'rose';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-300'
      : tone === 'emerald'
        ? 'text-emerald-300'
        : tone === 'rose'
          ? 'text-rose-300'
          : 'text-white';
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/35 mb-1.5">
        {label}
      </div>
      <div className={cn('text-2xl font-display font-light tabular-nums', toneClass)}>
        {value}
      </div>
    </div>
  );
}

function SlateRow({
  clip,
  allTakes,
  shotIndex,
  status,
  onRetry,
  onMoreTakes,
}: {
  clip?: SlateClip;
  allTakes?: SlateClip[];
  shotIndex: number;
  status: string;
  onRetry?: () => void;
  onMoreTakes?: () => void;
}) {
  const shotCode = `${String(shotIndex + 1).padStart(2, '0')}A`;
  const isLive = status === 'generating' || status === 'pending';
  const isReady = status === 'completed';
  const isFailed = status === 'failed';
  const isIdle = !clip;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative rounded-2xl border overflow-hidden backdrop-blur-md transition-colors',
        isLive && 'border-amber-400/30 bg-amber-500/[0.05]',
        isReady && 'border-emerald-400/25 bg-emerald-500/[0.04]',
        isFailed && 'border-rose-400/35 bg-rose-500/[0.06]',
        isIdle && 'border-white/[0.05] bg-white/[0.012]',
      )}
    >
      <div className="flex items-stretch">
        {/* Slate "clapper" left rail */}
        <div className="w-[8px] shrink-0 bg-[repeating-linear-gradient(180deg,#fff_0_6px,#000_6px_12px)] opacity-80" />

        {/* Thumbnail */}
        <div className="w-32 sm:w-40 aspect-video shrink-0 bg-black/55 overflow-hidden relative">
          {clip?.thumbnail_url ? (
            <img
              src={clip.thumbnail_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : clip?.video_url ? (
            <video
              src={clip.video_url}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/25">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35">
                SHOT
              </span>
              <span className="font-display text-[20px] text-white leading-none">
                {shotCode}
              </span>
              {allTakes && allTakes.length > 1 && (
                <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35">
                  · {allTakes.length} takes
                </span>
              )}
              <StatusChip status={status} />
            </div>
            {clip?.prompt && (
              <p className="text-[12.5px] text-white/65 leading-relaxed line-clamp-2">
                {clip.prompt}
              </p>
            )}
            {!clip && (
              <p className="text-[12px] text-white/30 italic">Holding for the slate…</p>
            )}
            {isFailed && clip?.error_message && (
              <p className="text-[11px] text-rose-300/85 mt-1.5 line-clamp-2">
                {clip.error_message}
              </p>
            )}
          </div>

          {/* Trailing controls */}
          <div className="shrink-0 flex items-center gap-2">
            {isLive && <Spinner size="sm" tone="primary" />}
            {isReady && (
              <button
                onClick={onMoreTakes}
                className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/65 hover:text-white px-3 py-1.5 rounded-md border border-white/[0.08] hover:border-white/20 transition-colors"
              >
                + 3 more takes
              </button>
            )}
            {isFailed && (
              <button
                onClick={onRetry}
                className="text-[10px] uppercase tracking-[0.22em] font-mono text-rose-200 hover:text-white px-3 py-1.5 rounded-md border border-rose-400/30 hover:border-rose-400/60 transition-colors"
              >
                Re-shoot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Takes drawer — only when multiple takes exist */}
      {allTakes && allTakes.length > 1 && (
        <div className="px-5 pb-4 -mt-1 flex items-center gap-2 overflow-x-auto">
          {allTakes.map((take, ti) => (
            <button
              key={take.id}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-[0.22em] font-mono whitespace-nowrap',
                take.status === 'completed'
                  ? 'border-emerald-400/30 text-emerald-200 hover:border-emerald-400/60'
                  : take.status === 'failed'
                    ? 'border-rose-400/30 text-rose-200'
                    : 'border-amber-400/30 text-amber-200',
              )}
            >
              <span className="opacity-65">T</span>
              <span className="tabular-nums">{String(ti + 1).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-emerald-300">
        <Check className="w-3 h-3" />
        In can
      </span>
    );
  }
  if (status === 'generating') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-amber-300">
        <span className="relative inline-flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
          <span className="relative w-1.5 h-1.5 rounded-full bg-amber-400" />
        </span>
        Rolling
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/45">
        Waiting
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-rose-300">
        Cut!
      </span>
    );
  }
  return null;
}

export default ProductionSlateFeed;

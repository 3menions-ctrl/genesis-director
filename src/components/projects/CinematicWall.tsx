/**
 * CinematicWall — full-bleed editorial masonry layout
 *
 * Design directive: every tile shows its thumbnail at all times. No "Failed"
 * states are ever surfaced to the user — failed extracts gracefully fall back
 * to the cinematic gradient backdrop with an embedded title plate so the wall
 * always reads as "full".
 *
 * Layout:
 *  - First item is a wide hero (spans 2 columns at md+).
 *  - Subsequent items flow in a CSS grid masonry with controlled aspect ratios.
 *  - Pinned + completed items get richer treatment; processing/draft tiles
 *    still render with the same visual weight so the wall never breaks.
 */

import { memo } from 'react';
import { ProjectCard } from './ProjectCard';
import { LazyVideoThumbnail } from '@/components/ui/LazyVideoThumbnail';
import { Film, Play, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/studio';

// ----- types -----

export interface TrainingVideoTile {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

interface CinematicWallProps {
  projects: Project[];
  trainingVideos?: TrainingVideoTile[];
  resolvedClipUrls: Map<string, string>;
  activeProjectId: string | null;
  retryingProjectId: string | null;
  browserStitchingProjectId: string | null;
  onPlay: (p: Project) => void;
  onEdit: (p: Project) => void;
  onOpenInEditor: (p: Project) => void;
  onRename: (p: Project) => void;
  onDelete: (id: string) => void;
  onDownload: (p: Project) => void;
  onRetryStitch: (id: string) => void;
  onBrowserStitch: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTogglePublic: (p: Project) => void;
  onPlayTraining?: (v: TrainingVideoTile) => void;
  onDeleteTraining?: (id: string) => void;
}

// ----- helpers -----

const formatTimeAgo = (dateString: string) => {
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ----- training video tile (lightweight, always-visible thumb) -----

const TrainingTile = memo(function TrainingTile({
  video,
  onPlay,
  onDelete,
}: {
  video: TrainingVideoTile;
  onPlay?: (v: TrainingVideoTile) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className="group relative cursor-pointer"
      onClick={() => onPlay?.(video)}
    >
      <div
        className={cn(
          'relative aspect-video rounded-2xl overflow-hidden',
          'bg-surface-1 border border-white/[0.05]',
          'transition-all duration-500 ease-out',
          'hover:-translate-y-1 hover:border-primary/30',
          'hover:shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.18)]'
        )}
      >
        <LazyVideoThumbnail
          src={video.video_url}
          posterUrl={video.thumbnail_url}
          alt={video.title}
          className="absolute inset-0 w-full h-full"
        />

        {/* Always-visible gradient title plate */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, hsl(220 14% 2% / 0.92) 0%, hsl(220 14% 2% / 0.55) 55%, transparent 100%)',
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] uppercase tracking-[0.18em] text-primary/80 font-medium">
                Training
              </span>
            </div>
            <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
            <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatTimeAgo(video.created_at)}
            </p>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 shrink-0">
            <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(video.id);
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/60 border border-white/10"
            aria-label="Delete training video"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
});

// ----- main wall -----

export const CinematicWall = memo(function CinematicWall({
  projects,
  trainingVideos = [],
  resolvedClipUrls,
  activeProjectId,
  retryingProjectId,
  browserStitchingProjectId,
  onPlay,
  onEdit,
  onOpenInEditor,
  onRename,
  onDelete,
  onDownload,
  onRetryStitch,
  onBrowserStitch,
  onTogglePin,
  onTogglePublic,
  onPlayTraining,
  onDeleteTraining,
}: CinematicWallProps) {
  if (projects.length === 0 && trainingVideos.length === 0) return null;

  const cardProps = (project: Project, index: number) => ({
    key: project.id,
    project,
    index,
    viewMode: 'grid' as const,
    preResolvedClipUrl: resolvedClipUrls.get(project.id),
    onPlay: () => onPlay(project),
    onEdit: () => onEdit(project),
    onOpenInEditor: () => onOpenInEditor(project),
    onRename: () => onRename(project),
    onDelete: () => onDelete(project.id),
    onDownload: () => onDownload(project),
    onRetryStitch: () => onRetryStitch(project.id),
    onBrowserStitch: () => onBrowserStitch(project.id),
    onTogglePin: () => onTogglePin(project.id),
    onTogglePublic: () => onTogglePublic(project),
    isActive: activeProjectId === project.id,
    isRetrying: retryingProjectId === project.id,
    isBrowserStitching: browserStitchingProjectId === project.id,
    isPinned: false,
  });

  const allItems = projects;

  return (
    <div className="space-y-8">
      {(allItems.length > 0 || trainingVideos.length > 0) && (
        <section>
          <div className="flex items-end justify-between mb-6 gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="h-px w-6 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <p className="text-[10px] uppercase tracking-[0.24em] text-primary/75 font-medium">
                  Cinematic Wall
                </p>
              </div>
              <h2 className="text-2xl sm:text-[28px] font-display font-semibold tracking-[-0.02em] text-foreground leading-tight">
                Every frame in one view
              </h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0 h-8 px-3 rounded-full border border-white/[0.06] bg-white/[0.025] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
              <span className="text-[11px] tabular-nums text-white/55 font-medium tracking-wide">
                {allItems.length + trainingVideos.length} items
              </span>
            </div>
          </div>

          <div
            className={cn(
              'grid gap-5 sm:gap-6',
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
            )}
          >
            {allItems.map((project, i) => {
              const isWide = i % 7 === 0 && allItems.length > 5;
              return (
                <div
                  key={project.id}
                  className={cn('opacity-0', isWide && 'sm:col-span-2 lg:col-span-2')}
                  style={{
                    animation:
                      'cw-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    animationDelay: `${Math.min(0.05 + i * 0.04, 0.6)}s`,
                  }}
                >
                  <ProjectCard {...cardProps(project, i)} />
                </div>
              );
            })}

            {trainingVideos.map((video, i) => (
              <div
                key={`tv-${video.id}`}
                className="opacity-0"
                style={{
                  animation: 'cw-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: `${Math.min(0.1 + (allItems.length + i) * 0.04, 0.7)}s`,
                }}
              >
                <TrainingTile
                  video={video}
                  onPlay={onPlayTraining}
                  onDelete={onDeleteTraining}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        @keyframes cw-reveal {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.98);
            filter: blur(3px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  );
});

export default CinematicWall;
/**
 * ProjectCard Component — Gallery-Inspired Premium Redesign
 * 
 * Modern sliding gallery aesthetic with:
 * - Cinematic 16:9 cards with glassmorphism overlays
 * - Hover-to-preview with smooth scale transitions
 * - Floating quick-action buttons with glow effects
 * - Refined typography and status indicators
 */

import { memo, forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  MoreVertical, Trash2, Edit2, Film, Play, 
  Download, Loader2, Clock, 
  Pencil, RefreshCw, AlertCircle,
  Pin, PinOff, Globe, Lock, MonitorPlay
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Project } from '@/types/studio';
import { safePlay, safePause, safeSeek, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';

// ============= HELPERS =============

const isManifestUrl = (url: string): boolean => url?.endsWith('.json');

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============= TYPES =============

export interface ProjectCardProps {
  project: Project;
  index: number;
  onPlay: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onRetryStitch?: () => void;
  onBrowserStitch?: () => void;
  onTogglePin?: () => void;
  onTogglePublic?: () => void;
  isActive: boolean;
  isRetrying?: boolean;
  isBrowserStitching?: boolean;
  isPinned?: boolean;
  viewMode?: 'grid' | 'list';
  /** Pre-resolved clip URL from parent to avoid N+1 queries */
  preResolvedClipUrl?: string | null;
}

// ============= COMPONENT =============

export const ProjectCard = memo(forwardRef<HTMLDivElement, ProjectCardProps>(function ProjectCard({ 
  project,
  index,
  onPlay,
  onEdit,
  onRename,
  onDelete,
  onDownload,
  onRetryStitch,
  onBrowserStitch,
  onTogglePin,
  onTogglePublic,
  isActive,
  isRetrying = false,
  isBrowserStitching = false,
  isPinned = false,
  viewMode = 'grid',
  preResolvedClipUrl,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMountedRef = useRef(true);
  const [isHovered, setIsHovered] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  const status = project.status as string;
  const isDirectVideo = project.video_url && !isManifestUrl(project.video_url);
  const isManifest = project.video_url && isManifestUrl(project.video_url);
  
  const pendingTasks = project.pending_video_tasks as unknown as Record<string, unknown> | null;
  const hasAvatarVideo = pendingTasks?.predictions 
    ? Array.isArray(pendingTasks.predictions) && 
      (pendingTasks.predictions as Array<{ videoUrl?: string; status?: string }>).some(
        p => p.videoUrl && p.status === 'completed'
      )
    : false;
  
  const hasVideo = Boolean(
    project.video_clips?.length || 
    isDirectVideo || 
    isManifest || 
    hasAvatarVideo ||
    (pendingTasks?.hlsPlaylistUrl)
  );
  
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  useEffect(() => {
    const isTouchDev = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(isTouchDev);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsIOSSafari(isIOS && isSafari);
  }, []);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  const [selfResolvedClipUrl, setSelfResolvedClipUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (preResolvedClipUrl || selfResolvedClipUrl) return;
    if (project.video_clips?.length) return;
    if (isDirectVideo) return;
    
    const fetchClip = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase
          .from('video_clips')
          .select('video_url')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('shot_index', { ascending: true })
          .limit(1);
        
        const validClip = data?.find(clip => 
          clip.video_url && !clip.video_url.includes('replicate.delivery')
        );
        
        if (validClip?.video_url && isMountedRef.current) {
          setSelfResolvedClipUrl(validClip.video_url);
        }
      } catch (err) {
        // Silently fail
      }
    };
    fetchClip();
  }, [project.id, preResolvedClipUrl, selfResolvedClipUrl, project.video_clips, isDirectVideo]);
  
  const videoSrc = useMemo(() => {
    if (preResolvedClipUrl) return preResolvedClipUrl;
    if (selfResolvedClipUrl) return selfResolvedClipUrl;
    if (project.video_clips?.length) {
      const permanentClip = project.video_clips.find(url => 
        url && !url.includes('replicate.delivery')
      );
      if (permanentClip) return permanentClip;
      return project.video_clips[0];
    }
    if (isDirectVideo && project.video_url && !project.video_url.includes('replicate.delivery')) {
      return project.video_url;
    }
    return null;
  }, [project.video_url, project.video_clips, isDirectVideo, preResolvedClipUrl, selfResolvedClipUrl]);

  const handleVideoMetadataLoaded = useCallback(() => {
    if (!isMountedRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    if (!duration || !isFinite(duration) || isNaN(duration) || duration <= 0) return;
    try {
      const targetTime = Math.min(duration * 0.1, 1);
      if (isFinite(targetTime) && targetTime >= 0) video.currentTime = targetTime;
      if (isMountedRef.current) setVideoLoaded(true);
    } catch (err) {
      if (isMountedRef.current) setVideoError(true);
    }
  }, []);

  const handleInteractionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsHovered(true);
    const video = videoRef.current;
    if (!video || !hasVideo || !videoSrc) return;
    try {
      video.muted = true;
      const attemptPlay = () => {
        if (!isMountedRef.current || !videoRef.current) return;
        safeSeek(videoRef.current, 0);
        safePlay(videoRef.current);
      };
      if (video.readyState >= 3) attemptPlay();
      else {
        video.addEventListener('canplay', () => attemptPlay(), { once: true });
        if (video.readyState === 0) video.load();
      }
    } catch (err) {}
  }, [hasVideo, videoSrc]);
  
  const handleMouseEnter = handleInteractionStart;

  const handleInteractionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsHovered(false);
    const video = videoRef.current;
    if (!video) return;
    safePause(video);
    const duration = video.duration;
    if (isSafeVideoNumber(duration)) safeSeek(video, Math.min(duration * 0.1, 1));
  }, []);
  
  const handleMouseLeave = handleInteractionEnd;
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isHovered) { e.preventDefault(); handleInteractionStart(); }
  }, [isHovered, handleInteractionStart]);
  
  const handleTouchEnd = useCallback(() => {}, []);

  const isProcessing = ['generating', 'rendering', 'stitching', 'pending', 'awaiting_approval'].includes(status);
  const isFailed = status === 'stitching_failed' || status === 'failed';

  // ============= LIST VIEW =============
  if (viewMode === 'list') {
    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer",
          "bg-white/[0.02] border border-white/[0.04]",
          "hover:bg-white/[0.05] hover:border-white/[0.08]",
          isActive && "ring-1 ring-primary/30"
        )}
        onClick={onPlay}
      >
        <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-white/[0.03] shrink-0">
          {hasVideo && videoSrc ? (
            project.thumbnail_url ? (
              <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <PausedFrameVideo src={videoSrc} className="w-full h-full object-cover" showLoader={false} />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isProcessing ? <Loader2 className="w-4 h-4 text-white/20 animate-spin" /> : <Film className="w-4 h-4 text-white/10" />}
            </div>
          )}
          {isPinned && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded bg-primary/80 flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white/90 truncate">{project.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-white/30">{formatTimeAgo(project.updated_at)}</span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-white/10">·</span>
                <span className="text-xs text-white/30">{project.video_clips?.length} clips</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {hasVideo && <StatusPill color="emerald" label="Ready" />}
          {isProcessing && <StatusPill color="white" label="Processing" pulse />}
          {isFailed && <StatusPill color="red" label="Failed" />}
        </div>

        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasVideo && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
                <Play className="w-3.5 h-3.5" fill="currentColor" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onDownload(); }}>
                <Download className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <CardDropdown {...{ onEdit, onTogglePin, isPinned, onRename, hasVideo, onTogglePublic, project, status, onRetryStitch, isRetrying, onBrowserStitch, isBrowserStitching, onDelete }} />
        </div>
      </div>
    );
  }

  // ============= GRID VIEW — GALLERY-INSPIRED PREMIUM =============
  const showContentOverlay = isTouchDevice || isHovered;
  
  const handleCardClick = useCallback(() => {
    if (hasVideo) onPlay();
    else onEdit();
  }, [hasVideo, onPlay, onEdit]);
  
  return (
    <div
      ref={ref}
      className={cn(
        "group relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-500",
        !isTouchDevice && "hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]"
      )}
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
      onMouseEnter={!isTouchDevice ? handleMouseEnter : undefined}
      onMouseLeave={!isTouchDevice ? handleMouseLeave : undefined}
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      onClick={handleCardClick}
    >
      {/* Card container with glass border effect */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-500",
        "bg-white/[0.03] border border-white/[0.06]",
        "aspect-video",
        isHovered && "border-white/[0.2] bg-white/[0.06]",
        isActive && "ring-2 ring-primary/40 border-primary/30"
      )}>
        
        {/* Video/Thumbnail layer */}
        {hasVideo && videoSrc ? (
          <>
            {isIOSSafari ? (
              isHovered ? (
                <video ref={videoRef} src={videoSrc}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 scale-[1.08]"
                  loop muted playsInline preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onError={() => setVideoError(true)} />
              ) : (
                project.thumbnail_url ? (
                  <img src={project.thumbnail_url} alt={project.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <PausedFrameVideo src={videoSrc} className="absolute inset-0 w-full h-full object-cover" showLoader={false} />
                )
              )
            ) : (
              <>
                <div className={cn(
                  "absolute inset-0 w-full h-full transition-opacity duration-500",
                  isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <PausedFrameVideo src={videoSrc} className="w-full h-full object-cover" showLoader={false} />
                  )}
                </div>
                <video ref={videoRef} src={isHovered ? videoSrc : undefined}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                    isHovered ? "opacity-100 scale-[1.05]" : "opacity-0 scale-100"
                  )}
                  loop muted playsInline preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onError={() => setVideoError(true)} />
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
            {isProcessing ? (
              <div className="relative flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-white/[0.08] border-t-primary/60 animate-spin" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium">Processing</span>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-red-400/40" strokeWidth={1} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-red-400/40 font-medium">Failed</span>
              </div>
            ) : (
              <Film className="w-12 h-12 text-white/[0.05]" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Cinematic gradient overlay */}
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          "bg-gradient-to-t from-black/90 via-black/30 to-transparent",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-50")
        )} />

        {/* ===== CENTER PLAY ACTION — Floating glass button ===== */}
        {hasVideo && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center z-10 transition-all duration-500",
            isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
          )}>
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xl flex items-center justify-center border border-white/25 hover:bg-white/25 hover:scale-110 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Quick action buttons — bottom row */}
        {hasVideo && (
          <div className={cn(
            "absolute bottom-16 left-3 right-3 flex items-center justify-center gap-2 z-20 transition-all duration-500",
            isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
          )}>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              className="h-8 px-3 rounded-lg bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/15 hover:bg-white/20 transition-all text-[11px] text-white/80 font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="h-8 px-3 rounded-lg bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/15 hover:bg-white/20 transition-all text-[11px] text-white/80 font-medium"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        )}

        {/* Top-left: Status badge */}
        <div className="absolute top-3 left-3 z-20">
          {hasVideo && <StatusPill color="emerald" label="Ready" glass />}
          {isProcessing && <StatusPill color="white" label="Processing" pulse glass />}
          {isFailed && <StatusPill color="red" label="Failed" glass />}
        </div>

        {/* Top-right: Pin + More menu */}
        <div className={cn(
          "absolute top-3 right-3 z-30 flex items-center gap-1.5 transition-all duration-300",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
        )}>
          {isPinned && (
            <div className="w-7 h-7 rounded-lg bg-primary/80 flex items-center justify-center backdrop-blur-sm">
              <Pin className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <CardDropdown {...{ onEdit, onTogglePin, isPinned, onRename, hasVideo, onTogglePublic, project, status, onRetryStitch, isRetrying, onBrowserStitch, isBrowserStitching, onDelete }} />
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1 drop-shadow-lg">
            {project.name}
          </h3>
          <div className="flex items-center gap-2.5 mt-1.5 text-white/40 text-[11px]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(project.updated_at)}
            </span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-white/15">·</span>
                <span>{project.video_clips?.length} clips</span>
              </>
            )}
            {project.is_public && (
              <>
                <span className="text-white/15">·</span>
                <Globe className="w-3 h-3 text-emerald-400/60" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}));

ProjectCard.displayName = 'ProjectCard';

// ============= SUB-COMPONENTS =============

function StatusPill({ color, label, pulse, glass }: { color: string; label: string; pulse?: boolean; glass?: boolean }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-400',
    white: 'bg-white/40',
    red: 'bg-red-400',
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
      glass ? "bg-black/40 backdrop-blur-sm" : "bg-white/[0.05]"
    )}>
      <div className={cn("w-1 h-1 rounded-full", colors[color] || colors.white, pulse && "animate-pulse")} />
      <span className={cn(
        "text-[10px] font-medium",
        color === 'emerald' ? "text-emerald-300/90" : color === 'red' ? "text-red-300/80" : "text-white/60"
      )}>{label}</span>
    </span>
  );
}

function CardDropdown({ onEdit, onTogglePin, isPinned, onRename, hasVideo, onTogglePublic, project, status, onRetryStitch, isRetrying, onBrowserStitch, isBrowserStitching, onDelete }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="h-7 w-7 rounded-lg bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 border border-white/10"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl bg-zinc-900/95 border-white/[0.08] shadow-2xl backdrop-blur-2xl p-1">
        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onTogglePin?.(); }} className="gap-2 text-sm text-white/60 focus:text-white focus:bg-white/[0.06] rounded-lg py-2 px-2.5">
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          {isPinned ? 'Unpin' : 'Pin to Top'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRename(); }} className="gap-2 text-sm text-white/60 focus:text-white focus:bg-white/[0.06] rounded-lg py-2 px-2.5">
          <Pencil className="w-4 h-4" />Rename
        </DropdownMenuItem>
        {hasVideo && (
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn("gap-2 text-sm rounded-lg py-2 px-2.5", project.is_public ? "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10" : "text-white/60 focus:text-white focus:bg-white/[0.06]")}>
            {project.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {project.is_public ? 'Public' : 'Share to Feed'}
          </DropdownMenuItem>
        )}
        {status === 'stitching_failed' && onRetryStitch && (
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRetryStitch(); }} disabled={isRetrying} className="gap-2 text-sm text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 rounded-lg py-2 px-2.5">
            <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />Retry Stitch
          </DropdownMenuItem>
        )}
        {onBrowserStitch && (
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onBrowserStitch(); }} disabled={isBrowserStitching} className="gap-2 text-sm text-primary focus:text-primary/80 focus:bg-primary/10 rounded-lg py-2 px-2.5">
            <MonitorPlay className={cn("w-4 h-4", isBrowserStitching && "animate-pulse")} />Browser Stitch
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-white/[0.06] my-0.5" />
        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }} className="gap-2 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg py-2 px-2.5">
          <Trash2 className="w-4 h-4" />Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProjectCard;

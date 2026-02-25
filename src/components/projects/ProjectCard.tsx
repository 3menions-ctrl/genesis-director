/**
 * ProjectCard Component — Gallery-Tier Premium Redesign
 * 
 * Inspired by Apple TV+, MUBI, and Criterion Collection galleries.
 * Rich cinematic cards with:
 * - Deep atmospheric gradient overlays
 * - Refined glassmorphic interactions
 * - Editorial typography with subtle metadata
 * - Luminous hover states with depth
 */

import { memo, forwardRef, useState, useEffect, useRef, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { 
  MoreVertical, Trash2, Film, Play, 
  Download, Loader2, Clock, 
  Pencil, RefreshCw, AlertCircle,
  Pin, PinOff, Globe, Lock, MonitorPlay,
  Layers, Calendar
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
import { LazyVideoThumbnail, requestLoadSlot, releaseLoadSlot } from '@/components/ui/LazyVideoThumbnail';

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
  const [videoSlotGranted, setVideoSlotGranted] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  
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
  
  const mseClipUrls = Array.isArray(pendingTasks?.mseClipUrls) ? pendingTasks.mseClipUrls as string[] : null;
  const hasMseClips = Boolean(mseClipUrls && mseClipUrls.length > 0);
  
  const hasVideo = Boolean(
    project.video_clips?.length || 
    isDirectVideo || 
    isManifest || 
    hasAvatarVideo ||
    (pendingTasks?.hlsPlaylistUrl) ||
    hasMseClips
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
    if (mseClipUrls && mseClipUrls.length > 0) {
      return mseClipUrls[0];
    }
    return null;
  }, [project.video_url, project.video_clips, isDirectVideo, preResolvedClipUrl, selfResolvedClipUrl, mseClipUrls]);

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
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setIsHovered(true);

    if (!hasVideo || !videoSrc) return;

    hoverTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      await requestLoadSlot();
      if (!isMountedRef.current) { releaseLoadSlot(); return; }
      setVideoSlotGranted(true);
    }, 150);
  }, [hasVideo, videoSrc]);

  const handleInteractionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setIsHovered(false);
    setScrubProgress(null);
    if (videoSlotGranted) {
      const video = videoRef.current;
      if (video) safePause(video);
      releaseLoadSlot();
      setVideoSlotGranted(false);
    }
  }, [videoSlotGranted]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (videoSlotGranted) releaseLoadSlot();
    };
  }, [videoSlotGranted]);
  
  const handleMouseEnter = handleInteractionStart;
  const handleMouseLeave = handleInteractionEnd;
  
  // Quick preview scrubbing — horizontal mouse position controls video time
  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!videoSlotGranted || !videoRef.current || !cardContainerRef.current) return;
    const rect = cardContainerRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setScrubProgress(fraction);
    const vid = videoRef.current;
    if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
      const targetTime = vid.duration * fraction;
      safeSeek(vid, targetTime);
      safePause(vid); // pause while scrubbing for frame-accurate preview
    }
  }, [videoSlotGranted]);
  
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
          "group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 cursor-pointer",
          "bg-white/[0.015] border border-white/[0.04]",
          "hover:bg-white/[0.04] hover:border-white/[0.08]",
          isActive && "ring-1 ring-primary/30"
        )}
        onClick={onPlay}
      >
        <div className="relative w-32 h-[72px] rounded-lg overflow-hidden bg-white/[0.02] shrink-0">
          {hasVideo && videoSrc ? (
            project.thumbnail_url ? (
              <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <LazyVideoThumbnail src={videoSrc} posterUrl={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isProcessing ? <Loader2 className="w-4 h-4 text-white/20 animate-spin" /> : <Film className="w-4 h-4 text-white/[0.06]" />}
            </div>
          )}
          {isPinned && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded bg-primary/80 flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground/90 truncate">{project.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(project.updated_at)}</p>
        </div>

        <div className="shrink-0">
          {hasVideo && <StatusPill color="emerald" label="Ready" />}
          {isProcessing && <StatusPill color="white" label="Processing" pulse />}
          {isFailed && <StatusPill color="red" label="Failed" />}
        </div>

        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasVideo && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
              <Play className="w-3.5 h-3.5" fill="currentColor" />
            </Button>
          )}
          <CardDropdown {...{ onEdit, onTogglePin, isPinned, onRename, hasVideo, onTogglePublic, project, status, onRetryStitch, isRetrying, onBrowserStitch, isBrowserStitching, onDelete }} />
        </div>
      </div>
    );
  }

  // ============= GRID VIEW — GALLERY PREMIUM =============
  const showContentOverlay = isTouchDevice || isHovered;
  
  const handleCardClick = useCallback(() => {
    if (hasVideo) onPlay();
    else onEdit();
  }, [hasVideo, onPlay, onEdit]);
  
  // Compute metadata for overlay
  const clipCount = project.video_clips?.length || 0;
  const formattedDate = new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  return (
    <div
      ref={(node) => {
        cardContainerRef.current = node;
        if (ref) {
          if (typeof ref === 'function') ref(node);
          else (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all duration-700 ease-out animate-fade-in",
        "rounded-2xl",
        !isTouchDevice && "hover:-translate-y-2 hover:shadow-[0_40px_100px_-30px_rgba(124,58,237,0.12)]"
      )}
      style={{ animationDelay: `${Math.min(index * 0.06, 0.5)}s` }}
      onMouseEnter={!isTouchDevice ? handleMouseEnter : undefined}
      onMouseLeave={!isTouchDevice ? handleMouseLeave : undefined}
      onMouseMove={!isTouchDevice ? handleMouseMove : undefined}
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      onClick={handleCardClick}
    >
      {/* Luminous border on hover — violet to cyan gradient edge */}
      <div className={cn(
        "absolute -inset-px rounded-[17px] transition-opacity duration-700 z-0 pointer-events-none",
        isHovered ? "opacity-100" : "opacity-0"
      )} style={{
        background: 'linear-gradient(135deg, hsl(263 70% 58% / 0.35), hsl(195 90% 50% / 0.2), hsl(263 70% 58% / 0.15))',
      }} />

      {/* Vignette bloom — radial glow from edges on hover */}
      <div className={cn(
        "absolute -inset-6 rounded-3xl pointer-events-none transition-opacity duration-1000 z-0",
        isHovered ? "opacity-60" : "opacity-0"
      )} style={{
        background: 'radial-gradient(ellipse at center, hsl(263 70% 58% / 0.15) 0%, transparent 70%)',
        filter: 'blur(20px)',
      }} />

      {/* Card body */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-700",
        "bg-surface-1/80 border border-white/[0.05]",
        "aspect-video",
        isHovered && "border-transparent",
        isActive && "ring-2 ring-primary/30"
      )}>
        
        {/* Video/Thumbnail layer — Ken Burns slow zoom on hover */}
        {hasVideo && videoSrc ? (
          <>
            {isIOSSafari ? (
              videoSlotGranted ? (
                <video ref={videoRef} src={videoSrc}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out",
                    isHovered ? "scale-[1.12]" : "scale-100"
                  )}
                  loop muted playsInline preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onCanPlay={(e) => { safeSeek(e.currentTarget, 0); if (!scrubProgress) safePlay(e.currentTarget); }}
                  onError={() => setVideoError(true)} />
              ) : (
                project.thumbnail_url ? (
                  <img src={project.thumbnail_url} alt={project.name}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out",
                      isHovered ? "scale-[1.08]" : "scale-100"
                    )} loading="lazy" />
                ) : (
                  <LazyVideoThumbnail src={videoSrc} posterUrl={project.thumbnail_url} alt={project.name} className="absolute inset-0 w-full h-full object-cover" />
                )
              )
            ) : (
              <>
                <div className={cn(
                  "absolute inset-0 w-full h-full transition-all duration-700",
                  isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt={project.name}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-[2500ms] ease-out",
                        isHovered ? "scale-[1.08]" : "scale-100"
                      )} loading="lazy" />
                  ) : (
                    <LazyVideoThumbnail src={videoSrc} posterUrl={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
                  )}
                </div>
                {videoSlotGranted && (
                  <video ref={videoRef} src={videoSrc}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out opacity-100",
                      isHovered ? "scale-[1.08]" : "scale-100"
                    )}
                    loop muted playsInline preload="none"
                    onLoadedMetadata={handleVideoMetadataLoaded}
                    onCanPlay={(e) => { safeSeek(e.currentTarget, 0); if (!scrubProgress) safePlay(e.currentTarget); }}
                    onError={() => setVideoError(true)} />
                )}
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-0">
            {isProcessing ? (
              <div className="relative flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-white/[0.06] border-t-primary/40 animate-spin" />
                <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-medium">Rendering</span>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="w-7 h-7 text-destructive/30" strokeWidth={1} />
                <span className="text-[9px] uppercase tracking-[0.3em] text-destructive/40 font-medium">Failed</span>
              </div>
            ) : (
              <Film className="w-12 h-12 text-white/[0.03]" strokeWidth={0.5} />
            )}
          </div>
        )}

        {/* Cinematic gradient overlay — rich atmospheric depth */}
        <div className={cn(
          "absolute inset-0 transition-opacity duration-700 pointer-events-none",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-50")
        )} style={{
          background: 'linear-gradient(to top, hsl(250 15% 4% / 0.95) 0%, hsl(250 15% 4% / 0.5) 35%, hsl(250 15% 4% / 0.1) 65%, transparent 100%)',
        }} />

        {/* Top vignette for status badges */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

        {/* Center play orb — glassmorphic with luminous ring */}
        {hasVideo && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center z-10 transition-all duration-500",
            isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
          )}>
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500",
                "bg-white/[0.12] backdrop-blur-2xl border border-white/[0.18]",
                "hover:bg-white/[0.20] hover:scale-110 hover:border-white/[0.28]",
                "shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]"
              )}
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Top-left: Status indicator — minimal pill */}
        <div className="absolute top-3 left-3 z-20">
          {hasVideo && <StatusPill color="emerald" label="Ready" glass />}
          {isProcessing && <StatusPill color="white" label="Rendering" pulse glass />}
          {isFailed && <StatusPill color="red" label="Failed" glass />}
        </div>

        {/* Top-right: Actions — appear on hover */}
        <div className={cn(
          "absolute top-3 right-3 z-30 flex items-center gap-1.5 transition-all duration-500",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
        )}>
          {isPinned && (
            <div className="w-6 h-6 rounded-lg bg-primary/80 flex items-center justify-center backdrop-blur-sm">
              <Pin className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}
          <CardDropdown {...{ onEdit, onTogglePin, isPinned, onRename, hasVideo, onTogglePublic, project, status, onRetryStitch, isRetrying, onBrowserStitch, isBrowserStitching, onDelete }} />
        </div>

        {/* Bottom metadata — editorial typography + metadata overlays on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-3.5 z-20">
          <h3 className="font-display font-semibold text-white text-sm leading-snug line-clamp-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {project.name}
          </h3>
          <div className={cn(
            "flex items-center gap-2.5 mt-1.5 transition-all duration-500",
          )}>
            <span className="text-[10px] text-white/25 font-medium tracking-wide">
              {formatTimeAgo(project.updated_at)}
            </span>
            {/* Extended metadata on hover */}
            <div className={cn(
              "flex items-center gap-2 transition-all duration-500 overflow-hidden",
              isHovered ? "opacity-100 max-w-[300px]" : "opacity-0 max-w-0"
            )}>
              {clipCount > 0 && (
                <>
                  <span className="w-px h-2.5 bg-white/[0.08]" />
                  <span className="flex items-center gap-1 text-[10px] text-white/30 font-medium whitespace-nowrap">
                    <Layers className="w-2.5 h-2.5" />
                    {clipCount} clip{clipCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              <span className="w-px h-2.5 bg-white/[0.08]" />
              <span className="flex items-center gap-1 text-[10px] text-white/30 font-medium whitespace-nowrap">
                <Calendar className="w-2.5 h-2.5" />
                {formattedDate}
              </span>
            </div>
            {project.is_public && (
              <>
                <span className="w-px h-2.5 bg-white/[0.08]" />
                <Globe className="w-2.5 h-2.5 text-emerald-400/40" />
              </>
            )}
          </div>
        </div>

        {/* Scrub progress indicator — thin bar at bottom */}
        {isHovered && scrubProgress !== null && hasVideo && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] z-30 bg-white/[0.06]">
            <div
              className="h-full bg-primary/60 transition-[width] duration-75 ease-linear"
              style={{ width: `${scrubProgress * 100}%` }}
            />
          </div>
        )}
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
      glass ? "bg-black/50 backdrop-blur-xl" : "bg-white/[0.05]"
    )}>
      <div className={cn("w-1 h-1 rounded-full", colors[color] || colors.white, pulse && "animate-pulse")} />
      <span className={cn(
        "text-[10px] font-medium tracking-wide",
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
          className="h-7 w-7 rounded-lg bg-black/50 backdrop-blur-xl text-white/60 hover:text-white hover:bg-black/70 border border-white/[0.08]"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl bg-surface-1/95 border-white/[0.08] shadow-2xl backdrop-blur-2xl p-1">
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
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRetryStitch(); }} disabled={isRetrying} className="gap-2 text-sm text-warning focus:text-warning/80 focus:bg-warning/10 rounded-lg py-2 px-2.5">
            <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />Retry Stitch
          </DropdownMenuItem>
        )}
        {onBrowserStitch && (
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onBrowserStitch(); }} disabled={isBrowserStitching} className="gap-2 text-sm text-primary focus:text-primary/80 focus:bg-primary/10 rounded-lg py-2 px-2.5">
            <MonitorPlay className={cn("w-4 h-4", isBrowserStitching && "animate-pulse")} />Browser Stitch
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-white/[0.06] my-0.5" />
        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }} className="gap-2 text-sm text-destructive focus:text-destructive/80 focus:bg-destructive/10 rounded-lg py-2 px-2.5">
          <Trash2 className="w-4 h-4" />Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProjectCard;

/**
 * ProjectCard Component — Premium Redesign
 * 
 * Cinematic 16:9 cards with:
 * - Hover-to-preview video playback
 * - Visible quick-action overlays (play, download, edit)
 * - Refined status indicators with progress rings
 * - Clean typography with subtle animations
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
  
  // Check for avatar-style video content in pending_video_tasks
  const pendingTasks = project.pending_video_tasks as unknown as Record<string, unknown> | null;
  const hasAvatarVideo = pendingTasks?.predictions 
    ? Array.isArray(pendingTasks.predictions) && 
      (pendingTasks.predictions as Array<{ videoUrl?: string; status?: string }>).some(
        p => p.videoUrl && p.status === 'completed'
      )
    : false;
  
  // Determine if project actually has playable video content
  const hasVideo = Boolean(
    project.video_clips?.length || 
    isDirectVideo || 
    isManifest || 
    hasAvatarVideo ||
    (pendingTasks?.hlsPlaylistUrl)
  );
  
  // Detect touch device and iOS Safari on mount
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  useEffect(() => {
    const checkDevice = () => {
      const isTouchDev = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouchDev);
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      setIsIOSSafari(isIOS && isSafari);
    };
    checkDevice();
  }, []);
  
  // Track mount state for async safety
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  // Determine video source - prefer pre-resolved URLs, with robust fallback chain
  const [selfResolvedClipUrl, setSelfResolvedClipUrl] = useState<string | null>(null);
  
  // Self-resolve clip URL if not provided by parent (fallback for race conditions)
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
        // Silently fail - this is a fallback
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
      if (isFinite(targetTime) && targetTime >= 0) {
        video.currentTime = targetTime;
      }
      if (isMountedRef.current) {
        setVideoLoaded(true);
      }
    } catch (err) {
      console.debug('[ProjectCard] Metadata load error:', err);
      if (isMountedRef.current) {
        setVideoError(true);
      }
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
        const v = videoRef.current;
        safeSeek(v, 0);
        safePlay(v);
      };
      
      if (video.readyState >= 3) {
        attemptPlay();
      } else {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          attemptPlay();
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
        
        if (video.readyState === 0) {
          video.load();
        }
      }
    } catch (err) {
      console.debug('[ProjectCard] Interaction start error:', err);
    }
  }, [hasVideo, videoSrc]);
  
  const handleMouseEnter = handleInteractionStart;

  const handleInteractionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsHovered(false);
    
    const video = videoRef.current;
    if (!video) return;
    
    safePause(video);
    const duration = video.duration;
    if (isSafeVideoNumber(duration)) {
      const targetTime = Math.min(duration * 0.1, 1);
      safeSeek(video, targetTime);
    }
  }, []);
  
  const handleMouseLeave = handleInteractionEnd;
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isHovered) {
      e.preventDefault();
      handleInteractionStart();
    }
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
        {/* Thumbnail */}
        <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-white/[0.03] shrink-0">
          {hasVideo && videoSrc ? (
            project.thumbnail_url ? (
              <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <PausedFrameVideo src={videoSrc} className="w-full h-full object-cover" showLoader={false} />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
              ) : (
                <Film className="w-4 h-4 text-white/10" />
              )}
            </div>
          )}
          {isPinned && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded bg-primary/80 flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
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

        {/* Status pill */}
        <div className="shrink-0">
          {hasVideo && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400/80">Ready</span>
            </span>
          )}
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.05]">
              <div className="w-1 h-1 rounded-full bg-white/40 animate-pulse" />
              <span className="text-[10px] font-medium text-white/40">Processing</span>
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <span className="text-[10px] font-medium text-red-400/80">Failed</span>
            </span>
          )}
        </div>

        {/* Quick actions */}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-zinc-900/95 border-white/[0.08] backdrop-blur-xl rounded-lg">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-sm text-white/60 focus:text-white focus:bg-white/[0.06]">
                <Edit2 className="w-4 h-4 mr-2" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="text-sm text-white/60 focus:text-white focus:bg-white/[0.06]">
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="text-sm text-white/60 focus:text-white focus:bg-white/[0.06]">
                <Pencil className="w-4 h-4 mr-2" />Rename
              </DropdownMenuItem>
              {hasVideo && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn("text-sm focus:bg-white/[0.06]", project.is_public ? "text-emerald-400" : "text-white/60 focus:text-white")}>
                  {project.is_public ? <Globe className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {project.is_public ? 'Public' : 'Share'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // ============= GRID VIEW — PREMIUM REDESIGN =============
  const showContentOverlay = isTouchDevice || isHovered;
  
  const handleCardClick = useCallback(() => {
    if (hasVideo) {
      onPlay();
    } else {
      onEdit();
    }
  }, [hasVideo, onPlay, onEdit]);
  
  return (
    <div
      ref={ref}
      className={cn(
        "group relative cursor-pointer transition-all duration-300",
        !isTouchDevice && "hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/40"
      )}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
      onMouseEnter={!isTouchDevice ? handleMouseEnter : undefined}
      onMouseLeave={!isTouchDevice ? handleMouseLeave : undefined}
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      onClick={handleCardClick}
    >
      {/* Card container */}
      <div className={cn(
        "relative overflow-hidden rounded-xl transition-all duration-300",
        "bg-white/[0.03] border border-white/[0.06]",
        "aspect-video",
        isHovered && "border-white/[0.15]",
        isActive && "ring-1 ring-primary/40"
      )}>
        
        {/* Video/Thumbnail layer */}
        {hasVideo && videoSrc ? (
          <>
            {isIOSSafari ? (
              isHovered ? (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 scale-105"
                  loop muted playsInline preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onError={(e) => { e.preventDefault?.(); e.stopPropagation?.(); setVideoError(true); }}
                />
              ) : (
                project.thumbnail_url ? (
                  <img src={project.thumbnail_url} alt={project.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <PausedFrameVideo src={videoSrc} className="absolute inset-0 w-full h-full object-cover" showLoader={false} />
                )
              )
            ) : (
              <>
                {/* Static thumbnail — always mounted to prevent flash */}
                <div className={cn(
                  "absolute inset-0 w-full h-full transition-opacity duration-300",
                  isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <PausedFrameVideo src={videoSrc} className="w-full h-full object-cover" showLoader={false} />
                  )}
                </div>
                {/* Active video — always mounted, shown on hover */}
                <video
                  ref={videoRef}
                  src={isHovered ? videoSrc : undefined}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                    isHovered ? "opacity-100 scale-105" : "opacity-0 scale-100"
                  )}
                  loop muted playsInline preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onError={(e) => { e.preventDefault?.(); e.stopPropagation?.(); setVideoError(true); }}
                />
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
            {isProcessing ? (
              <div className="relative flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-white/[0.08] border-t-primary/60 animate-spin" />
                <span className="text-[10px] uppercase tracking-widest text-white/20 font-medium">Processing</span>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-red-400/40" strokeWidth={1} />
                <span className="text-[10px] uppercase tracking-widest text-red-400/40 font-medium">Failed</span>
              </div>
            ) : (
              <Film className="w-10 h-10 text-white/[0.06]" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Bottom gradient - always present for text readability */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-60")
        )} />

        {/* ===== HOVER QUICK ACTIONS — Visible play/download/edit buttons ===== */}
        {hasVideo && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center gap-2 z-10 transition-all duration-300",
            isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
          )}>
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/30 hover:scale-110 transition-all"
              title="Play"
            >
              <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 hover:scale-110 transition-all"
              title="Download"
            >
              <Download className="w-4 h-4 text-white/80" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 hover:scale-110 transition-all"
              title="Edit"
            >
              <Edit2 className="w-4 h-4 text-white/80" />
            </button>
          </div>
        )}

        {/* Top-left: Status badge */}
        <div className="absolute top-2.5 left-2.5 z-20">
          {hasVideo && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-300/90">Ready</span>
            </span>
          )}
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-primary/80 animate-pulse" />
              <span className="text-[10px] font-medium text-white/60">Processing</span>
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <span className="text-[10px] font-medium text-red-300/80">Failed</span>
            </span>
          )}
        </div>

        {/* Top-right: Pin + More menu */}
        <div className={cn(
          "absolute top-2.5 right-2.5 z-30 flex items-center gap-1 transition-all duration-200",
          isTouchDevice ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
        )}>
          {isPinned && (
            <div className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center">
              <Pin className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 border border-white/10"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-zinc-900/95 border-white/[0.08] shadow-2xl backdrop-blur-2xl p-1">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="gap-2 text-sm text-white/60 focus:text-white focus:bg-white/[0.06] rounded-lg py-2 px-2.5">
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {isPinned ? 'Unpin' : 'Pin to Top'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="gap-2 text-sm text-white/60 focus:text-white focus:bg-white/[0.06] rounded-lg py-2 px-2.5">
                <Pencil className="w-4 h-4" />Rename
              </DropdownMenuItem>
              {hasVideo && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn("gap-2 text-sm rounded-lg py-2 px-2.5", project.is_public ? "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10" : "text-white/60 focus:text-white focus:bg-white/[0.06]")}>
                  {project.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {project.is_public ? 'Public' : 'Share to Feed'}
                </DropdownMenuItem>
              )}
              {status === 'stitching_failed' && onRetryStitch && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRetryStitch(); }} disabled={isRetrying} className="gap-2 text-sm text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 rounded-lg py-2 px-2.5">
                  <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />Retry Stitch
                </DropdownMenuItem>
              )}
              {onBrowserStitch && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onBrowserStitch(); }} disabled={isBrowserStitching} className="gap-2 text-sm text-primary focus:text-primary/80 focus:bg-primary/10 rounded-lg py-2 px-2.5">
                  <MonitorPlay className={cn("w-4 h-4", isBrowserStitching && "animate-pulse")} />Browser Stitch
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/[0.06] my-0.5" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="gap-2 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg py-2 px-2.5">
                <Trash2 className="w-4 h-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bottom info bar — always visible */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1 drop-shadow-lg">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-white/40 text-[11px]">
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

export default ProjectCard;

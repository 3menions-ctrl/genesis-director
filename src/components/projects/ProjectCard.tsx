/**
 * ProjectCard Component
 * 
 * Displays a single project in either grid or list view with:
 * - Video thumbnail/preview on hover
 * - Status badges (Ready, Processing, Failed)
 * - Quick actions menu (play, download, rename, delete, pin, share)
 * 
 * Extracted from Projects.tsx for maintainability
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
  const hasVideo = Boolean(project.video_clips?.length || isDirectVideo || isManifest || status === 'completed');
  
  // Detect touch device and iOS Safari on mount
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  useEffect(() => {
    const checkDevice = () => {
      const isTouchDev = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouchDev);
      
      // Detect iOS Safari specifically (has severe memory constraints)
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
  
  // Determine video source - prefer pre-resolved URLs
  const videoSrc = useMemo(() => {
    if (preResolvedClipUrl) return preResolvedClipUrl;
    
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
  }, [project.video_url, project.video_clips, isDirectVideo, preResolvedClipUrl]);

  const handleVideoMetadataLoaded = useCallback(() => {
    if (!isMountedRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    
    // Safe duration check
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

  // Unified interaction handler for both mouse and touch
  const handleInteractionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsHovered(true);
    
    const video = videoRef.current;
    if (!video || !hasVideo || !videoSrc) return;
    
    try {
      // CRITICAL: iOS requires muted for autoplay
      video.muted = true;
      
      // Function to attempt play - STABILITY FIX: Use safe video operations
      const attemptPlay = () => {
        if (!isMountedRef.current || !videoRef.current) return;
        const v = videoRef.current;
        safeSeek(v, 0);
        safePlay(v);
      };
      
      // If video has enough data, play immediately
      if (video.readyState >= 3) {
        attemptPlay();
      } else {
        // Wait for video to be ready
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          attemptPlay();
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
        
        // Also try loading if not started
        if (video.readyState === 0) {
          video.load();
        }
      }
    } catch (err) {
      console.debug('[ProjectCard] Interaction start error:', err);
    }
  }, [hasVideo, videoSrc]);
  
  // Alias for mouse events
  const handleMouseEnter = handleInteractionStart;

  const handleInteractionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsHovered(false);
    
    const video = videoRef.current;
    if (!video) return;
    
    // STABILITY FIX: Use safe video operations
    safePause(video);
    const duration = video.duration;
    if (isSafeVideoNumber(duration)) {
      const targetTime = Math.min(duration * 0.1, 1);
      safeSeek(video, targetTime);
    }
  }, []);
  
  // Alias for mouse events  
  const handleMouseLeave = handleInteractionEnd;
  
  // Touch event handlers for iPad/mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // On touch devices, first tap shows preview, second tap plays
    if (!isHovered) {
      e.preventDefault(); // Prevent click from firing immediately
      handleInteractionStart();
    }
  }, [isHovered, handleInteractionStart]);
  
  const handleTouchEnd = useCallback(() => {
    // Don't immediately hide on touch end - let user see the preview
    // They can tap again to play or tap elsewhere to dismiss
  }, []);

  const getStatusBadge = () => {
    if (hasVideo) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Ready</span>
        </span>
      );
    }
    if (status === 'stitching_failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitch Failed</span>
        </span>
      );
    }
    if (status === 'stitching') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitching</span>
        </span>
      );
    }
    if (status === 'generating' || status === 'rendering') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30">
          <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Processing</span>
        </span>
      );
    }
    return null;
  };

  // ============= LIST VIEW =============
  if (viewMode === 'list') {
    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 cursor-pointer animate-fade-in",
          "bg-zinc-900/60 border border-white/[0.06]",
          "hover:bg-zinc-800/60 hover:border-white/[0.1]",
          isActive && "ring-1 ring-white/20"
        )}
        style={{ animationDelay: `${index * 0.03}s` }}
        onClick={onPlay}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
          {hasVideo && videoSrc ? (
            project.thumbnail_url ? (
              <img 
                src={project.thumbnail_url}
                alt={project.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-zinc-600" />
            </div>
          )}
          {isPinned && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded bg-amber-500/80 flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-black" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{project.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500">{formatTimeAgo(project.updated_at)}</span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-xs text-zinc-500">{project.video_clips?.length} clips</span>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0">{getStatusBadge()}</div>

        {/* Actions */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-white/10 backdrop-blur-xl">
              {hasVideo && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPlay(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                    <Play className="w-4 h-4 mr-2" />Watch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                    <Download className="w-4 h-4 mr-2" />Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                </>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {hasVideo && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn("text-zinc-300 focus:text-white focus:bg-white/10", project.is_public && "text-emerald-400")}>
                  {project.is_public ? <Globe className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {project.is_public ? 'Public' : 'Share to Feed'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                <Pencil className="w-4 h-4 mr-2" />Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // ============= GRID VIEW =============
  return (
    <div
      ref={ref}
      className="group relative cursor-pointer animate-fade-in hover:-translate-y-2 transition-transform duration-300"
      style={{ animationDelay: `${index * 0.06}s` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      onClick={onPlay}
    >
      {/* Glow effect on hover */}
      <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-foreground/10 via-foreground/5 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 pointer-events-none" />
      
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-700",
        "bg-zinc-900 border border-white/[0.06]",
        hasVideo ? "aspect-video" : index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-video",
        isHovered && "border-white/20 shadow-2xl shadow-black/50",
        isActive && "ring-2 ring-white/30"
      )}>
        
        {/* Video/Thumbnail - iOS SAFARI FIX: Only render video when hovered to save memory */}
        {hasVideo && videoSrc ? (
          <>
            {/* iOS Safari: Only load video element when actually hovering to prevent memory crash */}
            {isIOSSafari ? (
              isHovered ? (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                    isHovered && "scale-105"
                  )}
                  loop
                  muted
                  playsInline
                  preload="none"
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onError={(e) => {
                    e.preventDefault?.();
                    e.stopPropagation?.();
                    setVideoError(true);
                  }}
                />
              ) : (
                // Show thumbnail or placeholder for iOS when not hovered
                project.thumbnail_url ? (
                  <img 
                    src={project.thumbnail_url} 
                    alt={project.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                    <Film className="w-8 h-8 text-zinc-600" />
                  </div>
                )
              )
            ) : (
              // Desktop: Keep existing behavior with preload="metadata" (not "auto")
              <video
                ref={videoRef}
                src={videoSrc}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                  isHovered && "scale-105"
                )}
                loop
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={handleVideoMetadataLoaded}
                onError={(e) => {
                  e.preventDefault?.();
                  e.stopPropagation?.();
                  setVideoError(true);
                }}
              />
            )}
            
            {/* Cinematic bars on hover */}
            <div 
              className="absolute inset-x-0 top-0 bg-black pointer-events-none transition-all duration-400"
              style={{ height: isHovered ? '6%' : 0 }}
            />
            <div 
              className="absolute inset-x-0 bottom-0 bg-black pointer-events-none transition-all duration-400"
              style={{ height: isHovered ? '6%' : 0 }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            {status === 'generating' || status === 'rendering' || status === 'stitching' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse scale-150" />
                <Loader2 className="relative w-10 h-10 text-amber-500/70 animate-spin" strokeWidth={1} />
              </div>
            ) : (
              <Film className="w-12 h-12 text-zinc-700" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Gradient overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent transition-opacity duration-500",
          isHovered ? "opacity-90" : "opacity-70"
        )} />
        
        {/* Play button on hover */}
        {hasVideo && isHovered && (
          <div className="absolute inset-0 flex items-center justify-center z-10 animate-scale-in">
            <div className="relative w-16 h-16 rounded-full bg-white/20 backdrop-blur-2xl flex items-center justify-center border border-white/40 shadow-lg hover:scale-110 active:scale-95 transition-transform">
              <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Pin indicator */}
        {isPinned && (
          <div className="absolute top-3 left-3 z-20">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg">
              <Pin className="w-3.5 h-3.5 text-black" />
            </div>
          </div>
        )}

        {/* Content overlay on hover */}
        {isHovered && (
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">{getStatusBadge()}</div>
            <h3 className="font-bold text-white tracking-tight line-clamp-1 text-base drop-shadow-lg">
              {project.name}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-white/70 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(project.updated_at)}
              </span>
              {(project.video_clips?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  {project.video_clips?.length} clips
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick actions - top right */}
        <div className={cn(
          "absolute top-3 right-3 z-30 flex items-center gap-1 transition-all duration-300",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/80 transition-all border border-white/10"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-zinc-900 border-zinc-700 shadow-2xl backdrop-blur-2xl p-1.5">
              {hasVideo && (
                <>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onPlay(); }}
                    className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
                  >
                    <Play className="w-4 h-4" />Watch Now
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDownload(); }}
                    className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
                  >
                    <Download className="w-4 h-4" />Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
                </>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {isPinned ? 'Unpin' : 'Pin to Top'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onRename(); }} 
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                <Pencil className="w-4 h-4" />Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                <Edit2 className="w-4 h-4" />Edit Project
              </DropdownMenuItem>
              {hasVideo && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }}
                    className={cn(
                      "gap-2.5 text-sm rounded-lg py-2.5 px-3",
                      project.is_public 
                        ? "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10" 
                        : "text-zinc-300 focus:text-white focus:bg-zinc-800"
                    )}
                  >
                    {project.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {project.is_public ? 'Public on Feed' : 'Share to Feed'}
                  </DropdownMenuItem>
                </>
              )}
              {status === 'stitching_failed' && onRetryStitch && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onRetryStitch(); }}
                    disabled={isRetrying}
                    className="gap-2.5 text-sm text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 rounded-lg py-2.5 px-3"
                  >
                    <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
                    Retry Stitch
                  </DropdownMenuItem>
                </>
              )}
              {onBrowserStitch && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onBrowserStitch(); }}
                  disabled={isBrowserStitching}
                  className="gap-2.5 text-sm text-purple-400 focus:text-purple-300 focus:bg-purple-500/10 rounded-lg py-2.5 px-3"
                >
                  <MonitorPlay className={cn("w-4 h-4", isBrowserStitching && "animate-pulse")} />
                  Browser Stitch
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-700 my-1" />
              <DropdownMenuItem
                className="gap-2.5 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg py-2.5 px-3"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-4 h-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}));

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;

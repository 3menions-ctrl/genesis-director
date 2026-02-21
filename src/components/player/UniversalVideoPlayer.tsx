/**
 * UniversalVideoPlayer - HLS-ONLY unified video player
 * 
 * ALL videos play through HLS. No crossfade. No MSE fallback. No legacy paths.
 * 
 * Strategy:
 * - Safari/iOS: Native HLS support
 * - Chrome/Firefox/Edge: hls.js library
 * 
 * If no HLS playlist exists, we generate one via the edge function.
 * Single-clip videos also go through HLS (1-segment m3u8).
 */

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Volume2, VolumeX,
  Maximize2, Minimize2, Download, X, Loader2, CheckCircle2,
  Film, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { navigationCoordinator } from '@/lib/navigation';
import { logPlaybackPath } from '@/lib/video/platformDetection';
import { UniversalHLSPlayer } from './UniversalHLSPlayer';

// ============================================================================
// TYPES
// ============================================================================

export type PlayerMode = 'inline' | 'fullscreen' | 'thumbnail' | 'export';

export interface VideoSource {
  projectId?: string;
  urls?: string[];
  manifestUrl?: string;
  masterAudioUrl?: string;
  musicUrl?: string;
}

export interface PlayerControls {
  showPlayPause?: boolean;
  showSkip?: boolean;
  showVolume?: boolean;
  showProgress?: boolean;
  showFullscreen?: boolean;
  showDownload?: boolean;
  showQuality?: boolean;
  autoHideControls?: boolean;
}

export interface UniversalVideoPlayerProps {
  source: VideoSource;
  mode?: PlayerMode;
  controls?: PlayerControls;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'auto';
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  onClick?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  hoverPreview?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONTROLS: PlayerControls = {
  showPlayPause: true,
  showSkip: true,
  showVolume: true,
  showProgress: true,
  showFullscreen: true,
  showDownload: false,
  showQuality: false,
  autoHideControls: true,
};

// ============================================================================
// UTILITY
// ============================================================================

function formatTime(seconds: number): string {
  if (!isSafeVideoNumber(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// MANIFEST PARSER
// ============================================================================

interface VideoManifest {
  clips: Array<{ videoUrl: string; duration: number }>;
  totalDuration: number;
  hlsPlaylistUrl?: string;
  masterAudioUrl?: string;
  voiceUrl?: string;
}

async function parseManifest(url: string): Promise<VideoManifest | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load manifest');
    return await response.json();
  } catch (err) {
    console.warn('[UniversalPlayer] Failed to parse manifest:', err);
    return null;
  }
}

// ============================================================================
// PLACEHOLDER
// ============================================================================

const VideoPlaceholder = memo(function VideoPlaceholder({ 
  aspectRatio = 'video' 
}: { 
  aspectRatio?: 'video' | 'square' | 'auto' 
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-muted/50 flex items-center justify-center",
      aspectRatio === 'video' && 'aspect-video',
      aspectRatio === 'square' && 'aspect-square'
    )}>
      <Film className="w-8 h-8 text-muted-foreground/20" />
    </div>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 z-10 bg-muted">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent bg-shimmer bg-[length:200%_100%] animate-shimmer" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin" />
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UniversalVideoPlayer = memo(forwardRef<HTMLDivElement, UniversalVideoPlayerProps>(
  function UniversalVideoPlayer({
    source,
    mode = 'inline',
    controls: controlsProp,
    title,
    className,
    aspectRatio = 'video',
    autoPlay = false,
    muted: initialMuted = false,
    loop = false,
    onEnded,
    onClick,
    onClose,
    onDownload,
    hoverPreview = false,
  }, ref) {
    const controls = useMemo(() => {
      const modeDefaults: Partial<PlayerControls> = 
        mode === 'thumbnail' 
          ? { showPlayPause: false, showSkip: false, showVolume: false, showProgress: false, showFullscreen: false }
          : mode === 'export'
          ? { showDownload: true, showQuality: true }
          : {};
      return { ...DEFAULT_CONTROLS, ...modeDefaults, ...controlsProp };
    }, [mode, controlsProp]);

    // ========================================================================
    // STATE
    // ========================================================================
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hlsPlaylistUrl, setHlsPlaylistUrl] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [hlsRetryCount, setHlsRetryCount] = useState(0);
    // For thumbnail mode - need a single URL
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    // For export mode
    const [exportUrl, setExportUrl] = useState<string | null>(null);

    // ========================================================================
    // REFS
    // ========================================================================
    
    const mountedRef = useRef(true);
    const thumbnailVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Stable primitives from source
    const sourceProjectId = source.projectId ?? null;
    const sourceManifestUrl = source.manifestUrl ?? null;
    const sourceUrlsKey = source.urls ? source.urls.join('|') : null;

    const hasValidSource = useMemo(() => {
      return !!sourceUrlsKey || !!sourceManifestUrl || !!sourceProjectId;
    }, [sourceUrlsKey, sourceManifestUrl, sourceProjectId]);

    // ========================================================================
    // CLEANUP
    // ========================================================================
    
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    // ========================================================================
    // SOURCE LOADING - ALWAYS resolves to HLS
    // ========================================================================
    
    useEffect(() => {
      if (!hasValidSource) {
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      mountedRef.current = true;

      async function loadSource() {
        setError(null);
        setIsLoading(true);

        try {
          let hlsUrl: string | null = null;
          let firstClipUrl: string | null = null;

          if (sourceProjectId) {
            // ================================================================
            // PROJECT-BASED: Fetch HLS playlist or generate one
            // ================================================================
            const { data: project } = await supabase
              .from('movie_projects')
              .select('pending_video_tasks, video_url')
              .eq('id', sourceProjectId)
              .maybeSingle();
            
            const tasks = project?.pending_video_tasks as Record<string, unknown> | null;
            hlsUrl = tasks?.hlsPlaylistUrl ? tasks.hlsPlaylistUrl as string : null;
            
            // Get first clip URL for thumbnail mode
            const mseClipUrls = tasks?.mseClipUrls as string[] | undefined;
            if (mseClipUrls && mseClipUrls.length > 0) {
              firstClipUrl = mseClipUrls[0];
            }
            
            // If we already have HLS, use it
            if (hlsUrl) {
              logPlaybackPath('HLS_UNIVERSAL', { projectId: sourceProjectId, hlsUrl });
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(hlsUrl);
              setThumbnailUrl(firstClipUrl);
              setExportUrl(firstClipUrl);
              setIsLoading(false);
              return;
            }
            
            // Check if project has video content to generate HLS from
            const hasVideoContent = tasks?.predictions || tasks?.mseClipUrls || project?.video_url;
            const hasIncompletePredictions = tasks?.predictions && Array.isArray(tasks.predictions) && 
              (tasks.predictions as Array<{ status?: string }>).some(p => p.status !== 'completed' && p.status !== 'failed');
            const isStillGenerating = tasks?.stage === 'async_video_generation' || hasIncompletePredictions;
            
            if (hasVideoContent && !isStillGenerating) {
              // Generate HLS playlist via edge function
              console.log('[UniversalPlayer] Generating HLS playlist...');
              try {
                const { data: result, error: resultError } = await supabase.functions.invoke('generate-hls-playlist', {
                  body: { projectId: sourceProjectId }
                });

                if (!resultError && result?.success && result.hlsPlaylistUrl) {
                  logPlaybackPath('HLS_GENERATED', {
                    projectId: sourceProjectId,
                    hlsUrl: result.hlsPlaylistUrl,
                    clipCount: result.clipUrls?.length,
                  });
                  if (!mountedRef.current) return;
                  setHlsPlaylistUrl(result.hlsPlaylistUrl);
                  setThumbnailUrl(result.clipUrls?.[0] || null);
                  setExportUrl(result.clipUrls?.[0] || null);
                  setIsLoading(false);
                  return;
                } else {
                  console.warn('[UniversalPlayer] HLS generation failed:', resultError || result?.error);
                }
              } catch (err) {
                console.warn('[UniversalPlayer] HLS generation error:', err);
              }
            } else if (isStillGenerating) {
              console.log('[UniversalPlayer] Project still generating, waiting...');
              if (!mountedRef.current) return;
              setError('Video is still being generated...');
              setIsLoading(false);
              return;
            }
            
            // If we still have no HLS, try mseClipUrls to build a client-side HLS reference
            // or try the video_url directly
            if (mseClipUrls && mseClipUrls.length > 0) {
              // We have clip URLs but no HLS playlist - the edge function should have created one
              // Retry once more
              console.log('[UniversalPlayer] Retrying HLS generation...');
              try {
                const { data: retryResult } = await supabase.functions.invoke('generate-hls-playlist', {
                  body: { projectId: sourceProjectId }
                });
                if (retryResult?.success && retryResult.hlsPlaylistUrl) {
                  if (!mountedRef.current) return;
                  setHlsPlaylistUrl(retryResult.hlsPlaylistUrl);
                  setThumbnailUrl(mseClipUrls[0]);
                  setExportUrl(mseClipUrls[0]);
                  setIsLoading(false);
                  return;
                }
              } catch {}
              
              // Last resort: if edge function still failed, use first clip as single-segment HLS fallback
              // This shouldn't happen, but prevents a dead screen
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(null);
              setThumbnailUrl(mseClipUrls[0]);
              setExportUrl(mseClipUrls[0]);
              setError('Unable to create seamless playlist. Please try again.');
              setIsLoading(false);
              return;
            }
            
            // Single video URL fallback
            if (project?.video_url && typeof project.video_url === 'string') {
              const videoUrl = project.video_url;
              if (videoUrl.endsWith('.json')) {
                const manifest = await parseManifest(videoUrl);
                if (manifest?.hlsPlaylistUrl) {
                  if (!mountedRef.current) return;
                  setHlsPlaylistUrl(manifest.hlsPlaylistUrl);
                  setThumbnailUrl(manifest.clips?.[0]?.videoUrl || null);
                  setExportUrl(manifest.clips?.[0]?.videoUrl || null);
                  setIsLoading(false);
                  return;
                }
              } else if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.includes('/video-clips/')) {
                // Single video — still use HLS via edge function or direct play
                if (!mountedRef.current) return;
                setHlsPlaylistUrl(null);
                setThumbnailUrl(videoUrl);
                setExportUrl(videoUrl);
                // For single videos, we can play directly in HLS player as mp4
                // Generate HLS manifest for it
                try {
                  const { data: singleResult } = await supabase.functions.invoke('generate-hls-playlist', {
                    body: { projectId: sourceProjectId }
                  });
                  if (singleResult?.success && singleResult.hlsPlaylistUrl) {
                    setHlsPlaylistUrl(singleResult.hlsPlaylistUrl);
                    setIsLoading(false);
                    return;
                  }
                } catch {}
                // If HLS generation fails for single video, play it directly
                // UniversalHLSPlayer can handle a direct MP4 URL via native/hls.js
                setHlsPlaylistUrl(videoUrl);
                setIsLoading(false);
                return;
              }
            }
            
            // Nothing found
            if (!mountedRef.current) return;
            setError('No video sources found');
            setIsLoading(false);
            
          } else if (sourceManifestUrl) {
            // ================================================================
            // MANIFEST-BASED
            // ================================================================
            const manifest = await parseManifest(sourceManifestUrl);
            if (manifest?.hlsPlaylistUrl) {
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(manifest.hlsPlaylistUrl);
              setThumbnailUrl(manifest.clips?.[0]?.videoUrl || null);
              setIsLoading(false);
              return;
            }
            // No HLS in manifest - try first clip URL as direct play
            if (manifest?.clips?.length) {
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(manifest.clips[0].videoUrl);
              setThumbnailUrl(manifest.clips[0].videoUrl);
              setIsLoading(false);
              return;
            }
            setError('No playable content in manifest');
            setIsLoading(false);
            
          } else if (sourceUrlsKey && source.urls) {
            // ================================================================
            // DIRECT URLs - play first URL (single video HLS or direct)
            // For multiple URLs, we'd need server-side HLS generation
            // ================================================================
            const urls = source.urls;
            if (urls.length === 1) {
              // Single URL - play directly
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(urls[0]);
              setThumbnailUrl(urls[0]);
              setExportUrl(urls[0]);
              setIsLoading(false);
            } else {
              // Multiple URLs without a projectId - can't generate HLS server-side
              // Use first URL and log warning
              console.warn('[UniversalPlayer] Multiple URLs without projectId - using first URL only');
              if (!mountedRef.current) return;
              setHlsPlaylistUrl(urls[0]);
              setThumbnailUrl(urls[0]);
              setExportUrl(urls[0]);
              setIsLoading(false);
            }
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          if (!mountedRef.current) return;
          console.warn('[UniversalPlayer] Load error:', err);
          setError('Failed to load video');
          setIsLoading(false);
        }
      }

      loadSource();

      return () => {
        mountedRef.current = false;
        controller.abort();
      };
    }, [sourceProjectId, sourceManifestUrl, sourceUrlsKey, hasValidSource, hlsRetryCount]);

    // ========================================================================
    // THUMBNAIL HOVER PREVIEW
    // ========================================================================
    
    const handleThumbnailHover = useCallback((hovering: boolean) => {
      if (!hoverPreview) return;
      setIsHovered(hovering);
      const video = thumbnailVideoRef.current;
      if (hovering && video) {
        video.muted = true;
        video.currentTime = 0;
        video.play().catch(() => {});
      } else if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }, [hoverPreview]);

    // ========================================================================
    // RENDER: No source
    // ========================================================================
    
    if (!hasValidSource) {
      return <VideoPlaceholder aspectRatio={aspectRatio} />;
    }

    // ========================================================================
    // RENDER: Thumbnail Mode
    // ========================================================================
    
    if (mode === 'thumbnail') {
      return (
        <div
          ref={ref}
          className={cn(
            "relative overflow-hidden cursor-pointer group rounded-xl",
            aspectRatio === 'video' && 'aspect-video',
            aspectRatio === 'square' && 'aspect-square',
            className
          )}
          onClick={onClick}
          onMouseEnter={() => handleThumbnailHover(true)}
          onMouseLeave={() => handleThumbnailHover(false)}
        >
          <AnimatePresence>
            {isLoading && <LoadingSkeleton />}
          </AnimatePresence>

          <video
            ref={thumbnailVideoRef}
            src={thumbnailUrl || source.urls?.[0]}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-300",
              isHovered && "scale-105"
            )}
            muted
            loop
            playsInline
            preload="metadata"
          />

          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-50"
          )} />

          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center z-20"
              >
                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {title && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-0 left-0 right-0 p-3 z-20"
            >
              <p className="text-sm font-medium text-white line-clamp-2">{title}</p>
            </motion.div>
          )}
        </div>
      );
    }

    // ========================================================================
    // RENDER: Export Mode
    // ========================================================================
    
    if (mode === 'export') {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn("relative group", className)}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-50" />
          
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/90 to-teal-500/10 border border-emerald-500/30">
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-emerald-500/20">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </motion.div>
                <div>
                  <h3 className="text-base font-semibold text-white">Video Complete</h3>
                  <p className="text-xs text-emerald-400/60 mt-0.5">Ready for export</p>
                </div>
              </div>
              
              {onDownload && (
                <Button 
                  size="sm" 
                  className="h-9 px-4 text-xs gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500"
                  onClick={onDownload}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              )}
            </div>
            
            <div className="relative aspect-video bg-black/50">
              {hlsPlaylistUrl ? (
                <UniversalHLSPlayer
                  hlsUrl={hlsPlaylistUrl}
                  autoPlay={false}
                  muted={isMuted}
                  loop={loop}
                  className="w-full h-full"
                  aspectRatio="auto"
                  showControls={true}
                  onEnded={onEnded}
                  onError={(err) => {
                    console.warn('[UniversalPlayer] Export HLS error:', err);
                  }}
                />
              ) : (
                <video 
                  src={exportUrl || undefined}
                  controls 
                  className="w-full h-full object-contain" 
                  playsInline
                />
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    // ========================================================================
    // RENDER: HLS Playback (ALL inline/fullscreen modes)
    // ========================================================================
    
    if (hlsPlaylistUrl) {
      return (
        <div 
          ref={ref}
          className={cn(
            mode === 'fullscreen' && "fixed inset-0 z-50",
            aspectRatio === 'video' && mode !== 'fullscreen' && 'aspect-video',
            className
          )}
        >
          <UniversalHLSPlayer
            hlsUrl={hlsPlaylistUrl}
            masterAudioUrl={null}
            muteClipAudio={false}
            autoPlay={autoPlay}
            muted={isMuted}
            loop={loop}
            className="w-full h-full"
            aspectRatio="auto"
            showControls={mode === 'inline' || mode === 'fullscreen'}
            title={title}
            onEnded={onEnded}
            onError={(err) => {
              // HLS failed — retry up to 3 times, then show error (NO crossfade fallback)
              console.warn('[UniversalPlayer] HLS playback error:', err, `(retry ${hlsRetryCount}/3)`);
              if (hlsRetryCount < 3) {
                setHlsRetryCount(prev => prev + 1);
                // Force re-trigger of loadSource by incrementing retry count
                setHlsPlaylistUrl(null);
              } else {
                setError('Video playback failed after retries. Please refresh and try again.');
                setHlsPlaylistUrl(null);
              }
            }}
            onTimeUpdate={(time) => {
              setCurrentTime(time);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClose={onClose}
          />
        </div>
      );
    }

    // ========================================================================
    // RENDER: Loading / Error states (while resolving HLS)
    // ========================================================================
    
    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "relative overflow-hidden bg-black rounded-xl",
          mode === 'fullscreen' && "fixed inset-0 z-50",
          aspectRatio === 'video' && mode !== 'fullscreen' && 'aspect-video',
          className
        )}
      >
        <AnimatePresence>
          {isLoading && <LoadingSkeleton />}
        </AnimatePresence>

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Film className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm text-center px-4">{error}</p>
            <Button variant="outline" size="sm" onClick={() => {
              setError(null);
              setIsLoading(true);
              setHlsRetryCount(0);
              setHlsPlaylistUrl(null);
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && !hlsPlaylistUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/20" />
          </div>
        )}

        {mode === 'fullscreen' && onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70 z-50"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        {title && mode === 'fullscreen' && (
          <div className="absolute top-4 left-4 z-40">
            <h2 className="text-xl font-semibold text-white drop-shadow-lg">{title}</h2>
          </div>
        )}
      </div>
    );
  }
));

UniversalVideoPlayer.displayName = 'UniversalVideoPlayer';

export default UniversalVideoPlayer;

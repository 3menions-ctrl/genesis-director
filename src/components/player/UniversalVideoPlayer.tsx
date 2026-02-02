/**
 * UniversalVideoPlayer - Single unified video player for all contexts
 * 
 * Features:
 * - MSE-first gapless playback with legacy fallback
 * - HLS native playback for iOS Safari (seamless, no gaps)
 * - Auto-detects source type (projectId, manifest, clips array, single video)
 * - Multiple display modes: inline, fullscreen, thumbnail, export
 * - Database fetching via projectId for multi-clip projects
 * - Unified controls with customizable visibility
 * - Safe video operations throughout
 * 
 * Playback Path Selection:
 * - iOS Safari → HLS Native (via generate-hls-playlist)
 * - Chrome/Firefox/Edge → MSE Gapless Engine
 * - Safari Desktop < 15 → HLS Native or Legacy fallback
 * - Other → Legacy dual-video crossfade
 */

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Maximize2, Minimize2, Download, X, Loader2, CheckCircle2,
  Settings, Zap, Film, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  safePlay, safePause, safeSeek, isSafeVideoNumber, 
  getSafeDuration, isVideoPlayable, safeLoad 
} from '@/lib/video/safeVideoOperations';
import {
  MSEGaplessEngine,
  createMSEEngine,
  detectMSESupport,
  type MSEClip,
  type MSEEngineState,
} from '@/lib/videoEngine/MSEGaplessEngine';
import { navigationCoordinator } from '@/lib/navigation';
import { 
  getPlatformCapabilities, 
  logPlaybackPath, 
  requiresHLSPlayback 
} from '@/lib/video/platformDetection';
import { HLSNativePlayer } from './HLSNativePlayer';

// ============================================================================
// TYPES
// ============================================================================

export type PlayerMode = 'inline' | 'fullscreen' | 'thumbnail' | 'export';

export interface VideoSource {
  /** Project ID to fetch clips from database */
  projectId?: string;
  /** Direct video URLs or clip array */
  urls?: string[];
  /** Manifest URL for JSON-based playback */
  manifestUrl?: string;
  /** Master audio track (for avatar projects) */
  masterAudioUrl?: string;
  /** Background music URL */
  musicUrl?: string;
}

export interface PlayerControls {
  /** Show play/pause controls */
  showPlayPause?: boolean;
  /** Show skip controls */
  showSkip?: boolean;
  /** Show volume controls */
  showVolume?: boolean;
  /** Show progress bar */
  showProgress?: boolean;
  /** Show fullscreen toggle */
  showFullscreen?: boolean;
  /** Show download button */
  showDownload?: boolean;
  /** Show quality selector */
  showQuality?: boolean;
  /** Auto-hide controls after inactivity */
  autoHideControls?: boolean;
}

export interface UniversalVideoPlayerProps {
  /** Video source configuration */
  source: VideoSource;
  /** Display mode */
  mode?: PlayerMode;
  /** Control visibility options */
  controls?: PlayerControls;
  /** Title for display */
  title?: string;
  /** CSS class name */
  className?: string;
  /** Aspect ratio class (e.g., 'aspect-video') */
  aspectRatio?: 'video' | 'square' | 'auto';
  /** Auto-play on load */
  autoPlay?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback when video is clicked (for thumbnail mode) */
  onClick?: () => void;
  /** Callback to close fullscreen */
  onClose?: () => void;
  /** Callback when download is requested */
  onDownload?: () => void;
  /** Show hover preview (thumbnail mode) */
  hoverPreview?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MSE_SUPPORT = detectMSESupport();
const CROSSFADE_OVERLAP_MS = 30;
const CROSSFADE_FADEOUT_MS = 30;
const TRANSITION_TRIGGER_OFFSET = 0.15;
const CONTROLS_HIDE_DELAY = 3000;

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
// UTILITY FUNCTIONS
// ============================================================================

function doubleRAF(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    // Re-throw AbortError to be handled by caller
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }
    throw new Error(`Failed to fetch blob: ${(err as Error)?.message || 'Unknown'}`);
  }
}

function formatTime(seconds: number): string {
  if (!isSafeVideoNumber(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// MANIFEST PARSER
// ============================================================================

interface ManifestClip {
  index: number;
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  duration: number;
  transitionOut: string;
  startTime: number;
}

interface VideoManifest {
  version: string;
  projectId: string;
  createdAt: string;
  clips: ManifestClip[];
  totalDuration: number;
  masterAudioUrl?: string;
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
// PLACEHOLDER COMPONENT
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
// CONTROL BAR COMPONENT
// ============================================================================

interface ControlBarProps {
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  totalDuration: number;
  currentClipIndex: number;
  totalClips: number;
  controls: PlayerControls;
  mode: PlayerMode;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onSeek: (time: number) => void;
  onPrevClip: () => void;
  onNextClip: () => void;
  onFullscreen: () => void;
  onDownload?: () => void;
  onClose?: () => void;
  isFullscreen: boolean;
}

const ControlBar = memo(function ControlBar({
  isPlaying,
  isMuted,
  currentTime,
  totalDuration,
  currentClipIndex,
  totalClips,
  controls,
  mode,
  onPlayPause,
  onMuteToggle,
  onSeek,
  onPrevClip,
  onNextClip,
  onFullscreen,
  onDownload,
  onClose,
  isFullscreen,
}: ControlBarProps) {
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
      {/* Progress bar */}
      {controls.showProgress && (
        <div 
          className="w-full h-1 mb-3 bg-white/20 rounded-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeek(percent * totalDuration);
          }}
        >
          <div 
            className="h-full bg-white rounded-full transition-all group-hover:bg-primary"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          {controls.showPlayPause && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={onPlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
              )}
            </Button>
          )}

          {/* Skip controls */}
          {controls.showSkip && totalClips > 1 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={onPrevClip}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={onNextClip}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Volume */}
          {controls.showVolume && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={onMuteToggle}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Time display */}
          <span className="text-xs text-white/80 ml-2">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>

          {/* Clip indicator */}
          {totalClips > 1 && (
            <span className="text-xs text-white/60 ml-2">
              Clip {currentClipIndex + 1}/{totalClips}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Download */}
          {controls.showDownload && onDownload && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={onDownload}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}

          {/* Fullscreen */}
          {controls.showFullscreen && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={onFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Close button for fullscreen mode */}
          {mode === 'fullscreen' && onClose && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
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
    // Merge controls with defaults based on mode
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
    // PLATFORM DETECTION
    // ========================================================================
    
    const platformCapabilities = useMemo(() => getPlatformCapabilities(), []);
    const useHLSNative = platformCapabilities.preferredPlaybackMode === 'hls_native';
    
    // ========================================================================
    // STATE
    // ========================================================================
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clips, setClips] = useState<{ url: string; blobUrl?: string; duration: number }[]>([]);
    const [hlsPlaylistUrl, setHlsPlaylistUrl] = useState<string | null>(null);
    const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [currentTime, setCurrentTime] = useState(0);
    const [showControlsState, setShowControlsState] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    // MSE state
    const [useMSE, setUseMSE] = useState(MSE_SUPPORT.supported && !useHLSNative);
    const [mseReady, setMseReady] = useState(false);
    const mseEngineRef = useRef<MSEGaplessEngine | null>(null);
    
    // Legacy dual-video state for fallback
    const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
    const [videoAOpacity, setVideoAOpacity] = useState(1);
    const [videoBOpacity, setVideoBOpacity] = useState(0);
    const [isCrossfading, setIsCrossfading] = useState(false);

    // ========================================================================
    // REFS
    // ========================================================================
    
    const containerRef = useRef<HTMLDivElement>(null);
    const mseVideoRef = useRef<HTMLVideoElement>(null);
    const videoARef = useRef<HTMLVideoElement>(null);
    const videoBRef = useRef<HTMLVideoElement>(null);
    const musicRef = useRef<HTMLAudioElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const isTransitioningRef = useRef(false);
    const mountedRef = useRef(true);
    const cleanupUnsubRef = useRef<(() => void) | null>(null);

    // ========================================================================
    // NAVIGATION CLEANUP REGISTRATION
    // ========================================================================
    
    useEffect(() => {
      mountedRef.current = true;
      
      // Register cleanup with navigation coordinator
      cleanupUnsubRef.current = navigationCoordinator.registerGlobalCleanup(() => {
        // Pause all videos on navigation
        try {
          if (mseVideoRef.current && !mseVideoRef.current.paused) {
            mseVideoRef.current.pause();
          }
          if (videoARef.current && !videoARef.current.paused) {
            videoARef.current.pause();
          }
          if (videoBRef.current && !videoBRef.current.paused) {
            videoBRef.current.pause();
          }
          if (musicRef.current && !musicRef.current.paused) {
            musicRef.current.pause();
          }
        } catch {
          // Ignore errors on destroyed elements
        }
        
        // Destroy MSE engine
        if (mseEngineRef.current) {
          mseEngineRef.current.destroy();
          mseEngineRef.current = null;
        }
      });
      
      return () => {
        mountedRef.current = false;
        
        // Unregister cleanup
        if (cleanupUnsubRef.current) {
          cleanupUnsubRef.current();
          cleanupUnsubRef.current = null;
        }
      };
    }, []);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================
    
    const totalDuration = useMemo(
      () => clips.reduce((sum, clip) => sum + (clip.duration || 0), 0),
      [clips]
    );

    const hasValidSource = useMemo(() => {
      return (source.urls && source.urls.length > 0) || !!source.manifestUrl || !!source.projectId;
    }, [source]);

    // ========================================================================
    // SOURCE LOADING
    // ========================================================================
    
    useEffect(() => {
      if (!hasValidSource) {
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      mountedRef.current = true;

      async function loadSource() {
        setIsLoading(true);
        setError(null);

        try {
          let urls: string[] = [];
          let hlsUrl: string | null = null;
          let audioUrl: string | null = null;

          // Fetch from database if projectId provided
          if (source.projectId) {
            // First check for existing HLS playlist in project
            const { data: project } = await supabase
              .from('movie_projects')
              .select('pending_video_tasks')
              .eq('id', source.projectId)
              .single();
            
            const tasks = project?.pending_video_tasks as Record<string, unknown> | null;
            hlsUrl = tasks?.hlsPlaylistUrl as string | null;
            audioUrl = tasks?.masterAudioUrl as string | null || source.masterAudioUrl || null;
            
            // If on iOS and HLS available, use it
            if (useHLSNative && hlsUrl) {
              logPlaybackPath('HLS_NATIVE', { 
                projectId: source.projectId, 
                hlsUrl,
                reason: 'iOS Safari detected with HLS playlist available'
              });
              setHlsPlaylistUrl(hlsUrl);
              setMasterAudioUrl(audioUrl);
              setIsLoading(false);
              return;
            }
            
            // Otherwise fetch clips for MSE/legacy
            const { data: dbClips, error: dbError } = await supabase
              .from('video_clips')
              .select('video_url, duration_seconds, shot_index')
              .eq('project_id', source.projectId)
              .eq('status', 'completed')
              .not('video_url', 'is', null)
              .order('shot_index', { ascending: true });

            if (dbError) {
              console.warn('[UniversalPlayer] DB fetch error:', dbError);
            } else if (dbClips && dbClips.length > 0) {
              urls = dbClips.map(c => c.video_url!).filter(Boolean);
            }
          }
          // Parse manifest if provided
          else if (source.manifestUrl) {
            const manifest = await parseManifest(source.manifestUrl);
            if (manifest) {
              // Check for HLS playlist in manifest
              const hlsManifest = manifest as any;
              if (useHLSNative && hlsManifest.hlsPlaylistUrl) {
                logPlaybackPath('HLS_NATIVE', { 
                  manifestUrl: source.manifestUrl,
                  hlsUrl: hlsManifest.hlsPlaylistUrl,
                  reason: 'iOS Safari detected with HLS manifest'
                });
                setHlsPlaylistUrl(hlsManifest.hlsPlaylistUrl);
                setMasterAudioUrl(hlsManifest.masterAudioUrl || hlsManifest.voiceUrl || null);
                setIsLoading(false);
                return;
              }
              
              if (manifest.clips) {
                urls = manifest.clips.map(c => c.videoUrl);
                audioUrl = (manifest as any).masterAudioUrl || (manifest as any).voiceUrl || null;
                setMasterAudioUrl(audioUrl);
              }
            }
          } else if (source.urls) {
            urls = source.urls;
          }

          if (!mountedRef.current) return;

          if (urls.length === 0) {
            setError('No video sources found');
            setIsLoading(false);
            return;
          }

          // Log the selected playback path
          const playbackPath = useMSE ? 'MSE_GAPLESS' : 'LEGACY_CROSSFADE';
          logPlaybackPath(playbackPath, {
            clipCount: urls.length,
            platformMode: platformCapabilities.preferredPlaybackMode,
            isMSESupported: platformCapabilities.supportsMSE,
          });

          // Initialize clips with estimated duration
          const initialClips = urls.map(url => ({
            url,
            duration: 5, // Default estimate
          }));
          setClips(initialClips);

          // For thumbnail mode, just set loading complete
          if (mode === 'thumbnail') {
            setIsLoading(false);
            return;
          }

          // Load clip metadata with HARDENED error handling
          const loadedClips = await Promise.all(
            urls.map(async (url, index) => {
              try {
                // CRITICAL: Check if still mounted before expensive operation
                if (!mountedRef.current || controller.signal.aborted) {
                  return { url, blobUrl: undefined, duration: 5 };
                }
                
                const blobUrl = await fetchAsBlob(url, controller.signal);
                
                // Check mount state again after async operation
                if (!mountedRef.current) {
                  // Clean up blob URL if we're unmounted
                  try { URL.revokeObjectURL(blobUrl); } catch {}
                  return { url, blobUrl: undefined, duration: 5 };
                }
                
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.muted = true;
                
                return new Promise<{ url: string; blobUrl: string; duration: number }>((resolve) => {
                  const timeout = setTimeout(() => {
                    resolve({ url, blobUrl, duration: 5 });
                  }, 10000);
                  
                  video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    const dur = video.duration;
                    resolve({ 
                      url, 
                      blobUrl, 
                      duration: isFinite(dur) && dur > 0 ? dur : 5 
                    });
                  };
                  video.onerror = () => {
                    clearTimeout(timeout);
                    resolve({ url, blobUrl, duration: 5 });
                  };
                  video.src = blobUrl;
                });
              } catch (err) {
                // CRITICAL: Suppress AbortError and other fetch errors
                const errorName = (err as Error)?.name || '';
                if (errorName === 'AbortError' || !mountedRef.current) {
                  return { url, blobUrl: undefined, duration: 5 };
                }
                console.debug('[UniversalPlayer] Clip load failed:', index, err);
                return { url, blobUrl: undefined, duration: 5 };
              }
            })
          );

          if (!mountedRef.current) return;

          setClips(loadedClips.filter((c): c is { url: string; blobUrl: string; duration: number } => !!c.blobUrl));
          setIsLoading(false);

          if (autoPlay) {
            setIsPlaying(true);
          }
        } catch (err) {
          // CRITICAL: Suppress AbortError completely
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
    }, [source, hasValidSource, mode, autoPlay]);

    // ========================================================================
    // MSE ENGINE INITIALIZATION
    // ========================================================================
    
    useEffect(() => {
      if (clips.length === 0 || mode === 'thumbnail' || !useMSE) return;
      if (mseEngineRef.current) return;
      
      const video = mseVideoRef.current;
      if (!video) return;

      const initMSE = async () => {
        try {
          const mseClips: MSEClip[] = clips.map((clip, index) => ({
            url: clip.blobUrl || clip.url,
            duration: clip.duration,
            index,
          }));

          const { engine, useFallback } = await createMSEEngine(video, mseClips, {
            onStateChange: (state) => {
              if (!mountedRef.current) return;
              setCurrentClipIndex(state.currentClipIndex);
              setCurrentTime(state.currentTime);
            },
            onClipChange: (index) => {
              if (!mountedRef.current) return;
              setCurrentClipIndex(index);
            },
            onEnded: () => {
              if (!mountedRef.current) return;
              setIsPlaying(false);
              if (loop) {
                setCurrentClipIndex(0);
                setCurrentTime(0);
              } else {
                onEnded?.();
              }
            },
            onError: () => {
              setUseMSE(false);
            },
          });

          mseEngineRef.current = engine;

          if (useFallback) {
            setUseMSE(false);
          } else {
            setMseReady(true);
          }
        } catch {
          setUseMSE(false);
        }
      };

      initMSE();

      return () => {
        mseEngineRef.current?.destroy();
        mseEngineRef.current = null;
      };
    }, [clips, mode, useMSE, loop, onEnded]);

    // Autoplay for MSE engine
    useEffect(() => {
      if (!useMSE || !mseReady || !autoPlay || mode === 'thumbnail') return;
      if (mseEngineRef.current && !isPlaying) {
        mseEngineRef.current.play();
        setIsPlaying(true);
      }
    }, [mseReady, autoPlay, useMSE, mode, isPlaying]);

    // ========================================================================
    // LEGACY FALLBACK: Dual-video setup with crossfade transitions
    // ========================================================================
    
    useEffect(() => {
      if (clips.length === 0 || mode === 'thumbnail' || useMSE) return;
      
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      if (!videoA || !clips[0]) return;

      videoA.src = clips[0].blobUrl || clips[0].url;
      videoA.load();

      // Preload second clip
      if (videoB && clips[1]) {
        videoB.src = clips[1].blobUrl || clips[1].url;
        videoB.load();
      }

      // Handle clip transitions via timeupdate
      const handleTimeUpdate = () => {
        if (!mountedRef.current || isTransitioningRef.current) return;
        
        const active = activeVideoIndex === 0 ? videoA : videoB;
        const duration = getSafeDuration(active);
        const currentT = active.currentTime;
        
        // Trigger transition near end of clip
        if (duration > 0 && currentT >= duration - TRANSITION_TRIGGER_OFFSET) {
          const nextIndex = currentClipIndex + 1;
          if (nextIndex < clips.length) {
            isTransitioningRef.current = true;
            
            // Setup next video
            const nextVideo = activeVideoIndex === 0 ? videoB : videoA;
            const nextClip = clips[nextIndex];
            if (nextVideo && nextClip) {
              nextVideo.src = nextClip.blobUrl || nextClip.url;
              nextVideo.load();
              nextVideo.currentTime = 0;
              
              // Start crossfade
              doubleRAF(() => {
                if (!mountedRef.current) return;
                
                // True overlap phase (both at 100%)
                if (activeVideoIndex === 0) {
                  setVideoBOpacity(1);
                } else {
                  setVideoAOpacity(1);
                }
                
                safePlay(nextVideo);
                
                // Fadeout phase after overlap
                setTimeout(() => {
                  if (!mountedRef.current) return;
                  if (activeVideoIndex === 0) {
                    setVideoAOpacity(0);
                  } else {
                    setVideoBOpacity(0);
                  }
                  
                  safePause(active);
                  setActiveVideoIndex(prev => prev === 0 ? 1 : 0);
                  setCurrentClipIndex(nextIndex);
                  isTransitioningRef.current = false;
                }, CROSSFADE_OVERLAP_MS);
              });
            }
          } else if (!loop) {
            // End of all clips
            setIsPlaying(false);
            onEnded?.();
          }
        }
        
        // Update current time for progress bar
        let elapsed = 0;
        for (let i = 0; i < currentClipIndex; i++) {
          elapsed += clips[i]?.duration || 0;
        }
        setCurrentTime(elapsed + currentT);
      };

      videoA.addEventListener('timeupdate', handleTimeUpdate);
      videoB?.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        videoA.removeEventListener('timeupdate', handleTimeUpdate);
        videoB?.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }, [clips, mode, useMSE, activeVideoIndex, currentClipIndex, loop, onEnded]);

    // Autoplay for legacy fallback
    useEffect(() => {
      if (useMSE || mode === 'thumbnail' || !autoPlay) return;
      if (clips.length === 0 || isLoading) return;
      
      const video = activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
      if (video) {
        safePlay(video);
        setIsPlaying(true);
      }
    }, [clips, isLoading, useMSE, mode, autoPlay, activeVideoIndex]);

    // ========================================================================
    // PLAYBACK CONTROLS
    // ========================================================================
    
    const togglePlayPause = useCallback(() => {
      if (useMSE && mseEngineRef.current) {
        if (isPlaying) {
          mseEngineRef.current.pause();
        } else {
          mseEngineRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } else {
        const video = activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
        if (!video) return;
        
        if (video.paused) {
          safePlay(video);
          setIsPlaying(true);
        } else {
          safePause(video);
          setIsPlaying(false);
        }
      }
    }, [isPlaying, useMSE, activeVideoIndex]);

    const toggleMute = useCallback(() => {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      
      if (mseVideoRef.current) mseVideoRef.current.muted = newMuted;
      if (videoARef.current) videoARef.current.muted = newMuted;
      if (videoBRef.current) videoBRef.current.muted = newMuted;
    }, [isMuted]);

    const handleSeek = useCallback((time: number) => {
      if (useMSE && mseEngineRef.current) {
        mseEngineRef.current.seek(time);
      } else {
        const video = activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
        safeSeek(video, time);
      }
      setCurrentTime(time);
    }, [useMSE, activeVideoIndex]);

    const goToPrevClip = useCallback(() => {
      if (currentClipIndex > 0) {
        setCurrentClipIndex(currentClipIndex - 1);
      }
    }, [currentClipIndex]);

    const goToNextClip = useCallback(() => {
      if (currentClipIndex < clips.length - 1) {
        setCurrentClipIndex(currentClipIndex + 1);
      }
    }, [currentClipIndex, clips.length]);

    const toggleFullscreen = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }, []);

    // ========================================================================
    // CONTROLS AUTO-HIDE
    // ========================================================================
    
    const handleMouseMove = useCallback(() => {
      setShowControlsState(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      if (controls.autoHideControls && isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControlsState(false);
        }, CONTROLS_HIDE_DELAY);
      }
    }, [controls.autoHideControls, isPlaying]);

    // ========================================================================
    // THUMBNAIL MODE HOVER PREVIEW
    // ========================================================================
    
    const handleThumbnailHover = useCallback((hovering: boolean) => {
      if (!hoverPreview) return;
      
      setIsHovered(hovering);
      const video = videoARef.current;
      
      if (hovering && video) {
        video.muted = true;
        safeSeek(video, 0);
        safePlay(video);
      } else if (video) {
        safePause(video);
        safeSeek(video, 0);
      }
    }, [hoverPreview]);

    // ========================================================================
    // CLEANUP
    // ========================================================================
    
    useEffect(() => {
      return () => {
        mountedRef.current = false;
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      };
    }, []);

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
            ref={videoARef}
            src={clips[0]?.blobUrl || clips[0]?.url || source.urls?.[0]}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-300",
              isHovered && "scale-105"
            )}
            muted
            loop
            playsInline
            preload="metadata"
          />

          {/* Gradient overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-50"
          )} />

          {/* Play button on hover */}
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

          {/* Title */}
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
          {/* Success glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-50" />
          
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/90 to-teal-500/10 border border-emerald-500/30">
            {/* Header */}
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
            
            {/* Video */}
            <div className="relative aspect-video bg-black/50">
              <video 
                ref={mseVideoRef}
                src={clips[0]?.blobUrl || clips[0]?.url}
                controls 
                className="w-full h-full object-contain" 
                playsInline
              />
            </div>
          </div>
        </motion.div>
      );
    }

    // ========================================================================
    // RENDER: HLS Native Mode (iOS Safari)
    // ========================================================================
    
    if (hlsPlaylistUrl && useHLSNative) {
      return (
        <HLSNativePlayer
          ref={ref}
          hlsUrl={hlsPlaylistUrl}
          masterAudioUrl={masterAudioUrl}
          muteClipAudio={!!masterAudioUrl}
          autoPlay={autoPlay}
          muted={isMuted}
          loop={loop}
          className={cn(
            mode === 'fullscreen' && "fixed inset-0 z-50",
            className
          )}
          onEnded={onEnded}
          onError={(err) => setError(err)}
          onTimeUpdate={(time, dur) => {
            setCurrentTime(time);
          }}
        />
      );
    }

    // ========================================================================
    // RENDER: Inline & Fullscreen Modes (MSE or Legacy)
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
        onMouseMove={handleMouseMove}
      >
        {/* Loading */}
        <AnimatePresence>
          {isLoading && <LoadingSkeleton />}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Film className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* Playback Path Indicator (dev only) */}
        {process.env.NODE_ENV === 'development' && !error && !isLoading && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-primary/80 text-primary-foreground text-xs rounded font-mono z-50">
            {useMSE ? 'MSE_GAPLESS' : 'LEGACY_CROSSFADE'}
          </div>
        )}

        {/* MSE Video Element */}
        {useMSE && !error && (
          <video
            ref={mseVideoRef}
            className="absolute inset-0 w-full h-full object-contain"
            muted={isMuted}
            playsInline
          />
        )}

        {/* Legacy Dual Video Elements */}
        {!useMSE && !error && (
          <>
            <video
              ref={videoARef}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-[30ms]"
              style={{ opacity: videoAOpacity }}
              muted={isMuted}
              playsInline
            />
            <video
              ref={videoBRef}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-[30ms]"
              style={{ opacity: videoBOpacity }}
              muted={isMuted}
              playsInline
            />
          </>
        )}

        {/* Background Music */}
        {source.musicUrl && (
          <audio
            ref={musicRef}
            src={source.musicUrl}
            loop
            muted={isMuted}
          />
        )}

        {/* Controls */}
        <AnimatePresence>
          {showControlsState && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ControlBar
                isPlaying={isPlaying}
                isMuted={isMuted}
                currentTime={currentTime}
                totalDuration={totalDuration}
                currentClipIndex={currentClipIndex}
                totalClips={clips.length}
                controls={controls}
                mode={mode}
                onPlayPause={togglePlayPause}
                onMuteToggle={toggleMute}
                onSeek={handleSeek}
                onPrevClip={goToPrevClip}
                onNextClip={goToNextClip}
                onFullscreen={toggleFullscreen}
                onDownload={onDownload}
                onClose={onClose}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen close button */}
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

        {/* Title overlay */}
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

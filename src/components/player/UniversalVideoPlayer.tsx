/**
 * UniversalVideoPlayer - Single unified video player for all contexts
 * 
 * Features:
 * - HLS-first playback strategy for ALL browsers (via hls.js)
 * - MSE gapless fallback when HLS not available
 * - Auto-detects source type (projectId, manifest, clips array, single video)
 * - Multiple display modes: inline, fullscreen, thumbnail, export
 * - Database fetching via projectId for multi-clip projects
 * - Unified controls with customizable visibility
 * - Safe video operations throughout
 * 
 * Playback Path Selection (Priority Order):
 * 1. HLS (ALL browsers) - via UniversalHLSPlayer with hls.js
 *    - Safari/iOS: Native HLS support
 *    - Chrome/Firefox/Edge: hls.js library
 * 2. MSE Gapless - for browsers without HLS playlist
 * 3. Legacy crossfade - fallback for older browsers
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
import { navigationCoordinator, useMediaCleanup, useRouteCleanup } from '@/lib/navigation';
import { 
  getPlatformCapabilities, 
  logPlaybackPath, 
  requiresHLSPlayback 
} from '@/lib/video/platformDetection';
import { HLSNativePlayer } from './HLSNativePlayer';
import { UniversalHLSPlayer } from './UniversalHLSPlayer';

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
    // PLATFORM DETECTION - HLS first for ALL browsers
    // ========================================================================
    
    const platformCapabilities = useMemo(() => getPlatformCapabilities(), []);
    // Use HLS for ALL browsers (Safari native, Chrome/Firefox via hls.js)
    const useHLSPlayback = true; // HLS-first strategy for universal playback
    const useHLSNative = platformCapabilities.preferredPlaybackMode === 'hls_native'; // Only iOS needs native
    
    // ========================================================================
    // STATE
    // ========================================================================
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clips, setClips] = useState<{ url: string; blobUrl?: string; duration: number }[]>([]);
    const [hlsPlaylistUrl, setHlsPlaylistUrl] = useState<string | null>(null);
    const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
    // Track if clips have embedded lip-sync audio (should NOT use master audio overlay)
    const [clipsAreLipSynced, setClipsAreLipSynced] = useState(false);
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
    const masterAudioRef = useRef<HTMLAudioElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const isTransitioningRef = useRef(false);
    const mountedRef = useRef(true);
    const cleanupUnsubRef = useRef<(() => void) | null>(null);
    const lastSyncTimeRef = useRef<number>(0);

    // ========================================================================
    // NAVIGATION CLEANUP REGISTRATION
    // ========================================================================
    
    // CRITICAL: Register ALL video/audio refs with NavigationCoordinator
    // so abortAllMedia() can pause them BEFORE React unmount races with new page mount
    useMediaCleanup(mseVideoRef);
    useMediaCleanup(videoARef);
    useMediaCleanup(videoBRef);
    useMediaCleanup(musicRef);
    useMediaCleanup(masterAudioRef);

    // CRITICAL: Destroy MSE engine and release all media BEFORE navigation starts
    useRouteCleanup(() => {
      try {
        [mseVideoRef, videoARef, videoBRef].forEach(ref => {
          const video = ref.current;
          if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load(); // Force release of media resources
          }
        });
        [musicRef, masterAudioRef].forEach(ref => {
          const audio = ref.current;
          if (audio) {
            audio.pause();
            audio.removeAttribute('src');
          }
        });
      } catch {
        // Ignore errors on destroyed elements
      }
      if (mseEngineRef.current) {
        mseEngineRef.current.destroy();
        mseEngineRef.current = null;
      }
    }, []);

    useEffect(() => {
      mountedRef.current = true;
      
      // Register cleanup with navigation coordinator (legacy path)
      cleanupUnsubRef.current = navigationCoordinator.registerGlobalCleanup(() => {
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
        
        if (mseEngineRef.current) {
          mseEngineRef.current.destroy();
          mseEngineRef.current = null;
        }
      });
      
      return () => {
        mountedRef.current = false;
        
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
              .select('pending_video_tasks, voice_audio_url, video_url')
              .eq('id', source.projectId)
              .maybeSingle();
            
            const tasks = project?.pending_video_tasks as Record<string, unknown> | null;
            hlsUrl = tasks?.hlsPlaylistUrl as string | null;
            // EMBEDDED AUDIO: No master audio overlay - clips use their native embedded audio
            audioUrl = null;
            console.log('[UniversalPlayer] 🎵 EMBEDDED AUDIO mode - using clip native audio, no master overlay');
            
            // HLS FIRST: Try to use HLS for ALL browsers (not just iOS)
            // This provides the most reliable cross-browser playback via hls.js
            if (useHLSPlayback && hlsUrl) {
              logPlaybackPath('HLS_UNIVERSAL', { 
                projectId: source.projectId, 
                hlsUrl,
                reason: 'HLS playlist available - using for all browsers via hls.js'
              });
              setHlsPlaylistUrl(hlsUrl);
              setMasterAudioUrl(audioUrl);
              setIsLoading(false);
              return;
            }
            
            // Check if we have any video content before trying HLS generation
            const hasVideoContent = tasks?.predictions || tasks?.hlsPlaylistUrl || project?.video_url;
            
            // Check if project is still generating (don't trigger HLS for incomplete projects)
            const hasIncompletePredictions = tasks?.predictions && Array.isArray(tasks.predictions) && 
              (tasks.predictions as Array<{ status?: string }>).some(p => p.status !== 'completed' && p.status !== 'failed');
            const isStillGenerating = tasks?.stage === 'async_video_generation' || hasIncompletePredictions;
            
            // Generate HLS playlist for ALL browsers when content is ready
            // CRITICAL: Don't generate HLS for projects still in progress
            if (useHLSPlayback && hasVideoContent && !isStillGenerating) {
              console.log('[UniversalPlayer] Generating server-side HLS playlist for universal playback');
              try {
                const { data: hlsResult, error: hlsError } = await supabase.functions.invoke('generate-hls-playlist', {
                  body: { projectId: source.projectId }
                });
                
                if (!hlsError && hlsResult?.hlsPlaylistUrl) {
                  logPlaybackPath('HLS_UNIVERSAL', { 
                    projectId: source.projectId, 
                    hlsUrl: hlsResult.hlsPlaylistUrl,
                    reason: 'Generated server-side HLS playlist for universal playback'
                  });
                  setHlsPlaylistUrl(hlsResult.hlsPlaylistUrl);
                  setMasterAudioUrl(audioUrl);
                  setIsLoading(false);
                  return;
                } else {
                  // Check if this is a "draft_or_incomplete" or "clips_pending" response - not an actual error
                  const errorReason = hlsResult?.reason || (hlsError as Record<string, unknown> | null)?.reason;
                  if (errorReason === 'draft_or_incomplete' || errorReason === 'clips_pending') {
                    console.log(`[UniversalPlayer] Project ${errorReason}, falling back to MSE/legacy`);
                  } else {
                    console.warn('[UniversalPlayer] HLS generation failed, falling back to MSE/legacy:', hlsError);
                  }
                }
              } catch (hlsGenError) {
                console.warn('[UniversalPlayer] HLS generation error, using MSE/legacy:', hlsGenError);
              }
              // Fall through to MSE/legacy mode
            } else if (useHLSPlayback && isStillGenerating) {
              console.log('[UniversalPlayer] Project still generating, using MSE/legacy for now');
            } else if (useHLSPlayback && !hasVideoContent) {
              console.log('[UniversalPlayer] No video content found, skipping HLS generation');
            }
            
            // Fetch clips for MSE/legacy
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
            
            // AVATAR FALLBACK: If no clips found, check pending_video_tasks for avatar-style videos
            if (urls.length === 0 && tasks) {
              // Check for avatar predictions array
              const predictions = tasks.predictions as Array<{ videoUrl?: string; status?: string; lipSynced?: boolean }> | undefined;
              if (predictions && Array.isArray(predictions)) {
                const completedPredictions = predictions.filter(p => p.videoUrl && p.status === 'completed');
                const avatarUrls = completedPredictions.map(p => p.videoUrl as string);
                if (avatarUrls.length > 0) {
                  urls = avatarUrls;
                  console.log('[UniversalPlayer] Using avatar predictions for playback:', urls.length, 'clips');
                  
                  // Check if ALL clips are lip-synced (have embedded audio)
                  const allLipSynced = completedPredictions.every(p => p.lipSynced === true);
                  if (allLipSynced) {
                    setClipsAreLipSynced(true);
                    console.log('[UniversalPlayer] All clips are lip-synced - using embedded video audio (no master audio overlay)');
                  }
                }
              }
            }
            
            // MANIFEST FALLBACK: If still no clips, check if video_url is a manifest and parse it
            if (urls.length === 0 && project?.video_url && typeof project.video_url === 'string') {
              const videoUrl = project.video_url;
              
              // If it's a manifest URL, parse it to get clip URLs
              if (videoUrl.endsWith('.json')) {
                console.log('[UniversalPlayer] video_url is manifest, parsing for clips...');
                const manifest = await parseManifest(videoUrl);
                if (manifest) {
                  // Check for HLS playlist in manifest (iOS path)
                  if (useHLSNative && (manifest as any).hlsPlaylistUrl) {
                    logPlaybackPath('HLS_NATIVE', { 
                      projectId: source.projectId,
                      hlsUrl: (manifest as any).hlsPlaylistUrl,
                      reason: 'Parsed HLS manifest from project video_url'
                    });
                    setHlsPlaylistUrl((manifest as any).hlsPlaylistUrl);
                    setMasterAudioUrl((manifest as any).masterAudioUrl || (manifest as any).voiceUrl || audioUrl);
                    setIsLoading(false);
                    return;
                  }
                  
                  // Extract clip URLs from manifest
                  if (manifest.clips && manifest.clips.length > 0) {
                    urls = manifest.clips.map(c => c.videoUrl).filter(Boolean);
                    console.log('[UniversalPlayer] Extracted', urls.length, 'clips from manifest');
                    
                    // Also get audio from manifest if available
                    if ((manifest as any).masterAudioUrl || (manifest as any).voiceUrl) {
                      audioUrl = (manifest as any).masterAudioUrl || (manifest as any).voiceUrl;
                      setMasterAudioUrl(audioUrl);
                    }
                  }
                }
              }
              // Direct video URL (not manifest)
              else if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.includes('/video-clips/')) {
                urls = [videoUrl];
                console.log('[UniversalPlayer] Using project video_url for playback');
              }
            }
            
            // Set master audio URL for MSE/Legacy playback (non-HLS path)
            if (audioUrl) {
              setMasterAudioUrl(audioUrl);
              console.log('[UniversalPlayer] Master audio URL set for avatar sync:', audioUrl.substring(0, 60), '...');
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
            audioUrl = source.masterAudioUrl || null;
            
            // Set master audio URL for direct URL playback
            if (audioUrl) {
              setMasterAudioUrl(audioUrl);
              console.log('[UniversalPlayer] Master audio URL from source:', audioUrl.substring(0, 60), '...');
            }
            
            // iOS Safari: Use legacy crossfade for direct URLs (server-side HLS needed for true gapless)
            // NOTE: Client-side blob-based M3U8 doesn't work on iOS (blob URLs can't reference external segments)
            if (useHLSNative && urls.length > 1) {
              console.log('[UniversalPlayer] iOS detected with direct URLs - using legacy crossfade (no server HLS available)');
              // Disable HLS mode, fall through to legacy crossfade
              setUseMSE(false);
            }
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
    
    // Ref to track the active video for transitions (avoids stale closure issues)
    const activeVideoIndexRef = useRef(activeVideoIndex);
    activeVideoIndexRef.current = activeVideoIndex;
    
    const currentClipIndexRef = useRef(currentClipIndex);
    currentClipIndexRef.current = currentClipIndex;
    
    // CRITICAL: Transition to next clip (called by both timeupdate and onEnded)
    const transitionToNextClip = useCallback(() => {
      if (!mountedRef.current || isTransitioningRef.current) return;
      
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      if (!videoA || !videoB) return;
      
      const currentIdx = currentClipIndexRef.current;
      const activeIdx = activeVideoIndexRef.current;
      const nextIndex = currentIdx + 1;
      
      if (nextIndex < clips.length) {
        isTransitioningRef.current = true;
        
        // Setup next video
        const active = activeIdx === 0 ? videoA : videoB;
        const nextVideo = activeIdx === 0 ? videoB : videoA;
        const nextClip = clips[nextIndex];
        
        if (nextVideo && nextClip) {
          // Set source only if different (may already be preloaded)
          const targetSrc = nextClip.blobUrl || nextClip.url;
          if (nextVideo.src !== targetSrc) {
            nextVideo.src = targetSrc;
            nextVideo.load();
          }
          nextVideo.currentTime = 0;
          
          // Function to execute the transition
          const executeTransition = async () => {
            if (!mountedRef.current) {
              isTransitioningRef.current = false;
              return;
            }
            
            try {
              // Start crossfade - bring next video to full opacity
              if (activeIdx === 0) {
                setVideoBOpacity(1);
              } else {
                setVideoAOpacity(1);
              }
              
              // CRITICAL: Play next video with promise handling
              const playResult = safePlay(nextVideo);
              if (playResult instanceof Promise) {
                await playResult;
              }
              
              // Complete transition after overlap period
              setTimeout(() => {
                if (!mountedRef.current) {
                  isTransitioningRef.current = false;
                  return;
                }
                
                // Fadeout old video
                if (activeIdx === 0) {
                  setVideoAOpacity(0);
                } else {
                  setVideoBOpacity(0);
                }
                
                safePause(active);
                
                // Update state
                setActiveVideoIndex(activeIdx === 0 ? 1 : 0);
                setCurrentClipIndex(nextIndex);
                
                // Preload the NEXT next clip (n+2) for even smoother transitions
                const futureIndex = nextIndex + 1;
                if (futureIndex < clips.length) {
                  const futureVideo = activeIdx === 0 ? videoA : videoB;
                  const futureClip = clips[futureIndex];
                  if (futureVideo && futureClip) {
                    setTimeout(() => {
                      futureVideo.src = futureClip.blobUrl || futureClip.url;
                      futureVideo.load();
                    }, 100);
                  }
                }
                
                isTransitioningRef.current = false;
              }, CROSSFADE_OVERLAP_MS);
              
            } catch (err) {
              console.warn('[UniversalPlayer] Transition play error:', err);
              // Still complete the transition even if play fails
              setActiveVideoIndex(activeIdx === 0 ? 1 : 0);
              setCurrentClipIndex(nextIndex);
              isTransitioningRef.current = false;
            }
          };
          
          // Wait for video to be ready, with fallback timeout
          const readyState = nextVideo.readyState;
          if (readyState >= 3) {
            // HAVE_FUTURE_DATA or better - video is ready
            executeTransition();
          } else {
            // Wait for canplaythrough (more reliable than canplay)
            const onReady = () => {
              nextVideo.removeEventListener('canplaythrough', onReady);
              nextVideo.removeEventListener('canplay', onReady);
              executeTransition();
            };
            
            nextVideo.addEventListener('canplaythrough', onReady, { once: true });
            nextVideo.addEventListener('canplay', onReady, { once: true });
            
            // Fallback: If not ready within 300ms, proceed anyway
            setTimeout(() => {
              if (isTransitioningRef.current && nextVideo.readyState < 3) {
                nextVideo.removeEventListener('canplaythrough', onReady);
                nextVideo.removeEventListener('canplay', onReady);
                console.log('[UniversalPlayer] Forcing transition after timeout');
                executeTransition();
              }
            }, 300);
          }
        } else {
          isTransitioningRef.current = false;
        }
      } else if (loop) {
        // Loop back to first clip
        isTransitioningRef.current = true;
        setCurrentClipIndex(0);
        setActiveVideoIndex(0);
        if (videoA && clips[0]) {
          videoA.src = clips[0].blobUrl || clips[0].url;
          videoA.load();
          videoA.currentTime = 0;
          setVideoAOpacity(1);
          setVideoBOpacity(0);
          safePlay(videoA);
        }
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 100);
      } else {
        // End of all clips
        setIsPlaying(false);
        onEnded?.();
      }
    }, [clips, loop, onEnded]);
    
    useEffect(() => {
      if (clips.length === 0 || mode === 'thumbnail' || useMSE) return;
      
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      if (!videoA || !clips[0]) return;

      // Set initial source
      videoA.src = clips[0].blobUrl || clips[0].url;
      videoA.load();

      // CRITICAL: Preload second clip immediately for seamless first transition
      if (videoB && clips[1]) {
        videoB.src = clips[1].blobUrl || clips[1].url;
        videoB.load();
        videoB.preload = 'auto';
      }

      // Handle clip transitions via timeupdate (proactive trigger near end)
      const handleTimeUpdate = () => {
        if (!mountedRef.current || isTransitioningRef.current) return;
        
        const activeIdx = activeVideoIndexRef.current;
        const active = activeIdx === 0 ? videoA : videoB;
        const duration = getSafeDuration(active);
        const currentT = active.currentTime;
        
        // Trigger transition near end of clip (150ms before end)
        if (duration > 0 && currentT >= duration - TRANSITION_TRIGGER_OFFSET) {
          transitionToNextClip();
        }
        
        // Update current time for progress bar
        const currentIdx = currentClipIndexRef.current;
        let elapsed = 0;
        for (let i = 0; i < currentIdx; i++) {
          elapsed += clips[i]?.duration || 0;
        }
        setCurrentTime(elapsed + currentT);
      };
      
      // CRITICAL: Handle onEnded as backup trigger for transitions
      // This catches cases where timeupdate misses the trigger window
      const handleEnded = () => {
        if (!mountedRef.current) return;
        console.log('[UniversalPlayer] Clip ended event fired, ensuring transition');
        // Small delay to avoid race with timeupdate
        setTimeout(() => {
          if (!isTransitioningRef.current) {
            transitionToNextClip();
          }
        }, 10);
      };

      videoA.addEventListener('timeupdate', handleTimeUpdate);
      videoB?.addEventListener('timeupdate', handleTimeUpdate);
      
      // CRITICAL: Add onEnded listeners as backup for gapless playback
      videoA.addEventListener('ended', handleEnded);
      videoB?.addEventListener('ended', handleEnded);

      return () => {
        videoA.removeEventListener('timeupdate', handleTimeUpdate);
        videoB?.removeEventListener('timeupdate', handleTimeUpdate);
        videoA.removeEventListener('ended', handleEnded);
        videoB?.removeEventListener('ended', handleEnded);
      };
    }, [clips, mode, useMSE, transitionToNextClip]);

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

    // NOTE: Master audio sync effects removed - using embedded video audio only
    // This ensures perfect audio-video sync without overlay drift issues

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
      
      // CRITICAL: Always use embedded video audio - do NOT use master audio overlay
      // The original audio was generated with the video and replacing it causes sync issues
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
    // RENDER: HLS Mode (ALL browsers via UniversalHLSPlayer with hls.js)
    // ========================================================================
    
    // Use UniversalHLSPlayer for ALL browsers when HLS playlist is available
    // This uses hls.js for Chrome/Firefox and native HLS for Safari/iOS
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
            onError={(err) => setError(err)}
            onTimeUpdate={(time, dur) => {
              setCurrentTime(time);
            }}
            onClose={onClose}
          />
        </div>
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

        {/* Error - FIXED: Don't use window.location.reload() */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Film className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => {
              // Reset state to trigger re-initialization instead of page reload
              setError(null);
              setIsLoading(true);
            }}>
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

        {/* MSE Video Element - mute when using master audio */}
        {useMSE && !error && (
          <video
            ref={mseVideoRef}
            className="absolute inset-0 w-full h-full object-contain"
            muted={isMuted}
            playsInline
          />
        )}

        {/* Legacy Dual Video Elements - always use embedded audio */}
        {!useMSE && !error && (
          <>
            <video
              ref={videoARef}
className="absolute inset-0 w-full h-full object-contain transition-opacity"
              style={{ opacity: videoAOpacity, transitionDuration: '30ms' }}
              muted={isMuted}
              playsInline
            />
            <video
              ref={videoBRef}
className="absolute inset-0 w-full h-full object-contain transition-opacity"
              style={{ opacity: videoBOpacity, transitionDuration: '30ms' }}
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

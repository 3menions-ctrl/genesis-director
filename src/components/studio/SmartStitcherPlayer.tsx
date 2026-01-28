/**
 * SmartStitcherPlayer v4 - True Gapless Playback with ForwardRef
 * 
 * Features:
 * - Dual video element switching for ZERO gap transitions
 * - Preloads next clip while current plays
 * - Seamless crossfade between clips
 * - High-quality RAF-based stitching export
 * - Quality selector (720p/1080p/1440p)
 * - Works offline, no Cloud Run timeouts
 * - ForwardRef compatible for AnimatePresence
 * - Enhanced error recovery and stall detection
 */

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Settings,
  Zap,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Quality presets
const QUALITY_PRESETS = {
  '720p': { width: 1280, height: 720, bitrate: 5_000_000, label: 'HD (720p)' },
  '1080p': { width: 1920, height: 1080, bitrate: 8_000_000, label: 'Full HD (1080p)' },
  '1440p': { width: 2560, height: 1440, bitrate: 16_000_000, label: 'QHD (1440p)' },
} as const;

type QualityKey = keyof typeof QUALITY_PRESETS;

interface ClipData {
  url: string;
  blobUrl?: string;
  duration: number;
  loaded: boolean;
  loading: boolean;
  error?: string;
  retries: number;
  videoWidth?: number;
  videoHeight?: number;
}

interface StitchState {
  status: 'idle' | 'loading' | 'stitching' | 'complete' | 'error' | 'cancelled';
  progress: number;
  message: string;
  phase?: string;
  currentClip?: number;
  blob?: Blob;
  url?: string;
  estimatedTimeRemaining?: number;
}

interface SmartStitcherPlayerProps {
  projectId: string;
  clipUrls?: string[];
  audioUrl?: string;
  onExportComplete?: (url: string) => void;
  className?: string;
  autoPlay?: boolean;
}

// Utility: Get best MIME type for encoding
function getBestMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

// Utility: Fetch video as blob for CORS reliability
async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Utility: Load video element with metadata
async function loadVideoElement(blobUrl: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const timeout = setTimeout(() => {
      video.src = '';
      reject(new Error('Metadata timeout'));
    }, 30000);
    
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve({
        duration: video.duration || 5,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      video.src = '';
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Video load failed'));
    };
    
    video.src = blobUrl;
  });
}

// Crossfade duration in milliseconds (0.15s like Cloud Run)
const CROSSFADE_DURATION = 150;

// ForwardRef wrapper for AnimatePresence compatibility
export const SmartStitcherPlayer = forwardRef<HTMLDivElement, SmartStitcherPlayerProps>(
  function SmartStitcherPlayerInner({
    projectId,
    clipUrls: providedClipUrls,
    audioUrl,
    onExportComplete,
    className,
    autoPlay = false,
  }, forwardedRef) {
  // Clip data
  const [clips, setClips] = useState<ClipData[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Player state
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Dual video element state for gapless playback with crossfade
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [videoAOpacity, setVideoAOpacity] = useState(1);
  const [videoBOpacity, setVideoBOpacity] = useState(0);

  // Stitch state
  const [stitchState, setStitchState] = useState<StitchState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [useStitchedVideo, setUseStitchedVideo] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityKey>('1080p');

  // Refs - Dual video elements for gapless switching
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const stitchedVideoRef = useRef<HTMLVideoElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const stitchCancelRef = useRef(false);
  const preloadedBlobs = useRef<Map<number, string>>(new Map());
  const isTransitioningRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const stallRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressTimeRef = useRef<number>(0);

  // Merge forwarded ref with internal ref
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    internalContainerRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  // Get active and standby video refs
  const getActiveVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
  }, [activeVideoIndex]);

  const getStandbyVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoBRef.current : videoARef.current;
  }, [activeVideoIndex]);

  // Calculate total duration
  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + (clip.duration || 0), 0),
    [clips]
  );
  const currentClip = clips[currentClipIndex];
  const loadedCount = clips.filter((c) => c.loaded).length;

  // Retry count for database fetches - increment triggers re-fetch
  const [fetchRetryCount, setFetchRetryCount] = useState(0);
  // Manual retry trigger - increment to force re-fetch
  const [manualRetryTrigger, setManualRetryTrigger] = useState(0);
  const maxFetchRetries = 3;

  // Fetch clips from database if not provided - with robust fallbacks
  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchAndLoadClips() {
      setIsLoadingClips(true);
      setLoadError(null);
      setLoadProgress(0);
      // Reset initial setup flag when fetching new clips
      initialSetupDoneRef.current = false;

      try {
        let urls: string[] = [];
        
        // Priority 1: Use provided clip URLs
        if (providedClipUrls && providedClipUrls.length > 0) {
          console.log('[SmartStitcher] Using provided clip URLs:', providedClipUrls.length);
          urls = providedClipUrls;
        } 
        
        // Priority 2: Check video_clips TABLE (completed clips with video_url)
        if (urls.length === 0) {
          console.log('[SmartStitcher] Fetching from video_clips table for project:', projectId);
          
          const { data: tableClips, error: tableError } = await supabase
            .from('video_clips')
            .select('id, video_url, shot_index, status, quality_score, created_at')
            .eq('project_id', projectId)
            .eq('status', 'completed')
            .not('video_url', 'is', null)
            .order('shot_index', { ascending: true })
            .order('quality_score', { ascending: false, nullsFirst: false });

          if (tableError) {
            console.error('[SmartStitcher] Error fetching from video_clips table:', tableError);
          } else if (tableClips && tableClips.length > 0) {
            // Select BEST clip per shot_index (highest quality_score)
            const bestClipsMap = new Map<number, typeof tableClips[0]>();
            for (const clip of tableClips) {
              const existing = bestClipsMap.get(clip.shot_index);
              if (!existing) {
                bestClipsMap.set(clip.shot_index, clip);
              } else {
                const existingScore = existing.quality_score ?? -1;
                const newScore = clip.quality_score ?? -1;
                if (newScore > existingScore || 
                    (newScore === existingScore && clip.created_at > existing.created_at)) {
                  bestClipsMap.set(clip.shot_index, clip);
                }
              }
            }
            
            const sortedClips = Array.from(bestClipsMap.values())
              .sort((a, b) => a.shot_index - b.shot_index);
            
            urls = sortedClips.map(c => c.video_url).filter(Boolean) as string[];
            console.log('[SmartStitcher] Found', urls.length, 'best clips from table');
          }
        }

        // Priority 3: Fallback to movie_projects.video_clips array
        if (urls.length === 0) {
          console.log('[SmartStitcher] Fallback to movie_projects.video_clips array');
          
          const { data: projectData, error: projectError } = await supabase
            .from('movie_projects')
            .select('video_clips, video_url')
            .eq('id', projectId)
            .maybeSingle();

          if (projectError) {
            console.error('[SmartStitcher] Error fetching project:', projectError);
          } else if (projectData?.video_clips?.length) {
            urls = projectData.video_clips.filter(Boolean);
            console.log('[SmartStitcher] Found', urls.length, 'clips from project array');
          } else if (projectData?.video_url && !projectData.video_url.endsWith('.json')) {
            // Single final video URL
            urls = [projectData.video_url];
            console.log('[SmartStitcher] Using single video_url');
          }
        }

        // Final check - no clips found
        if (urls.length === 0) {
          // Retry logic - maybe clips are still being saved
          if (fetchRetryCount < maxFetchRetries) {
            console.log(`[SmartStitcher] No clips found, retrying (${fetchRetryCount + 1}/${maxFetchRetries})...`);
            setFetchRetryCount(prev => prev + 1);
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
            return; // Exit and let the effect re-run
          }
          
          setLoadError('No completed clips found. Try clicking Retry or wait for clips to finish generating.');
          setIsLoadingClips(false);
          return;
        }

        // Reset retry count on success
        setFetchRetryCount(0);

        // Initialize clips array
        const initialClips: ClipData[] = urls.map((url) => ({
          url,
          duration: 5,
          loaded: false,
          loading: true,
          retries: 0,
        }));
        setClips(initialClips);

        // Load all clips in parallel with progress tracking
        const loadPromises = urls.map(async (url, index) => {
          const maxRetries = 3;
          let lastError: Error | null = null;
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (controller.signal.aborted) return;
            
            try {
              const blobUrl = await fetchAsBlob(url, controller.signal);
              const meta = await loadVideoElement(blobUrl);
              
              preloadedBlobs.current.set(index, blobUrl);
              
              setClips((prev) => {
                const updated = [...prev];
                updated[index] = {
                  ...updated[index],
                  blobUrl,
                  duration: meta.duration,
                  videoWidth: meta.width,
                  videoHeight: meta.height,
                  loaded: true,
                  loading: false,
                };
                return updated;
              });
              
              setLoadProgress((prev) => Math.min(prev + (100 / urls.length), 100));
              return;
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              console.warn(`[SmartStitcher] Clip ${index} load attempt ${attempt + 1} failed:`, lastError.message);
              if (attempt < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
              }
            }
          }
          
          // Mark as failed after all retries
          setClips((prev) => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              loaded: false,
              loading: false,
              error: lastError?.message || 'Load failed',
              retries: maxRetries,
            };
            return updated;
          });
          setLoadProgress((prev) => Math.min(prev + (100 / urls.length), 100));
        });

        await Promise.all(loadPromises);
        setIsLoadingClips(false);

        // Auto-play if enabled - start with first clip
        if (autoPlay) {
          pendingPlayRef.current = true;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[SmartStitcher] Failed to fetch clips:', err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load clips');
          setIsLoadingClips(false);
        }
      }
    }

    fetchAndLoadClips();
    
    return () => {
      controller.abort();
    };
  }, [projectId, providedClipUrls, autoPlay, fetchRetryCount, manualRetryTrigger]);

  // Track whether initial setup has been done (prevents re-running after transitions)
  const initialSetupDoneRef = useRef(false);

  // Setup first clip and preload second when clips are loaded - ONLY ONCE on initial load
  useEffect(() => {
    if (clips.length === 0 || isLoadingClips) return;
    
    // Ensure first clip has blobUrl before proceeding
    const firstClipReady = clips[0]?.blobUrl && clips[0]?.loaded;
    if (!firstClipReady) return;

    // CRITICAL: Only run initial setup ONCE to prevent resetting after transitions
    if (initialSetupDoneRef.current) return;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    
    // Load first clip into video A (starts as active)
    if (videoA && clips[0]?.blobUrl) {
      if (!videoA.src || videoA.src !== clips[0].blobUrl) {
        console.log('[SmartStitcher] Initial setup: Loading first clip into video A');
        videoA.src = clips[0].blobUrl;
        videoA.load();
      }
    }

    // Preload second clip into video B (starts as standby)
    if (videoB && clips[1]?.blobUrl && clips[1]?.loaded) {
      if (!videoB.src || videoB.src !== clips[1].blobUrl) {
        console.log('[SmartStitcher] Initial setup: Preloading second clip into video B');
        videoB.src = clips[1].blobUrl;
        videoB.load();
      }
    }

    // Mark initial setup as done
    initialSetupDoneRef.current = true;

    // Handle auto-play
    if (pendingPlayRef.current && videoA && videoA.src) {
      pendingPlayRef.current = false;
      // Wait for video to be ready to play
      const attemptPlay = () => {
        if (videoA.readyState >= 2) {
          console.log('[SmartStitcher] Auto-playing first clip');
          videoA.play().then(() => {
            setIsPlaying(true);
          }).catch((err) => {
            console.warn('[SmartStitcher] Auto-play failed:', err);
          });
        } else {
          // Video not ready yet, wait and retry
          setTimeout(attemptPlay, 100);
        }
      };
      setTimeout(attemptPlay, 100);
    }
  }, [clips, isLoadingClips]); // Removed getActiveVideo/getStandbyVideo from deps to prevent re-runs on activeVideoIndex change

  // Preload next clip into standby video when clip changes
  useEffect(() => {
    if (useStitchedVideo || isTransitioningRef.current) return;
    
    const standbyVideo = getStandbyVideo();
    const nextClipIndex = currentClipIndex + 1;
    
    if (standbyVideo && nextClipIndex < clips.length && clips[nextClipIndex]?.blobUrl) {
      // Only update if different
      if (standbyVideo.src !== clips[nextClipIndex].blobUrl) {
        standbyVideo.src = clips[nextClipIndex].blobUrl;
        standbyVideo.load();
      }
    }
  }, [currentClipIndex, clips, useStitchedVideo, getStandbyVideo]);

  // Ref for transition trigger to avoid hook dependency issues
  const triggerTransitionRef = useRef<(() => void) | null>(null);

  // Handle video time update - trigger transition BEFORE clip ends + stall detection
  const handleTimeUpdate = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!activeVideo || !currentClip) return;
    
    const clipTime = activeVideo.currentTime;
    const elapsedBefore = clips.slice(0, currentClipIndex).reduce((sum, c) => sum + c.duration, 0);
    setCurrentTime(elapsedBefore + clipTime);
    
    // Track last progress time for stall detection
    lastProgressTimeRef.current = Date.now();
    
    // Clear any stall recovery timeout since we're making progress
    if (stallRecoveryRef.current) {
      clearTimeout(stallRecoveryRef.current);
      stallRecoveryRef.current = null;
    }
    
    // Trigger seamless transition 0.15s before clip ends (crossfade duration)
    const timeRemaining = activeVideo.duration - activeVideo.currentTime;
    const crossfadeThreshold = CROSSFADE_DURATION / 1000; // 0.15s
    
    if (timeRemaining <= crossfadeThreshold && timeRemaining > 0 && !isTransitioningRef.current && !isCrossfading) {
      if (currentClipIndex < clips.length - 1) {
        // Trigger crossfade transition NOW, before clip ends
        // Use ref to access the function without circular dependency
        console.log('[SmartStitcher] Triggering crossfade transition from timeUpdate');
        triggerTransitionRef.current?.();
      }
    }
  }, [currentClipIndex, clips, currentClip, isCrossfading, getActiveVideo]);

  // Stall detection and recovery effect
  useEffect(() => {
    if (!isPlaying || isCrossfading || isTransitioningRef.current) return;
    
    const checkForStall = () => {
      const now = Date.now();
      const timeSinceLastProgress = now - lastProgressTimeRef.current;
      
      // If no progress in 3 seconds and we're supposed to be playing, try recovery
      if (timeSinceLastProgress > 3000 && lastProgressTimeRef.current > 0) {
        console.warn('[SmartStitcher] Video appears stalled, attempting recovery...');
        const activeVideo = getActiveVideo();
        
        if (activeVideo) {
          // Try to nudge playback forward
          const currentTime = activeVideo.currentTime;
          activeVideo.currentTime = currentTime + 0.01;
          
          // If near the end, force transition
          const timeRemaining = activeVideo.duration - activeVideo.currentTime;
          if (timeRemaining < 0.5 && currentClipIndex < clips.length - 1) {
            console.log('[SmartStitcher] Force triggering transition due to stall near end');
            triggerTransitionRef.current?.();
          } else {
            // Try to resume playback
            activeVideo.play().catch(() => {
              console.error('[SmartStitcher] Failed to resume after stall');
            });
          }
        }
        
        lastProgressTimeRef.current = now; // Reset to prevent repeated recovery attempts
      }
    };
    
    const stallCheckInterval = setInterval(checkForStall, 2000);
    
    return () => {
      clearInterval(stallCheckInterval);
      if (stallRecoveryRef.current) {
        clearTimeout(stallRecoveryRef.current);
      }
    };
  }, [isPlaying, isCrossfading, currentClipIndex, clips.length, getActiveVideo]);

  // Crossfade transition logic - extracted for reuse
  const triggerCrossfadeTransition = useCallback(() => {
    if (isTransitioningRef.current || isCrossfading) return;
    if (currentClipIndex >= clips.length - 1) return;
    
    isTransitioningRef.current = true;
    setIsCrossfading(true);
    
    const nextIndex = currentClipIndex + 1;
    const activeVideo = getActiveVideo();
    const standbyVideo = getStandbyVideo();
    
    if (standbyVideo && standbyVideo.readyState >= 2 && clips[nextIndex]?.blobUrl) {
      standbyVideo.currentTime = 0;
      
      // Start playing standby immediately
      standbyVideo.play().catch(() => {});
      
      // Animate crossfade
      const startTime = performance.now();
      const animateCrossfade = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / CROSSFADE_DURATION, 1);
        
        // Smooth easing
        const eased = 1 - Math.pow(1 - progress, 3);
        
        if (activeVideoIndex === 0) {
          setVideoAOpacity(1 - eased);
          setVideoBOpacity(eased);
        } else {
          setVideoAOpacity(eased);
          setVideoBOpacity(1 - eased);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateCrossfade);
        } else {
          // Crossfade complete
          setIsCrossfading(false);
          
          // Pause the old active
          if (activeVideo) {
            activeVideo.pause();
          }
          
          // Preload the NEXT clip into the old active (now standby)
          const futureClipIndex = nextIndex + 1;
          if (activeVideo && futureClipIndex < clips.length && clips[futureClipIndex]?.blobUrl) {
            activeVideo.src = clips[futureClipIndex].blobUrl;
            activeVideo.load();
          }
          isTransitioningRef.current = false;
        }
      };
      
      // Swap active/standby
      setActiveVideoIndex((prev) => (prev === 0 ? 1 : 0));
      setCurrentClipIndex(nextIndex);
      setIsPlaying(true); // Ensure playing state
      
      requestAnimationFrame(animateCrossfade);
    } else {
      // Fallback if standby not ready
      isTransitioningRef.current = false;
      setIsCrossfading(false);
    }
  }, [currentClipIndex, clips, isCrossfading, activeVideoIndex, getActiveVideo, getStandbyVideo]);

  // Keep the ref updated with the latest trigger function
  useEffect(() => {
    triggerTransitionRef.current = triggerCrossfadeTransition;
  }, [triggerCrossfadeTransition]);

  // Handle clip ended - fallback for end of playlist (transitions handled by timeupdate)
  const handleClipEnded = useCallback(() => {
    const activeVideo = getActiveVideo();
    
    // CRITICAL: Ignore spurious ended events
    // Safari/iOS can fire 'ended' when video hasn't actually played through
    // Check that the video has actually played for a reasonable duration
    if (activeVideo) {
      const actualDuration = activeVideo.duration;
      const currentPosition = activeVideo.currentTime;
      
      // If video hasn't played at least 90% of its duration, ignore the ended event
      // This prevents spurious resets on iOS/Safari
      if (actualDuration && currentPosition < actualDuration * 0.9) {
        console.warn('[SmartStitcher] Ignoring spurious ended event:', {
          currentPosition,
          duration: actualDuration,
          clipIndex: currentClipIndex
        });
        return;
      }
    }
    
    // If we're at the last clip and it ends, reset playlist
    if (currentClipIndex >= clips.length - 1) {
      console.log('[SmartStitcher] Last clip ended, resetting playlist');
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setCurrentTime(0);
      
      // Reset opacities
      setVideoAOpacity(1);
      setVideoBOpacity(0);
      setActiveVideoIndex(0);
      
      // Reset to first clip - but DON'T reload if already loaded
      const firstVideo = videoARef.current;
      if (firstVideo && clips[0]?.blobUrl) {
        if (firstVideo.src !== clips[0].blobUrl) {
          firstVideo.src = clips[0].blobUrl;
          firstVideo.load();
        } else {
          // Just seek to start instead of reloading
          firstVideo.currentTime = 0;
        }
      }
    } else if (!isTransitioningRef.current && !isCrossfading) {
      // Fallback: if clip ended but transition wasn't triggered, do it now
      triggerTransitionRef.current?.();
    }
  }, [currentClipIndex, clips, isCrossfading, getActiveVideo]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (useStitchedVideo) {
      const video = stitchedVideoRef.current;
      if (!video) return;
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
      return;
    }

    const video = getActiveVideo();
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, useStitchedVideo, getActiveVideo]);

  // Skip to next/previous clip
  const skipNext = useCallback(() => {
    if (useStitchedVideo && stitchedVideoRef.current) {
      stitchedVideoRef.current.currentTime += 5;
      return;
    }
    if (currentClipIndex < clips.length - 1) {
      const nextIndex = currentClipIndex + 1;
      const activeVideo = getActiveVideo();
      const standbyVideo = getStandbyVideo();
      
      if (standbyVideo && clips[nextIndex]?.blobUrl) {
        standbyVideo.currentTime = 0;
        if (isPlaying) {
          standbyVideo.play().catch(() => {});
        }
        setActiveVideoIndex((prev) => (prev === 0 ? 1 : 0));
        setCurrentClipIndex(nextIndex);
        
        if (activeVideo) {
          activeVideo.pause();
        }
      }
    }
  }, [currentClipIndex, clips.length, isPlaying, useStitchedVideo, getActiveVideo, getStandbyVideo, clips]);

  const skipPrev = useCallback(() => {
    if (useStitchedVideo && stitchedVideoRef.current) {
      stitchedVideoRef.current.currentTime = Math.max(0, stitchedVideoRef.current.currentTime - 5);
      return;
    }
    
    const activeVideo = getActiveVideo();
    
    if (currentClipIndex > 0) {
      const prevIndex = currentClipIndex - 1;
      
      if (activeVideo && clips[prevIndex]?.blobUrl) {
        activeVideo.src = clips[prevIndex].blobUrl;
        activeVideo.load();
        activeVideo.oncanplay = () => {
          activeVideo.oncanplay = null;
          if (isPlaying) {
            activeVideo.play().catch(() => {});
          }
        };
        setCurrentClipIndex(prevIndex);
      }
    } else if (activeVideo) {
      activeVideo.currentTime = 0;
    }
  }, [currentClipIndex, isPlaying, useStitchedVideo, getActiveVideo, clips]);

  // Jump to specific clip
  const jumpToClip = useCallback(
    (index: number) => {
      if (useStitchedVideo) return;
      if (index >= 0 && index < clips.length && clips[index].loaded) {
        const activeVideo = getActiveVideo();
        
        if (activeVideo && clips[index]?.blobUrl) {
          activeVideo.src = clips[index].blobUrl;
          activeVideo.load();
          activeVideo.oncanplay = () => {
            activeVideo.oncanplay = null;
            if (isPlaying) {
              activeVideo.play().catch(() => {});
            }
          };
          setCurrentClipIndex(index);
        }
      }
    },
    [clips, isPlaying, useStitchedVideo, getActiveVideo]
  );

  // Fullscreen toggle - Safari/iOS compatible
  const toggleFullscreen = useCallback(() => {
    if (!internalContainerRef.current) return;
    
    const elem = internalContainerRef.current as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    
    const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;
    
    if (isCurrentlyFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    }
  }, []);

  // Show/hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // High-quality stitching with RAF-based frame capture and crossfade transitions
  const startStitching = useCallback(async () => {
    const loadedClips = clips.filter((c) => c.loaded && c.blobUrl);
    if (loadedClips.length === 0) {
      toast.error('No clips available to stitch');
      return;
    }

    stitchCancelRef.current = false;
    const quality = QUALITY_PRESETS[selectedQuality];
    const fps = 30;
    const frameTime = 1000 / fps;
    const crossfadeDurationSec = CROSSFADE_DURATION / 1000; // 0.15s crossfade

    setStitchState({
      status: 'stitching',
      progress: 0,
      message: 'Initializing encoder...',
      phase: 'init',
    });

    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = quality.width;
      canvas.height = quality.height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Setup MediaRecorder with high quality
      const mimeType = getBestMimeType();
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality.bitrate,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(100);

      const totalClipDuration = loadedClips.reduce((s, c) => s + c.duration, 0);
      let processedTime = 0;
      const startTime = performance.now();

      // Helper to calculate draw dimensions
      const getDrawParams = (vw: number, vh: number) => {
        const canvasAspect = quality.width / quality.height;
        const videoAspect = vw / vh;
        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (videoAspect > canvasAspect) {
          drawH = quality.height;
          drawW = quality.height * videoAspect;
          drawX = (quality.width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = quality.width;
          drawH = quality.width / videoAspect;
          drawX = 0;
          drawY = (quality.height - drawH) / 2;
        }
        return { drawX, drawY, drawW, drawH };
      };

      // Preload all videos for crossfade access
      const preloadedVideos: HTMLVideoElement[] = [];
      for (const clip of loadedClips) {
        const video = document.createElement('video');
        video.src = clip.blobUrl!;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        await new Promise<void>((resolve, reject) => {
          video.oncanplaythrough = () => resolve();
          video.onerror = () => reject(new Error('Video preload failed'));
          video.load();
        });
        preloadedVideos.push(video);
      }

      // Process each clip with crossfade transitions
      for (let clipIdx = 0; clipIdx < loadedClips.length; clipIdx++) {
        if (stitchCancelRef.current) {
          recorder.stop();
          setStitchState({ status: 'cancelled', progress: 0, message: 'Cancelled' });
          return;
        }

        const clip = loadedClips[clipIdx];
        const video = preloadedVideos[clipIdx];
        const nextVideo = clipIdx < loadedClips.length - 1 ? preloadedVideos[clipIdx + 1] : null;
        
        setStitchState({
          status: 'stitching',
          progress: Math.round((processedTime / totalClipDuration) * 95),
          message: `Encoding clip ${clipIdx + 1}/${loadedClips.length}...`,
          phase: 'encoding',
          currentClip: clipIdx + 1,
        });

        const vw = video.videoWidth || quality.width;
        const vh = video.videoHeight || quality.height;
        const { drawX, drawY, drawW, drawH } = getDrawParams(vw, vh);

        // Get next video draw params for crossfade
        let nextDrawParams: { drawX: number; drawY: number; drawW: number; drawH: number } | null = null;
        if (nextVideo) {
          const nvw = nextVideo.videoWidth || quality.width;
          const nvh = nextVideo.videoHeight || quality.height;
          nextDrawParams = getDrawParams(nvw, nvh);
        }

        // Play video and capture frames
        video.currentTime = 0;
        await video.play();

        const clipDuration = video.duration;
        const crossfadeStart = Math.max(0, clipDuration - crossfadeDurationSec);
        let lastFrameTime = performance.now();

        // Prepare next video for crossfade
        if (nextVideo) {
          nextVideo.currentTime = 0;
        }

        while (video.currentTime < clipDuration - 0.02) {
          if (stitchCancelRef.current) break;

          const currentVideoTime = video.currentTime;
          const isInCrossfade = nextVideo && currentVideoTime >= crossfadeStart;

          // Clear canvas
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, quality.width, quality.height);

          if (isInCrossfade && nextVideo && nextDrawParams) {
            // Calculate crossfade progress (0 to 1)
            const fadeProgress = Math.min(1, (currentVideoTime - crossfadeStart) / crossfadeDurationSec);
            const eased = 1 - Math.pow(1 - fadeProgress, 2); // Ease-out

            // Draw current clip with decreasing opacity
            ctx.globalAlpha = 1 - eased;
            ctx.drawImage(video, drawX, drawY, drawW, drawH);

            // Draw next clip with increasing opacity
            ctx.globalAlpha = eased;
            ctx.drawImage(nextVideo, nextDrawParams.drawX, nextDrawParams.drawY, nextDrawParams.drawW, nextDrawParams.drawH);

            // Reset alpha
            ctx.globalAlpha = 1;

            // Advance next video during crossfade
            if (nextVideo.paused) {
              nextVideo.play().catch(() => {});
            }
          } else {
            // Normal frame - draw current video
            ctx.drawImage(video, drawX, drawY, drawW, drawH);
          }

          // Wait for next frame with precise timing
          const elapsed = performance.now() - lastFrameTime;
          const waitTime = Math.max(0, frameTime - elapsed);
          await new Promise((r) => setTimeout(r, waitTime));
          lastFrameTime = performance.now();

          // Update progress
          const currentProcessed = processedTime + video.currentTime;
          const elapsedTotal = (performance.now() - startTime) / 1000;
          const rate = currentProcessed / elapsedTotal;
          const remaining = rate > 0 ? (totalClipDuration - currentProcessed) / rate : 0;

          setStitchState({
            status: 'stitching',
            progress: Math.min(95, Math.round((currentProcessed / totalClipDuration) * 95)),
            message: `Encoding clip ${clipIdx + 1}/${loadedClips.length}...`,
            phase: 'encoding',
            currentClip: clipIdx + 1,
            estimatedTimeRemaining: Math.round(remaining),
          });
        }

        video.pause();
        processedTime += clipDuration;

        // If we did crossfade, the next video is already playing - pause it at crossfade end point
        if (nextVideo && !nextVideo.paused) {
          nextVideo.pause();
          // The next iteration will resume from where crossfade ended
        }
      }

      // Cleanup preloaded videos
      preloadedVideos.forEach(v => { v.pause(); v.src = ''; });

      // Finalize
      setStitchState({
        status: 'stitching',
        progress: 97,
        message: 'Finalizing video...',
        phase: 'finalizing',
      });

      // Stop recorder and get blob
      const finalBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        recorder.onerror = () => reject(new Error('MediaRecorder error'));
        recorder.stop();
      });

      const finalUrl = URL.createObjectURL(finalBlob);

      setStitchState({
        status: 'complete',
        progress: 100,
        message: `Ready! (${(finalBlob.size / 1024 / 1024).toFixed(1)}MB)`,
        blob: finalBlob,
        url: finalUrl,
      });

      toast.success('Video stitched successfully!');
    } catch (err) {
      console.error('Stitching failed:', err);
      setStitchState({
        status: 'error',
        progress: 0,
        message: err instanceof Error ? err.message : 'Stitching failed',
      });
      toast.error('Stitching failed - try again');
    }
  }, [clips, selectedQuality]);

  // Cancel stitching
  const cancelStitching = useCallback(() => {
    stitchCancelRef.current = true;
  }, []);

  // Download stitched video
  const downloadVideo = useCallback(() => {
    if (!stitchState.blob) return;
    const url = URL.createObjectURL(stitchState.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${projectId}-${selectedQuality}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started!');
  }, [stitchState.blob, projectId, selectedQuality]);

  // Upload stitched video
  const uploadVideo = useCallback(async () => {
    if (!stitchState.blob) return;

    try {
      toast.info('Uploading video...');

      const filename = `stitched-${projectId}-${selectedQuality}-${Date.now()}.webm`;
      const path = `stitched/${projectId}/${filename}`;

      const { error } = await supabase.storage.from('videos').upload(path, stitchState.blob, {
        contentType: stitchState.blob.type,
        upsert: true,
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);

      // Update project
      await supabase.from('movie_projects').update({ video_url: urlData.publicUrl }).eq('id', projectId);

      toast.success('Video saved to project!');
      onExportComplete?.(urlData.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed');
    }
  }, [stitchState.blob, projectId, selectedQuality, onExportComplete]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadedBlobs.current.forEach((url) => URL.revokeObjectURL(url));
      if (stitchState.url) URL.revokeObjectURL(stitchState.url);
    };
  }, []);

  // Retry handler for failed loads - triggers re-fetch from database
  // IMPORTANT: This hook must be before any early returns
  const handleRetry = useCallback(() => {
    console.log('[SmartStitcher] Manual retry triggered');
    setLoadError(null);
    setClips([]);
    setFetchRetryCount(0);
    setIsLoadingClips(true);
    // Increment manual trigger to force the useEffect to re-run
    setManualRetryTrigger(prev => prev + 1);
  }, []);

  // Loading state
  if (isLoadingClips) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-black rounded-xl aspect-video', className)}>
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm text-white/70">Loading clips...</p>
        <div className="w-48 mt-3">
          <Progress value={loadProgress} className="h-1.5" />
        </div>
        <p className="text-xs text-white/50 mt-2">
          {loadedCount} of {clips.length || '?'} clips loaded
        </p>
      </div>
    );
  }

  // Error state with smart retry
  if (loadError || (clips.length === 0 && !isLoadingClips)) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-black rounded-xl aspect-video', className)}>
        <AlertCircle className="w-10 h-10 text-destructive mb-4" />
        <p className="text-sm text-destructive text-center px-4">{loadError || 'No clips available'}</p>
        <p className="text-xs text-muted-foreground mt-2 text-center px-4">
          Clips may still be generating. Click Retry to check again.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 gap-2" 
          onClick={handleRetry}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const overallProgress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn('relative bg-black rounded-xl overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Dual Video Players for Gapless Playback with Crossfade */}
      {!useStitchedVideo && (
        <>
          {/* Video A */}
          <video
            ref={videoARef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ 
              opacity: videoAOpacity,
              zIndex: activeVideoIndex === 0 ? 10 : 5,
              transition: isCrossfading ? 'none' : 'opacity 0.1s ease-out'
            }}
            onTimeUpdate={activeVideoIndex === 0 ? handleTimeUpdate : undefined}
            onEnded={activeVideoIndex === 0 ? handleClipEnded : undefined}
            onPlay={() => activeVideoIndex === 0 && setIsPlaying(true)}
            onPause={() => activeVideoIndex === 0 && !isCrossfading && setIsPlaying(false)}
            onError={(e) => {
              console.error('[SmartStitcher] Video A error:', e);
              // Try to recover by forcing next clip if available
              if (activeVideoIndex === 0 && currentClipIndex < clips.length - 1) {
                console.log('[SmartStitcher] Attempting recovery by transitioning to next clip');
                triggerTransitionRef.current?.();
              }
            }}
            onStalled={() => {
              console.warn('[SmartStitcher] Video A stalled - attempting recovery');
              const video = videoARef.current;
              if (video && activeVideoIndex === 0 && isPlaying) {
                // Try to resume
                video.play().catch(() => {});
              }
            }}
            onWaiting={() => console.log('[SmartStitcher] Video A waiting for data')}
            muted={isMuted}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          />
          
          {/* Video B */}
          <video
            ref={videoBRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ 
              opacity: videoBOpacity,
              zIndex: activeVideoIndex === 1 ? 10 : 5,
              transition: isCrossfading ? 'none' : 'opacity 0.1s ease-out'
            }}
            onTimeUpdate={activeVideoIndex === 1 ? handleTimeUpdate : undefined}
            onEnded={activeVideoIndex === 1 ? handleClipEnded : undefined}
            onPlay={() => activeVideoIndex === 1 && setIsPlaying(true)}
            onPause={() => activeVideoIndex === 1 && !isCrossfading && setIsPlaying(false)}
            onError={(e) => {
              console.error('[SmartStitcher] Video B error:', e);
              // Try to recover by forcing next clip if available
              if (activeVideoIndex === 1 && currentClipIndex < clips.length - 1) {
                console.log('[SmartStitcher] Attempting recovery by transitioning to next clip');
                triggerTransitionRef.current?.();
              }
            }}
            onStalled={() => {
              console.warn('[SmartStitcher] Video B stalled - attempting recovery');
              const video = videoBRef.current;
              if (video && activeVideoIndex === 1 && isPlaying) {
                // Try to resume
                video.play().catch(() => {});
              }
            }}
            onWaiting={() => console.log('[SmartStitcher] Video B waiting for data')}
            muted={isMuted}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          />
        </>
      )}

      {/* Stitched Video Player */}
      {useStitchedVideo && stitchState.url && (
        <video
          ref={stitchedVideoRef}
          src={stitchState.url}
          className="w-full h-full object-contain"
          onTimeUpdate={() => stitchedVideoRef.current && setCurrentTime(stitchedVideoRef.current.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          playsInline
          controls={false}
        />
      )}

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 z-20"
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded font-medium">
                  {useStitchedVideo ? 'Stitched Video' : `Clip ${currentClipIndex + 1}/${clips.length}`}
                </span>
                {clips.some((c) => c.error) && (
                  <span className="text-xs text-amber-400 bg-black/50 px-2 py-1 rounded">
                    {clips.filter((c) => c.error).length} failed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Quality selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-white/80 hover:text-white hover:bg-white/20 text-xs gap-1">
                      <Monitor className="w-3 h-3" />
                      {selectedQuality}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.entries(QUALITY_PRESETS) as [QualityKey, typeof QUALITY_PRESETS[QualityKey]][]).map(([key, preset]) => (
                      <DropdownMenuItem key={key} onClick={() => setSelectedQuality(key)} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{preset.label}</span>
                          {key === selectedQuality && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Switch view toggle */}
                {stitchState.status === 'complete' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-white/80 hover:text-white hover:bg-white/20 text-xs gap-1"
                    onClick={() => setUseStitchedVideo(!useStitchedVideo)}
                  >
                    <Settings className="w-3 h-3" />
                    {useStitchedVideo ? 'Clips' : 'Stitched'}
                  </Button>
                )}
              </div>
            </div>

            {/* Center play button */}
            <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                {isPlaying ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white ml-1" />}
              </motion.div>
            </button>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/80 w-12 font-mono">{formatTime(currentTime)}</span>
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden relative group cursor-pointer">
                  <div className="h-full bg-primary transition-all duration-100" style={{ width: `${overallProgress}%` }} />
                  {/* Clip markers */}
                  {!useStitchedVideo &&
                    clips.slice(0, -1).map((_, idx) => {
                      const pos = (clips.slice(0, idx + 1).reduce((s, c) => s + c.duration, 0) / totalDuration) * 100;
                      return <div key={idx} className="absolute top-0 bottom-0 w-0.5 bg-white/40" style={{ left: `${pos}%` }} />;
                    })}
                </div>
                <span className="text-xs text-white/80 w-12 text-right font-mono">{formatTime(totalDuration)}</span>
              </div>

              {/* Clip dots */}
              {!useStitchedVideo && clips.length <= 20 && (
                <div className="flex gap-1.5 justify-center">
                  {clips.map((clip, idx) => (
                    <button
                      key={idx}
                      onClick={() => jumpToClip(idx)}
                      disabled={!clip.loaded}
                      className={cn(
                        'h-2 rounded-full transition-all duration-200',
                        idx === currentClipIndex ? 'bg-primary w-6' : clip.loaded ? 'bg-white/60 w-2 hover:bg-white/80' : 'bg-red-500/50 w-2',
                        !clip.loaded && 'cursor-not-allowed'
                      )}
                      title={clip.error ? `Error: ${clip.error}` : `Clip ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={skipPrev}>
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={skipNext}>
                    <SkipForward className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Stitch controls */}
                <div className="flex items-center gap-2">
                  {stitchState.status === 'idle' && (
                    <Button size="sm" className="h-8 bg-primary/90 hover:bg-primary text-xs gap-1.5" onClick={startStitching}>
                      <Zap className="w-3.5 h-3.5" />
                      Export {selectedQuality}
                    </Button>
                  )}

                  {stitchState.status === 'stitching' && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        <span className="text-xs text-white/80">{stitchState.progress}%</span>
                        {stitchState.estimatedTimeRemaining && (
                          <span className="text-xs text-white/50">~{stitchState.estimatedTimeRemaining}s</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-white/60 hover:text-white" onClick={cancelStitching}>
                        Cancel
                      </Button>
                    </div>
                  )}

                  {stitchState.status === 'complete' && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/20 text-xs gap-1.5" onClick={downloadVideo}>
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500 text-xs gap-1.5" onClick={uploadVideo}>
                        <Upload className="w-3.5 h-3.5" />
                        Save
                      </Button>
                    </>
                  )}

                  {stitchState.status === 'error' && (
                    <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={startStitching}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </Button>
                  )}
                </div>

                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stitch Progress Overlay */}
      <AnimatePresence>
        {stitchState.status === 'stitching' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-4 bottom-24 bg-black/80 backdrop-blur-sm rounded-lg p-4 z-30"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{stitchState.message}</p>
                <p className="text-xs text-white/60">
                  {stitchState.phase === 'encoding' && stitchState.currentClip
                    ? `Processing clip ${stitchState.currentClip} of ${clips.filter((c) => c.loaded).length}`
                    : stitchState.phase}
                </p>
              </div>
              {stitchState.estimatedTimeRemaining && (
                <span className="text-xs text-white/50">~{stitchState.estimatedTimeRemaining}s left</span>
              )}
            </div>
            <Progress value={stitchState.progress} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Badge */}
      <AnimatePresence>
        {stitchState.status === 'complete' && !useStitchedVideo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-emerald-500/90 backdrop-blur-sm rounded-lg px-3 py-1.5 z-30"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white">{stitchState.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Add display name for dev tools
SmartStitcherPlayer.displayName = 'SmartStitcherPlayer';

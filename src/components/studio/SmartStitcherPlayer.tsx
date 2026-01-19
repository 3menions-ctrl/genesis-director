/**
 * SmartStitcherPlayer - Unified Player + Stitcher
 * 
 * Plays clips seamlessly while optionally stitching them in the background.
 * Better UX than Cloud Run: instant playback + export when ready.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Film,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Settings,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClipData {
  url: string;
  blobUrl?: string;
  duration: number;
  loaded: boolean;
  error?: string;
}

interface StitchState {
  status: 'idle' | 'loading' | 'stitching' | 'complete' | 'error';
  progress: number;
  message: string;
  blob?: Blob;
  url?: string;
}

interface SmartStitcherPlayerProps {
  projectId: string;
  clipUrls?: string[];
  audioUrl?: string;
  onExportComplete?: (url: string) => void;
  className?: string;
  autoPlay?: boolean;
}

export function SmartStitcherPlayer({
  projectId,
  clipUrls: providedClipUrls,
  audioUrl,
  onExportComplete,
  className,
  autoPlay = false,
}: SmartStitcherPlayerProps) {
  // Clip data
  const [clips, setClips] = useState<ClipData[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Player state
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Stitch state
  const [stitchState, setStitchState] = useState<StitchState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [useStitchedVideo, setUseStitchedVideo] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const stitchedVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const preloadedVideos = useRef<Map<number, HTMLVideoElement>>(new Map());

  // Calculate total duration
  const totalDuration = clips.reduce((sum, clip) => sum + (clip.duration || 0), 0);
  const currentClip = clips[currentClipIndex];

  // Fetch clips from database if not provided
  useEffect(() => {
    if (providedClipUrls && providedClipUrls.length > 0) {
      initializeClips(providedClipUrls);
      return;
    }

    const fetchClips = async () => {
      setIsLoadingClips(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from('video_clips')
          .select('video_url, shot_index')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('shot_index', { ascending: true });

        if (error) throw error;

        const urls = data?.map((clip) => clip.video_url).filter(Boolean) as string[];
        if (urls.length === 0) {
          setLoadError('No completed clips found');
          setIsLoadingClips(false);
          return;
        }

        await initializeClips(urls);
      } catch (err) {
        console.error('Failed to fetch clips:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load clips');
        setIsLoadingClips(false);
      }
    };

    fetchClips();
  }, [projectId, providedClipUrls]);

  // Initialize clips with blob URLs for reliable playback
  const initializeClips = async (urls: string[]) => {
    setIsLoadingClips(true);
    const clipData: ClipData[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        // Fetch as blob for cross-origin reliability
        const response = await fetch(urls[i], { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Get duration
        const duration = await getVideoDuration(blobUrl);

        clipData.push({
          url: urls[i],
          blobUrl,
          duration,
          loaded: true,
        });

        // Update progress
        setClips([...clipData]);
      } catch (err) {
        console.warn(`Failed to load clip ${i + 1}:`, err);
        clipData.push({
          url: urls[i],
          duration: 5, // Fallback duration
          loaded: false,
          error: err instanceof Error ? err.message : 'Load failed',
        });
      }
    }

    setClips(clipData);
    setIsLoadingClips(false);

    // Preload first few clips
    preloadNextClips(0, clipData);

    if (autoPlay && clipData.length > 0 && clipData[0].loaded) {
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }, 100);
    }
  };

  // Get video duration from blob URL
  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration || 5);
        video.remove();
      };
      video.onerror = () => {
        resolve(5);
        video.remove();
      };
      video.src = url;
    });
  };

  // Preload upcoming clips
  const preloadNextClips = (currentIndex: number, clipsData: ClipData[] = clips) => {
    const toPreload = [currentIndex + 1, currentIndex + 2].filter(
      (i) => i < clipsData.length && clipsData[i]?.blobUrl
    );

    toPreload.forEach((idx) => {
      if (!preloadedVideos.current.has(idx)) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.src = clipsData[idx].blobUrl!;
        video.load();
        preloadedVideos.current.set(idx, video);
      }
    });
  };

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !currentClip) return;

    const clipTime = videoRef.current.currentTime;
    const elapsedBefore = clips
      .slice(0, currentClipIndex)
      .reduce((sum, c) => sum + c.duration, 0);
    setCurrentTime(elapsedBefore + clipTime);
  }, [currentClipIndex, clips, currentClip]);

  // Handle clip ended
  const handleClipEnded = useCallback(() => {
    if (currentClipIndex < clips.length - 1) {
      const nextIndex = currentClipIndex + 1;
      setCurrentClipIndex(nextIndex);
      preloadNextClips(nextIndex);

      // Seamless transition
      if (isPlaying && videoRef.current) {
        setTimeout(() => {
          videoRef.current?.play().catch(() => {});
        }, 50);
      }
    } else {
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setCurrentTime(0);
    }
  }, [currentClipIndex, clips.length, isPlaying]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const video = useStitchedVideo ? stitchedVideoRef.current : videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, useStitchedVideo]);

  // Skip to next/previous clip
  const skipNext = useCallback(() => {
    if (useStitchedVideo) {
      if (stitchedVideoRef.current) {
        stitchedVideoRef.current.currentTime += 5;
      }
      return;
    }
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex((prev) => prev + 1);
      if (isPlaying) {
        setTimeout(() => videoRef.current?.play().catch(() => {}), 50);
      }
    }
  }, [currentClipIndex, clips.length, isPlaying, useStitchedVideo]);

  const skipPrev = useCallback(() => {
    if (useStitchedVideo) {
      if (stitchedVideoRef.current) {
        stitchedVideoRef.current.currentTime = Math.max(
          0,
          stitchedVideoRef.current.currentTime - 5
        );
      }
      return;
    }
    if (currentClipIndex > 0) {
      setCurrentClipIndex((prev) => prev - 1);
      if (isPlaying) {
        setTimeout(() => videoRef.current?.play().catch(() => {}), 50);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [currentClipIndex, isPlaying, useStitchedVideo]);

  // Jump to specific clip
  const jumpToClip = useCallback(
    (index: number) => {
      if (useStitchedVideo) return;
      if (index >= 0 && index < clips.length) {
        setCurrentClipIndex(index);
        if (isPlaying) {
          setTimeout(() => videoRef.current?.play().catch(() => {}), 50);
        }
      }
    },
    [clips.length, isPlaying, useStitchedVideo]
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  // Show/hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // Start stitching process
  const startStitching = useCallback(async () => {
    if (clips.length === 0) return;

    setStitchState({ status: 'loading', progress: 0, message: 'Preparing clips...' });

    try {
      // Create canvas for stitching
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      // Get stream from canvas
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(100);

      setStitchState({
        status: 'stitching',
        progress: 5,
        message: 'Encoding video...',
      });

      let processedTime = 0;

      // Process each clip
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        if (!clip.blobUrl) continue;

        const video = document.createElement('video');
        video.src = clip.blobUrl;
        video.muted = true;
        await new Promise<void>((resolve) => {
          video.onloadeddata = () => resolve();
          video.load();
        });

        await video.play();

        // Draw frames
        const frameInterval = 1000 / 30;
        while (video.currentTime < video.duration - 0.05) {
          // Draw with proper scaling
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scale = Math.max(1280 / vw, 720 / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          const dx = (1280 - dw) / 2;
          const dy = (720 - dh) / 2;

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, 1280, 720);
          ctx.drawImage(video, dx, dy, dw, dh);

          await new Promise((r) => setTimeout(r, frameInterval));

          processedTime =
            clips.slice(0, i).reduce((s, c) => s + c.duration, 0) + video.currentTime;

          setStitchState({
            status: 'stitching',
            progress: 5 + Math.round((processedTime / totalDuration) * 90),
            message: `Encoding clip ${i + 1}/${clips.length}...`,
          });
        }

        video.pause();
        video.remove();
      }

      // Finalize
      setStitchState({ status: 'stitching', progress: 95, message: 'Finalizing...' });

      const finalBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = (e) => reject(e);
        recorder.stop();
      });

      const finalUrl = URL.createObjectURL(finalBlob);

      setStitchState({
        status: 'complete',
        progress: 100,
        message: 'Ready!',
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
      toast.error('Stitching failed');
    }
  }, [clips, totalDuration]);

  // Download stitched video
  const downloadVideo = useCallback(() => {
    if (!stitchState.blob) return;

    const url = URL.createObjectURL(stitchState.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${projectId}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started!');
  }, [stitchState.blob, projectId]);

  // Upload stitched video
  const uploadVideo = useCallback(async () => {
    if (!stitchState.blob) return;

    try {
      toast.info('Uploading video...');

      const filename = `stitched-${projectId}-${Date.now()}.webm`;
      const path = `stitched/${projectId}/${filename}`;

      const { error } = await supabase.storage
        .from('videos')
        .upload(path, stitchState.blob, {
          contentType: stitchState.blob.type,
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);

      // Update project
      await supabase
        .from('movie_projects')
        .update({ video_url: urlData.publicUrl })
        .eq('id', projectId);

      toast.success('Video saved!');
      onExportComplete?.(urlData.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed');
    }
  }, [stitchState.blob, projectId, onExportComplete]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clips.forEach((clip) => {
        if (clip.blobUrl) URL.revokeObjectURL(clip.blobUrl);
      });
      preloadedVideos.current.forEach((v) => v.remove());
      if (stitchState.url) URL.revokeObjectURL(stitchState.url);
    };
  }, []);

  // Render loading state
  if (isLoadingClips) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-black rounded-xl aspect-video',
          className
        )}
      >
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm text-white/70">Loading clips...</p>
        {clips.length > 0 && (
          <p className="text-xs text-white/50 mt-2">
            {clips.length} of {providedClipUrls?.length || '?'} loaded
          </p>
        )}
      </div>
    );
  }

  // Render error state
  if (loadError || clips.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-black rounded-xl aspect-video',
          className
        )}
      >
        <AlertCircle className="w-10 h-10 text-destructive mb-4" />
        <p className="text-sm text-destructive">{loadError || 'No clips available'}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const overallProgress = (currentTime / totalDuration) * 100;

  return (
    <div
      ref={containerRef}
      className={cn('relative bg-black rounded-xl overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Main Video Player */}
      {!useStitchedVideo && currentClip?.blobUrl && (
        <video
          ref={videoRef}
          src={currentClip.blobUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleClipEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          playsInline
        />
      )}

      {/* Stitched Video Player */}
      {useStitchedVideo && stitchState.url && (
        <video
          ref={stitchedVideoRef}
          src={stitchState.url}
          className="w-full h-full object-contain"
          onTimeUpdate={() => {
            if (stitchedVideoRef.current) {
              setCurrentTime(stitchedVideoRef.current.currentTime);
            }
          }}
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
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40"
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                  {useStitchedVideo
                    ? 'Stitched Video'
                    : `Clip ${currentClipIndex + 1}/${clips.length}`}
                </span>
                {clips.some((c) => !c.loaded) && (
                  <span className="text-xs text-amber-400 bg-black/50 px-2 py-1 rounded">
                    Some clips failed to load
                  </span>
                )}
              </div>

              {/* Stitch toggle */}
              {stitchState.status === 'complete' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/20 text-xs"
                  onClick={() => setUseStitchedVideo(!useStitchedVideo)}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  {useStitchedVideo ? 'View Clips' : 'View Stitched'}
                </Button>
              )}
            </div>

            {/* Center play button */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" />
                )}
              </motion.div>
            </button>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/80 w-10 font-mono">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${overallProgress}%` }}
                  />
                  {/* Clip markers (only in clip mode) */}
                  {!useStitchedVideo &&
                    clips.map((clip, idx) => {
                      const start =
                        clips.slice(0, idx).reduce((s, c) => s + c.duration, 0) /
                        totalDuration;
                      return (
                        <div
                          key={idx}
                          className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                          style={{ left: `${start * 100}%` }}
                        />
                      );
                    })}
                </div>
                <span className="text-xs text-white/80 w-10 text-right font-mono">
                  {formatTime(useStitchedVideo ? totalDuration : totalDuration)}
                </span>
              </div>

              {/* Clip indicators (only in clip mode) */}
              {!useStitchedVideo && (
                <div className="flex gap-1 justify-center">
                  {clips.map((clip, idx) => (
                    <button
                      key={idx}
                      onClick={() => jumpToClip(idx)}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        idx === currentClipIndex
                          ? 'bg-primary w-6'
                          : idx < currentClipIndex
                          ? 'bg-white/60 w-3'
                          : 'bg-white/30 w-3',
                        clip.error && 'bg-red-500/50'
                      )}
                      title={clip.error ? `Error: ${clip.error}` : `Clip ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20"
                    onClick={skipPrev}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20"
                    onClick={skipNext}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Stitch controls */}
                <div className="flex items-center gap-2">
                  {stitchState.status === 'idle' && (
                    <Button
                      size="sm"
                      className="h-8 bg-primary/80 hover:bg-primary text-xs gap-1.5"
                      onClick={startStitching}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Export Video
                    </Button>
                  )}

                  {stitchState.status === 'stitching' && (
                    <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span className="text-xs text-white/80">{stitchState.progress}%</span>
                    </div>
                  )}

                  {stitchState.status === 'complete' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-white hover:bg-white/20 text-xs gap-1.5"
                        onClick={downloadVideo}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-xs gap-1.5"
                        onClick={uploadVideo}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Save
                      </Button>
                    </>
                  )}

                  {stitchState.status === 'error' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={startStitching}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Export
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stitch Progress Overlay */}
      <AnimatePresence>
        {stitchState.status === 'stitching' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <Film className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm text-white">{stitchState.message}</span>
              <span className="text-xs text-white/60 ml-auto">{stitchState.progress}%</span>
            </div>
            <Progress value={stitchState.progress} className="h-1.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success badge */}
      <AnimatePresence>
        {stitchState.status === 'complete' && !showControls && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-3 right-3 bg-emerald-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Export Ready
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

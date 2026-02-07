import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Film, Image, User, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useMountSafe } from '@/lib/navigation';
import { useGalleryShowcase } from '@/hooks/useGalleryShowcase';
import type { GalleryCategory } from '@/types/gallery-showcase';
import { UniversalVideoPlayer, SimpleVideoPlayer, type SimpleVideoPlayerHandle } from '@/components/player';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';

type VideoCategory = 'all' | GalleryCategory;

// Utility: Detect if URL is a manifest JSON
function isManifestUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.endsWith('.json') || url.includes('manifest_');
}

// Parse manifest to extract HLS playlist URL
interface ManifestData {
  hlsPlaylistUrl?: string;
  clips?: Array<{ videoUrl: string; duration?: number }>;
  masterAudioUrl?: string;
}

async function parseManifestForHLS(manifestUrl: string): Promise<string | null> {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) return null;
    const data: ManifestData = await response.json();
    // Return HLS playlist URL if available
    if (data.hlsPlaylistUrl) {
      return data.hlsPlaylistUrl;
    }
    return null;
  } catch {
    console.warn('[ExamplesGallery] Failed to parse manifest:', manifestUrl);
    return null;
  }
}

interface ShowcaseVideo {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string | null;
  category: GalleryCategory;
}

const CATEGORY_CONFIG: Record<VideoCategory, { label: string; icon: typeof Film; description: string }> = {
  'all': {
    label: 'All Videos',
    icon: Sparkles,
    description: 'Browse our complete showcase',
  },
  'text-to-video': {
    label: 'Text to Video',
    icon: Film,
    description: 'Transform your ideas into cinematic films',
  },
  'image-to-video': {
    label: 'Image to Video',
    icon: Image,
    description: 'Bring your photos to life with motion',
  },
  'avatar': {
    label: 'AI Avatar',
    icon: User,
    description: 'Create lifelike speaking avatars',
  },
};

interface ExamplesGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper component to trigger load state for UniversalVideoPlayer
const LoadTrigger = memo(function LoadTrigger({ onLoad }: { onLoad: () => void }) {
  useEffect(() => {
    // Delay slightly to allow UniversalVideoPlayer to initialize
    const timer = setTimeout(onLoad, 500);
    return () => clearTimeout(timer);
  }, [onLoad]);
  return null;
});

const ExamplesGallery = memo(function ExamplesGallery({ open, onOpenChange }: ExamplesGalleryProps) {
  const { safeSetState, isMounted } = useMountSafe();
  const { data: galleryItems, isLoading: isLoadingGallery } = useGalleryShowcase();
  
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [isResolvingHLS, setIsResolvingHLS] = useState(false);
  const videoRef = useRef<SimpleVideoPlayerHandle>(null);
  const manifestPlayerRef = useRef<HTMLDivElement>(null);

  // Transform database items to ShowcaseVideo format
  const allVideos: ShowcaseVideo[] = useMemo(() => {
    if (!galleryItems) return [];
    return galleryItems.map(item => ({
      id: item.id,
      url: item.video_url,
      title: item.title,
      description: item.description || '',
      thumbnail: item.thumbnail_url,
      category: item.category,
    }));
  }, [galleryItems]);

  const filteredVideos = useMemo(() => {
    if (activeCategory === 'all') return allVideos;
    return allVideos.filter(v => v.category === activeCategory);
  }, [allVideos, activeCategory]);
  
  const currentVideo = filteredVideos[currentIndex] || filteredVideos[0];

  // Check if current video is a manifest
  const isCurrentManifest = useMemo(() => isManifestUrl(currentVideo?.url), [currentVideo?.url]);

  const goToNext = useCallback(() => {
    if (!isMounted()) return;
    safeSetState(setIsLoaded, false);
    safeSetState(setProgress, 0);
    safeSetState(setVideoError, null);
    safeSetState(setHlsUrl, null);
    safeSetState(setCurrentIndex, (prev) => (prev + 1) % filteredVideos.length);
  }, [isMounted, safeSetState, filteredVideos.length]);

  const goToPrev = useCallback(() => {
    if (!isMounted()) return;
    safeSetState(setIsLoaded, false);
    safeSetState(setProgress, 0);
    safeSetState(setVideoError, null);
    safeSetState(setHlsUrl, null);
    safeSetState(setCurrentIndex, (prev) => (prev - 1 + filteredVideos.length) % filteredVideos.length);
  }, [isMounted, safeSetState, filteredVideos.length]);

  // Resolve HLS URL from manifest when video changes
  useEffect(() => {
    if (!currentVideo?.url || !isCurrentManifest) {
      setHlsUrl(null);
      setIsResolvingHLS(false);
      return;
    }

    let cancelled = false;
    setIsResolvingHLS(true);
    setHlsUrl(null);

    parseManifestForHLS(currentVideo.url).then((resolvedUrl) => {
      if (cancelled) return;
      setHlsUrl(resolvedUrl);
      setIsResolvingHLS(false);
      if (resolvedUrl) {
        console.log('[ExamplesGallery] Resolved HLS URL:', resolvedUrl.substring(0, 60));
      }
    });

    return () => { cancelled = true; };
  }, [currentVideo?.url, isCurrentManifest]);

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsLoaded(false);
    setProgress(0);
    setHlsUrl(null);
  }, [activeCategory]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') onOpenChange(false);
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToNext, goToPrev, onOpenChange]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setActiveCategory('all');
      setCurrentIndex(0);
      setIsPlaying(true);
      setIsLoaded(false);
      setProgress(0);
      setHlsUrl(null);
      setVideoError(null);
    }
  }, [open]);

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    try {
      // CRITICAL: Guard against NaN/Infinity/0 duration crashes
      if (!duration || !isFinite(duration) || isNaN(duration) || duration <= 0) return;
      const progressPercent = (currentTime / duration) * 100;
      if (isFinite(progressPercent) && !isNaN(progressPercent)) {
        setProgress(progressPercent);
      }
    } catch {
      // Silently ignore any errors during time update
    }
  }, []);

  const handleCategoryChange = (category: VideoCategory) => {
    setActiveCategory(category);
  };

  // If loading gallery data or no videos available
  if (isLoadingGallery || allVideos.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black overflow-hidden rounded-none left-0 top-0 translate-x-0 translate-y-0 [&>button]:hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-white/60 animate-spin" />
            <p className="text-white/60 text-sm">Loading gallery...</p>
          </div>
          <button 
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 md:top-6 md:right-6 z-[9999] cursor-pointer w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group hover:bg-white/20 transition-all"
            aria-label="Close gallery"
          >
            <X className="w-5 h-5 md:w-7 md:h-7 text-white" strokeWidth={2} />
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black overflow-hidden rounded-none left-0 top-0 translate-x-0 translate-y-0 [&>button]:hidden">
        {/* Fullscreen Video - No boundaries */}
        <div className="absolute inset-0">
          {/* Loading state */}
          {(!isLoaded || isResolvingHLS) && !videoError && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
          )}

          {/* Error state */}
          {videoError && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-4">
              <AlertCircle className="w-12 h-12 text-red-400/60" />
              <p className="text-white/60 text-sm max-w-xs text-center">{videoError}</p>
              <button
                onClick={goToNext}
                className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors text-sm"
              >
                Try next video
              </button>
            </div>
          )}

          {/* Video Player - Use HLS for manifest videos (seamless), SimpleVideoPlayer for direct MP4s */}
          {currentVideo && !videoError && (
            // For manifest videos: use resolved HLS URL with SimpleVideoPlayer for seamless playback
            isCurrentManifest ? (
              hlsUrl ? (
                <SimpleVideoPlayer
                  ref={videoRef}
                  key={`hls-${activeCategory}-${currentIndex}`}
                  src={hlsUrl}
                  autoPlay={isPlaying}
                  muted={isMuted}
                  loop
                  showControls={false}
                  onCanPlay={() => setIsLoaded(true)}
                  onTimeUpdate={handleTimeUpdate}
                  onError={() => setVideoError('Failed to load HLS stream')}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                    isLoaded ? "opacity-100" : "opacity-0"
                  )}
                />
              ) : !isResolvingHLS ? (
                // Fallback to UniversalVideoPlayer if no HLS URL found
                <div 
                  key={`manifest-${activeCategory}-${currentIndex}`}
                  className="absolute inset-0 w-full h-full"
                >
                  <UniversalVideoPlayer
                    source={{ manifestUrl: currentVideo.url }}
                    mode="inline"
                    autoPlay={isPlaying}
                    muted={isMuted}
                    className="w-full h-full [&_video]:object-cover"
                  />
                  <LoadTrigger onLoad={() => setIsLoaded(true)} />
                </div>
              ) : null
            ) : (
              // Direct MP4/video files - use SimpleVideoPlayer
              <SimpleVideoPlayer
                ref={videoRef}
                key={`video-${activeCategory}-${currentIndex}`}
                src={currentVideo.url}
                autoPlay={isPlaying}
                muted={isMuted}
                loop
                showControls={false}
                onCanPlay={() => setIsLoaded(true)}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setVideoError('Failed to load video')}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            )
          )}

          {/* Subtle vignette for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
          
          {/* Bottom gradient for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          {/* Top gradient for controls */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        </div>

        {/* Close X button - Top right corner */}
        <button 
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 md:top-6 md:right-6 z-[9999] cursor-pointer w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group hover:bg-white/20 transition-all"
          aria-label="Close gallery"
        >
          <X className="w-5 h-5 md:w-7 md:h-7 text-white group-hover:scale-110 transition-transform" strokeWidth={2} />
        </button>

        {/* Category Tabs - Top center, responsive for mobile */}
        <div className="absolute top-14 md:top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-auto">
          <div className="flex items-center justify-center gap-1 md:gap-2 p-1 md:p-1.5 rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15">
            {(Object.keys(CATEGORY_CONFIG) as VideoCategory[]).map((category) => {
              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;
              const isActive = activeCategory === category;
              const count = category === 'all' 
                ? allVideos.length 
                : allVideos.filter(v => v.category === category).length;
              
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={cn(
                    "flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl transition-all duration-300",
                    isActive 
                      ? "bg-white text-black shadow-lg" 
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden md:inline text-sm font-medium whitespace-nowrap">{config.label}</span>
                  <span className={cn(
                    "text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-black/10" : "bg-white/10"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Counter - Top left */}
        <div className="absolute top-3 left-3 md:top-6 md:left-6 z-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
          <span className="text-xs md:text-sm font-medium text-white/60">
            <span className="text-white">{currentIndex + 1}</span> / {filteredVideos.length}
          </span>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={goToPrev}
          className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-50 w-10 h-10 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110 group"
        >
          <ChevronLeft className="w-5 h-5 md:w-7 md:h-7 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        
        <button
          onClick={goToNext}
          className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 z-50 w-10 h-10 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110 group"
        >
          <ChevronRight className="w-5 h-5 md:w-7 md:h-7 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Video info overlay - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-10 z-40 pb-24 md:pb-10">
          <div className="max-w-4xl">
            {/* Category badge */}
            <div className="mb-2 md:mb-4">
              {currentVideo && (
                <span className="inline-flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-xs md:text-sm">
                  {(() => {
                    const Icon = CATEGORY_CONFIG[currentVideo.category].icon;
                    return <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />;
                  })()}
                  <span className="hidden md:inline">{CATEGORY_CONFIG[currentVideo.category].label}</span>
                </span>
              )}
            </div>
            
            <div className="animate-fade-in mb-4 md:mb-6">
              <h3 className="text-xl md:text-4xl lg:text-5xl font-bold text-white mb-1 md:mb-3">{currentVideo?.title}</h3>
              <p className="text-white/60 text-sm md:text-xl max-w-2xl line-clamp-2 md:line-clamp-none">{currentVideo?.description}</p>
            </div>

            {/* Controls row - Only show for non-manifest videos (UniversalVideoPlayer has its own controls) */}
            {!isCurrentManifest && (
              <div className="flex items-center gap-2 md:gap-4">
                {/* Play/Pause */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play();
                      }
                      setIsPlaying(!isPlaying);
                    }
                  }}
                  className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-4 h-4 md:w-6 md:h-6" /> : <Play className="w-4 h-4 md:w-6 md:h-6 ml-0.5" />}
                </button>
                
                {/* Mute/Unmute */}
                <button
                  onClick={() => {
                    const videoEl = videoRef.current?.getVideoElement();
                    if (videoEl) {
                      videoEl.muted = !videoEl.muted;
                      setIsMuted(videoEl.muted);
                    }
                  }}
                  className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all hover:scale-105"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 md:w-6 md:h-6" /> : <Volume2 className="w-4 h-4 md:w-6 md:h-6" />}
                </button>

                {/* Progress bar */}
                <div className="flex-1 h-1 md:h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail strip at bottom - hidden on mobile to save space */}
        <div className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
            {filteredVideos.slice(0, 8).map((video, i) => (
              <button
                key={`${video.id}-${i}`}
                onClick={() => {
                  setIsLoaded(false);
                  setProgress(0);
                  setVideoError(null);
                  setCurrentIndex(i);
                }}
                className={cn(
                  "relative w-20 h-12 rounded-lg overflow-hidden transition-all duration-300",
                  currentIndex === i 
                    ? "ring-2 ring-white/80 ring-offset-2 ring-offset-black/50 scale-110" 
                    : "opacity-50 hover:opacity-80 hover:scale-105"
                )}
              >
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PausedFrameVideo
                    src={video.url}
                    className="w-full h-full object-cover"
                    showLoader={false}
                  />
                )}
                {currentIndex === i && (
                  <div className="absolute inset-0 bg-white/10" />
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ExamplesGallery;

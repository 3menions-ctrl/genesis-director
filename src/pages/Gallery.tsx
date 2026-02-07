import React, { useState, useEffect, useRef, useCallback, forwardRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Film, Type, Image, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';
import { FamousAvatarsShowcase } from '@/components/gallery/FamousAvatarsShowcase';
import { PremiumGalleryBackground } from '@/components/gallery/PremiumGalleryBackground';
import { PremiumVideoCard } from '@/components/gallery/PremiumVideoCard';
import { PremiumCategoryNav } from '@/components/gallery/PremiumCategoryNav';
import { PremiumFullscreenPlayer } from '@/components/gallery/PremiumFullscreenPlayer';
import { PremiumCarouselControls } from '@/components/gallery/PremiumCarouselControls';
import { GalleryHeroSection } from '@/components/gallery/GalleryHeroSection';

// Video category type
type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  all_clips?: string[];
  hlsPlaylistUrl?: string | null; // HLS URL for seamless playback
  category?: VideoCategory;
  mode?: string | null;
}

interface ManifestClip {
  index: number;
  videoUrl: string;
  duration: number;
}

interface VideoManifest {
  clips: ManifestClip[];
  totalDuration: number;
  hlsPlaylistUrl?: string;
}

// Category configuration
const CATEGORIES: { id: VideoCategory; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'all', label: 'All Videos', icon: Sparkles, description: 'Browse our complete collection' },
  { id: 'text-to-video', label: 'Text to Video', icon: Type, description: 'Transform words into cinematic scenes' },
  { id: 'image-to-video', label: 'Image to Video', icon: Image, description: 'Bring static images to life' },
  { id: 'avatar', label: 'AI Avatar', icon: User, description: 'Realistic talking avatars' },
];

const useGalleryVideos = () => {
  return useQuery({
    queryKey: ['gallery-videos-showcase'],
    queryFn: async (): Promise<GalleryVideo[]> => {
      try {
        // Fetch from gallery_showcase table (admin-curated videos)
        const { data, error } = await supabase
          .from('gallery_showcase')
          .select('id, video_url, thumbnail_url, category, title')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        
        if (error) throw error;
        if (!data || data.length === 0) return [];
        
        const videosWithClips = await Promise.all(
          data.map(async (item) => {
            const url = item.video_url || '';
            // Map gallery_showcase category to VideoCategory
            const category = (item.category as VideoCategory) || 'text-to-video';
            
            if (url.endsWith('.json') || url.includes('manifest_')) {
              try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const manifest: VideoManifest = await response.json();
                
                if (manifest.clips && manifest.clips.length > 0) {
                  return {
                    id: item.id,
                    title: item.title || '',
                    thumbnail_url: item.thumbnail_url,
                    video_url: manifest.clips[0].videoUrl,
                    all_clips: manifest.clips.map(c => c.videoUrl),
                    hlsPlaylistUrl: manifest.hlsPlaylistUrl || null, // Pass HLS URL for seamless playback
                    category,
                    mode: null,
                  };
                }
              } catch (e) {
                console.debug('Failed to fetch manifest:', e);
                return null;
              }
            }
            
            if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
              return {
                id: item.id,
                title: item.title || '',
                thumbnail_url: item.thumbnail_url,
                video_url: url,
                all_clips: [url],
                category,
                mode: null,
              };
            }
            
            return null;
          })
        );
        
        return videosWithClips.filter((v): v is NonNullable<typeof v> => v !== null);
      } catch (error) {
        console.error('Gallery fetch error:', error);
        return []; // Return empty array instead of throwing to prevent crash
      }
    },
    retry: 1, // Limit retries to prevent infinite loops
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Main Gallery component with hook resilience
const GalleryContent = memo(function GalleryContent() {
  // CRITICAL: All hooks MUST be called unconditionally at the top
  // React requires consistent hook order on every render
  
  // 1. All useState hooks first
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<GalleryVideo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('all');
  const [showAvatarSection, setShowAvatarSection] = useState(false);
  
  // 2. All useRef hooks
  const avatarSectionRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  
  // 3. Custom hooks (order must be stable)
  const { navigate } = useSafeNavigation();
  const { getSignal, isMounted } = useNavigationAbort();
  const location = useLocation(); // No try-catch - it's in a Router context
  const { data: videos = [], isLoading } = useGalleryVideos();
  
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    setSelectedVideo(null);
    sessionStorage.removeItem('gallery_access');
  }, []);
  
  // Filter videos by category
  const filteredVideos = useMemo(() => {
    if (activeCategory === 'all') return videos;
    return videos.filter(v => v.category === activeCategory);
  }, [videos, activeCategory]);
  
  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<VideoCategory, number> = {
      'all': videos.length,
      'text-to-video': 0,
      'image-to-video': 0,
      'avatar': 0,
    };
    videos.forEach(v => {
      if (v.category && v.category !== 'all') {
        counts[v.category]++;
      }
    });
    return counts;
  }, [videos]);
  
  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeCategory]);
  
  // Access control
  useEffect(() => {
    const fromAnimation = location.state?.fromAnimation === true;
    const sessionAccess = sessionStorage.getItem('gallery_access') === 'true';
    
    if (fromAnimation || sessionAccess) {
      if (fromAnimation) sessionStorage.setItem('gallery_access', 'true');
      setHasAccess(true);
    } else {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);
  
  // Scroll/wheel navigation with debounce
  const scrollThreshold = 300; // ms between scroll events
  
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedVideo) return;
      
      const now = Date.now();
      if (now - lastScrollTime.current < scrollThreshold) return;
      
      // Determine scroll direction (support both vertical and horizontal scroll)
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      
      if (delta > 20 && currentIndex < filteredVideos.length - 1) {
        lastScrollTime.current = now;
        setCurrentIndex(prev => prev + 1);
        setScrollProgress(prev => prev + 0.1);
      } else if (delta < -20 && currentIndex > 0) {
        lastScrollTime.current = now;
        setCurrentIndex(prev => prev - 1);
        setScrollProgress(prev => prev - 0.1);
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, filteredVideos.length, selectedVideo]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideo) return;
      
      if (e.key === 'ArrowRight' && currentIndex < filteredVideos.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setScrollProgress(prev => prev + 0.1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setScrollProgress(prev => prev - 0.1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredVideos.length, selectedVideo]);
  
  const goNext = () => {
    if (currentIndex < filteredVideos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setScrollProgress(prev => prev + 0.1);
    }
  };
  
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setScrollProgress(prev => prev - 0.1);
    }
  };
  
  const handleCategoryChange = (category: VideoCategory) => {
    setActiveCategory(category);
  };
  
  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-500/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }
  
  // STABILITY FIX: Added try-catch and requestAnimationFrame for safer scroll
  const scrollToAvatars = useCallback(() => {
    try {
      setShowAvatarSection(true);
      // Use requestAnimationFrame to ensure DOM is ready before scrolling
      requestAnimationFrame(() => {
        setTimeout(() => {
          avatarSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      });
    } catch (e) {
      console.debug('[Gallery] scrollToAvatars error:', e);
    }
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden">
      {/* Video Gallery Section - Full screen */}
      <div className="min-h-screen relative">
        <PremiumGalleryBackground scrollProgress={scrollProgress} activeCategory={activeCategory} />
      
      {/* Hero section with back button and avatar button */}
      <GalleryHeroSection
        onBack={() => navigate('/')}
        onScrollToAvatars={scrollToAvatars}
        showAvatarHint={!selectedVideo && filteredVideos.length > 0}
      />
      
      {/* Premium category navigation */}
      <PremiumCategoryNav
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        categoryCounts={categoryCounts}
      />
      
      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-10 h-10 border-2 border-slate-500/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}
      
      {/* Immersive video showcase */}
      {!isLoading && filteredVideos.length > 0 && (
        <>
          <div className="fixed inset-0 flex items-center justify-center pt-24">
            {/* Video cards carousel with depth effect */}
            <div className="relative flex items-center justify-center">
            {filteredVideos.map((video, index) => {
              const distance = index - currentIndex;
              const isVisible = Math.abs(distance) <= 2;
              
              if (!isVisible) return null;
              
              // Calculate depth-based transforms
              const absDistance = Math.abs(distance);
              const scale = 1 - absDistance * 0.15;
              const blur = absDistance * 2;
              const xOffset = distance * 350;
              
              return (
                <motion.div
                  key={video.id}
                  className="absolute"
                  animate={{
                    x: xOffset,
                    z: -absDistance * 100,
                    scale,
                    filter: `blur(${blur}px)`,
                  }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 300, 
                    damping: 35,
                  }}
                  style={{
                    zIndex: 10 - absDistance,
                  }}
                >
                  <PremiumVideoCard
                    video={video}
                    isActive={distance === 0}
                    onClick={() => setSelectedVideo(video)}
                    index={index}
                  />
                </motion.div>
              );
            })}
          </div>
          </div>
          
          {/* Premium carousel controls */}
          <PremiumCarouselControls
            currentIndex={currentIndex}
            totalCount={filteredVideos.length}
            onPrev={goPrev}
            onNext={goNext}
            onDotClick={handleDotClick}
            activeCategory={activeCategory}
          />
        </>
      )}
      
      {/* Empty state for category */}
      {!isLoading && filteredVideos.length === 0 && (
        <div className="fixed inset-0 flex items-center justify-center pt-24">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              {(() => {
                const Icon = CATEGORIES.find(c => c.id === activeCategory)?.icon || Film;
                return <Icon className="w-8 h-8 text-zinc-600" />;
              })()}
            </div>
            <p className="text-zinc-500 text-sm mb-2">No videos in this category yet</p>
            <button
              onClick={() => handleCategoryChange('all')}
              className="text-blue-400 text-sm hover:underline"
            >
              View all videos
            </button>
          </div>
        </div>
      )}
      
      {/* Fullscreen player */}
      <AnimatePresence>
        {selectedVideo && (
          <PremiumFullscreenPlayer 
            video={selectedVideo} 
            onClose={() => setSelectedVideo(null)} 
          />
        )}
      </AnimatePresence>
      </div>
      
      {/* Famous Avatars Section - Separate scrollable area */}
      {showAvatarSection && (
        <div 
          ref={avatarSectionRef}
          className="min-h-screen bg-black relative"
        >
          <FamousAvatarsShowcase />
        </div>
      )}
    </div>
  );
});

// Wrapper with error boundary
export default function Gallery() {
  return (
    <ErrorBoundary>
      <GalleryContent />
    </ErrorBoundary>
  );
}

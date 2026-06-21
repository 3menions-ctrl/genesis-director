/**
 * PremiumFullscreenPlayer - Gallery showcase player using UniversalHLSPlayer
 * 
 * Now uses cross-browser HLS playback via hls.js for consistent
 * experience on all platforms (Safari, Chrome, Firefox, Edge).
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SkipForward, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimpleVideoPlayer } from '@/components/player';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  all_clips?: string[];
  hlsPlaylistUrl?: string | null; // HLS URL for seamless playback
  category?: string;
}

interface PremiumFullscreenPlayerProps {
  video: GalleryVideo;
  onClose: () => void;
}

export const PremiumFullscreenPlayer = memo(function PremiumFullscreenPlayer({ 
  video, 
  onClose 
}: PremiumFullscreenPlayerProps) {
  const [showControls, setShowControls] = useState(true);
  
  // Prefer HLS playlist for seamless playback, fallback to individual clips
  const hasHLS = !!video.hlsPlaylistUrl;
  
  // For non-HLS fallback: individual clip handling
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  const clips = useMemo(() => 
    video.all_clips && video.all_clips.length > 0 
      ? video.all_clips 
      : video.video_url ? [video.video_url] : [],
    [video.all_clips, video.video_url]
  );
  
  const totalClips = clips.length;
  const currentClipUrl = clips[currentClipIndex] || null;
  
  // Determine source: HLS for seamless, or fallback to current clip
  const playbackUrl = hasHLS ? video.hlsPlaylistUrl : currentClipUrl;
  const isHLS = playbackUrl?.includes('.m3u8');
  
  const handleNext = useCallback(() => {
    if (!hasHLS && totalClips > 1) {
      setCurrentClipIndex((prev) => (prev + 1) % totalClips);
    }
  }, [hasHLS, totalClips]);
  
  const handlePrev = useCallback(() => {
    if (!hasHLS && totalClips > 1) {
      setCurrentClipIndex((prev) => (prev - 1 + totalClips) % totalClips);
    }
  }, [hasHLS, totalClips]);
  
  const skipToClip = useCallback((index: number) => {
    if (!hasHLS && index >= 0 && index < totalClips) {
      setCurrentClipIndex(index);
    }
  }, [hasHLS, totalClips]);
  
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
  }, []);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black"
      onClick={onClose}
      onMouseMove={handleMouseMove}
    >
      {/* Ambient background glow */}
      <div 
        className="absolute inset-0 blur-3xl opacity-20 scale-110 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 60%)',
        }}
      />
      
      <div 
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {playbackUrl ? (
          <div className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden">
            {isHLS ? (
              <SimpleVideoPlayer
                src={playbackUrl}
                autoPlay
                loop={hasHLS} // Loop if HLS (continuous stream)
                showControls
                controlsVisibility="hover"
                onEnded={hasHLS ? undefined : handleNext} // Only advance clips for non-HLS
                className="w-full h-full"
                objectFit="contain"
              />
            ) : (
              <SimpleVideoPlayer
                src={playbackUrl}
                autoPlay
                showControls
                controlsVisibility="hover"
                onEnded={handleNext}
                className="w-full h-full"
                objectFit="contain"
              />
            )}
            {hasHLS && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium">
                Seamless HLS
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-slate-500/30 flex items-center justify-center bg-slate-500/10">
              <X className="w-10 h-10 text-slate-400/60" />
            </div>
            <p className="text-zinc-500 text-sm">Video unavailable</p>
          </div>
        )}
      </div>
      
      {/* Clip navigation overlay - Only show for non-HLS multi-clip videos */}
      <AnimatePresence>
        {showControls && !hasHLS && totalClips > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            {/* Gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
            
            <div className="relative px-6 pb-8 pt-16">
              {/* Video title */}
              <div className="mb-4 text-center">
                <h2 className="text-white text-xl font-medium">{video.title}</h2>
                {video.category && (
                  <p className="text-white/50 text-sm mt-1">
                    {video.category === 'text-to-video' ? 'Text to Video' : 
                     video.category === 'image-to-video' ? 'Image to Video' : 'AI Avatar'}
                  </p>
                )}
              </div>
              
              {/* Clip indicators */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {clips.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      skipToClip(idx);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === currentClipIndex 
                        ? "bg-blue-400 w-8 shadow-lg shadow-blue-500/30" 
                        : "bg-white/20 hover:bg-white/40 w-3"
                    )}
                  />
                ))}
              </div>
              
              {/* Navigation buttons */}
              <div className="flex items-center justify-center gap-4">
                <button 
                  className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                
                <span className="text-white/60 text-sm min-w-[60px] text-center">
                  {currentClipIndex + 1} / {totalClips}
                </span>
                
                <button 
                  className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Title overlay for HLS videos */}
      {hasHLS && showControls && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6">
          <div className="bg-gradient-to-t from-black/80 to-transparent absolute inset-0 pointer-events-none" />
          <div className="relative text-center">
            <h2 className="text-white text-xl font-medium">{video.title}</h2>
            {video.category && (
              <p className="text-white/50 text-sm mt-1">
                {video.category === 'text-to-video' ? 'Text to Video' : 
                 video.category === 'image-to-video' ? 'Image to Video' : 'AI Avatar'}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: showControls ? 1 : 0.3, scale: 1 }}
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/60 backdrop-blur-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/[0.08] z-30 transition-all"
      >
        <X className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
});

export default PremiumFullscreenPlayer;
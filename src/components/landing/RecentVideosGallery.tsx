import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, X, Film, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface VideoManifest {
  version: string;
  projectId: string;
  clips: Array<{
    index: number;
    videoUrl: string;
    duration: number;
  }>;
  totalDuration: number;
  musicUrl?: string;
}

interface RecentVideo {
  id: string;
  title: string;
  video_url: string;
  mode: string;
  created_at: string;
}

const MODE_COLORS: Record<string, string> = {
  'text-to-video': 'from-amber-500/30 to-orange-500/20 border-amber-500/40 text-amber-200',
  'image-to-video': 'from-cyan-500/30 to-blue-500/20 border-cyan-500/40 text-cyan-200',
  'motion-transfer': 'from-pink-500/30 to-rose-500/20 border-pink-500/40 text-pink-200',
  'style-transfer': 'from-purple-500/30 to-violet-500/20 border-purple-500/40 text-purple-200',
};

const MODE_LABELS: Record<string, string> = {
  'text-to-video': 'Text to Video',
  'image-to-video': 'Image to Video',
  'motion-transfer': 'Motion Transfer',
  'style-transfer': 'Style Transfer',
};

interface VideoCardProps {
  video: RecentVideo;
  index: number;
  onPlay: () => void;
}

function VideoCard({ video, index, onPlay }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    async function fetchThumbnail() {
      if (!video.video_url) return;
      
      try {
        const response = await fetch(video.video_url);
        const manifest: VideoManifest = await response.json();
        
        if (manifest.clips && manifest.clips.length > 0) {
          setThumbnailUrl(manifest.clips[0].videoUrl);
        }
      } catch (error) {
        console.error('Failed to fetch video manifest:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchThumbnail();
  }, [video.video_url]);

  // Format date
  const formattedDate = new Date(video.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group cursor-pointer"
      onMouseEnter={() => {
        setIsHovered(true);
        if (videoRef.current && thumbnailUrl) {
          videoRef.current.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      onClick={onPlay}
    >
      <motion.div 
        className="relative"
        whileHover={{ y: -8, transition: { duration: 0.3 } }}
      >
        {/* Ambient glow */}
        <motion.div
          className="absolute -inset-3 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 blur-2xl pointer-events-none"
          style={{ 
            background: video.mode === 'text-to-video' 
              ? 'linear-gradient(135deg, rgba(251,146,60,0.2) 0%, transparent 100%)'
              : video.mode === 'image-to-video'
              ? 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, transparent 100%)'
          }}
        />
        
        {/* Card */}
        <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-2xl overflow-hidden transition-all duration-500 group-hover:border-white/[0.2] group-hover:shadow-2xl">
          {/* Thumbnail / Video */}
          <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              </div>
            ) : thumbnailUrl ? (
              <video
                ref={videoRef}
                src={thumbnailUrl}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="w-12 h-12 text-white/20" />
              </div>
            )}
            
            {/* Gradient overlay */}
            <div className={cn(
              "absolute inset-0 transition-all duration-500",
              isHovered 
                ? "bg-gradient-to-t from-black/95 via-black/40 to-transparent" 
                : "bg-gradient-to-t from-black/80 via-black/20 to-transparent"
            )} />
            
            {/* Play button */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0 }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ 
                  scale: isHovered ? 1 : 0.6, 
                  opacity: isHovered ? 1 : 0 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-2xl flex items-center justify-center border border-white/30 shadow-2xl"
              >
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              </motion.div>
            </motion.div>
            
            {/* Mode badge */}
            <Badge 
              className={cn(
                "absolute top-3 left-3 text-[11px] font-semibold backdrop-blur-2xl border bg-gradient-to-r px-3 py-1.5 rounded-full shadow-lg",
                MODE_COLORS[video.mode] || MODE_COLORS['text-to-video']
              )}
            >
              {MODE_LABELS[video.mode] || video.mode}
            </Badge>
            
            {/* Date */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xl text-[11px] text-white font-medium border border-white/10">
              {formattedDate}
            </div>
          </div>
          
          {/* Info */}
          <div className="p-5">
            <h3 className="font-bold text-white text-lg truncate group-hover:text-white/95 transition-colors">
              {video.title}
            </h3>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface VideoModalProps {
  video: RecentVideo | null;
  onClose: () => void;
}

function VideoModal({ video, onClose }: VideoModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    async function fetchVideoUrl() {
      if (!video?.video_url) return;
      
      try {
        const response = await fetch(video.video_url);
        const manifest: VideoManifest = await response.json();
        
        if (manifest.clips && manifest.clips.length > 0) {
          setVideoUrl(manifest.clips[0].videoUrl);
        }
      } catch (error) {
        console.error('Failed to fetch video manifest:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchVideoUrl();
  }, [video?.video_url]);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);
  
  if (!video) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-4xl bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video area */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-white/30 animate-spin" />
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              autoPlay
              loop
              playsInline
              onClick={() => setIsPlaying(!isPlaying)}
            />
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Film className="w-10 h-10 text-white/40" />
              </div>
              <p className="text-white/50 font-medium">Video unavailable</p>
            </div>
          )}
          
          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
            <div className="flex items-center gap-3">
              <button 
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/10 transition-all"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button 
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/10 transition-all"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              <div className="flex-1" />
              
              <Badge className={cn(
                "backdrop-blur-xl border bg-gradient-to-r px-3 py-1 rounded-full text-xs",
                MODE_COLORS[video.mode] || MODE_COLORS['text-to-video']
              )}>
                {MODE_LABELS[video.mode] || video.mode}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Info section */}
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2">{video.title}</h2>
          <p className="text-white/50">Created with Apex Studio AI</p>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function RecentVideosGallery() {
  const [videos, setVideos] = useState<RecentVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<RecentVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchRecentVideos() {
      try {
        const { data, error } = await supabase
          .from('movie_projects')
          .select('id, title, video_url, mode, created_at')
          .eq('is_public', true)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(4);
        
        if (error) throw error;
        setVideos(data || []);
      } catch (error) {
        console.error('Failed to fetch recent videos:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchRecentVideos();
  }, []);

  if (isLoading) {
    return (
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video rounded-2xl bg-white/5" />
                <div className="mt-4 h-6 w-3/4 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (videos.length === 0) {
    return null;
  }
  
  return (
    <section className="relative z-10 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Recent Creations
          </h2>
          <p className="text-lg text-white/40 max-w-md mx-auto">
            See what creators are making with AI video.
          </p>
        </motion.div>
        
        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              index={index}
              onPlay={() => setSelectedVideo(video)}
            />
          ))}
        </div>
      </div>
      
      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, X, Sparkles, ArrowRight, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Sample videos to showcase (these would typically come from your database)
const SHOWCASE_VIDEOS = [
  {
    id: '1',
    title: 'Sunset Dreams',
    description: 'A cinematic journey through golden hour landscapes',
    thumbnail: '/placeholder.svg',
    videoUrl: null, // Would be actual video URL
    category: 'Cinematic',
    duration: '0:32',
  },
  {
    id: '2',
    title: 'Urban Pulse',
    description: 'Dynamic city life captured in motion',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Motion',
    duration: '0:45',
  },
  {
    id: '3',
    title: 'Nature\'s Symphony',
    description: 'Breathtaking wildlife in their natural habitat',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Nature',
    duration: '1:12',
  },
  {
    id: '4',
    title: 'Digital Horizons',
    description: 'Futuristic visions brought to life',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Sci-Fi',
    duration: '0:58',
  },
  {
    id: '5',
    title: 'Abstract Flow',
    description: 'Mesmerizing patterns and colors in motion',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Abstract',
    duration: '0:38',
  },
  {
    id: '6',
    title: 'Character Story',
    description: 'AI-generated characters with consistent identity',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Avatar',
    duration: '1:05',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Cinematic': 'from-amber-500/30 to-orange-500/20 border-amber-500/40 text-amber-200',
  'Motion': 'from-pink-500/30 to-rose-500/20 border-pink-500/40 text-pink-200',
  'Nature': 'from-emerald-500/30 to-green-500/20 border-emerald-500/40 text-emerald-200',
  'Sci-Fi': 'from-cyan-500/30 to-blue-500/20 border-cyan-500/40 text-cyan-200',
  'Abstract': 'from-purple-500/30 to-violet-500/20 border-purple-500/40 text-purple-200',
  'Avatar': 'from-blue-500/30 to-indigo-500/20 border-blue-500/40 text-blue-200',
};

interface VideoCardProps {
  video: typeof SHOWCASE_VIDEOS[0];
  index: number;
  onPlay: () => void;
}

function VideoCard({ video, index, onPlay }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            background: `linear-gradient(135deg, ${video.category === 'Cinematic' ? 'rgba(251,146,60,0.2)' : 
                         video.category === 'Motion' ? 'rgba(236,72,153,0.2)' : 
                         video.category === 'Nature' ? 'rgba(16,185,129,0.2)' : 
                         video.category === 'Sci-Fi' ? 'rgba(6,182,212,0.2)' : 
                         video.category === 'Abstract' ? 'rgba(139,92,246,0.2)' : 
                         'rgba(59,130,246,0.2)'} 0%, transparent 100%)` 
          }}
        />
        
        {/* Card */}
        <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-2xl overflow-hidden transition-all duration-500 group-hover:border-white/[0.2] group-hover:shadow-2xl">
          {/* Thumbnail */}
          <div className="relative aspect-video overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
              <Film className="w-12 h-12 text-white/20" />
            </div>
            
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
            
            {/* Category badge */}
            <Badge 
              className={cn(
                "absolute top-3 left-3 text-[11px] font-semibold backdrop-blur-2xl border bg-gradient-to-r px-3 py-1.5 rounded-full shadow-lg",
                CATEGORY_COLORS[video.category] || CATEGORY_COLORS['Cinematic']
              )}
            >
              {video.category}
            </Badge>
            
            {/* Duration */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xl text-[11px] text-white font-medium border border-white/10">
              {video.duration}
            </div>
          </div>
          
          {/* Info */}
          <div className="p-5 space-y-2">
            <h3 className="font-bold text-white text-lg truncate group-hover:text-white/95 transition-colors">
              {video.title}
            </h3>
            <p className="text-sm text-white/40 line-clamp-2 leading-relaxed">
              {video.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface VideoModalProps {
  video: typeof SHOWCASE_VIDEOS[0] | null;
  onClose: () => void;
}

function VideoModal({ video, onClose }: VideoModalProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  
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
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Film className="w-10 h-10 text-white/40" />
            </div>
            <p className="text-white/50 font-medium">Video Preview</p>
            <p className="text-white/30 text-sm mt-1">{video.title}</p>
          </div>
          
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
                CATEGORY_COLORS[video.category] || CATEGORY_COLORS['Cinematic']
              )}>
                {video.category}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Info section */}
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2">{video.title}</h2>
          <p className="text-white/50">{video.description}</p>
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

interface VideoGallerySectionProps {
  onNavigateToGallery?: () => void;
}

export default function VideoGallerySection({ onNavigateToGallery }: VideoGallerySectionProps) {
  const [selectedVideo, setSelectedVideo] = useState<typeof SHOWCASE_VIDEOS[0] | null>(null);
  
  return (
    <section id="gallery" className="relative z-10 py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="inline-block mb-6"
          >
            <Badge className="px-5 py-2 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 text-white/80 backdrop-blur-xl rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Generated Showcase
            </Badge>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
            See What's{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/60">
              Possible
            </span>
          </h2>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed">
            Explore stunning videos created by our AI. From cinematic masterpieces to abstract art — all generated in minutes.
          </p>
        </motion.div>
        
        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {SHOWCASE_VIDEOS.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              index={index}
              onPlay={() => setSelectedVideo(video)}
            />
          ))}
        </div>
        
        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Button
            onClick={onNavigateToGallery}
            size="lg"
            className="group h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.25)]"
          >
            Explore Full Gallery
            <ArrowRight className="w-5 h-5 ml-3 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
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

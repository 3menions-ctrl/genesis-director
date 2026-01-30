import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Clock, TrendingUp, Sparkles, Film, Palette, User, Image, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VideoGenerationMode } from '@/types/video-modes';

// Mode helpers
const getModeIcon = (mode?: VideoGenerationMode) => {
  switch (mode) {
    case 'video-to-video': return Palette;
    case 'avatar': return User;
    case 'image-to-video': return Image;
    case 'motion-transfer': return Sparkles;
    case 'b-roll': return Film;
    default: return Wand2;
  }
};

const getModeLabel = (mode?: VideoGenerationMode) => {
  switch (mode) {
    case 'video-to-video': return 'Style Transfer';
    case 'avatar': return 'AI Avatar';
    case 'image-to-video': return 'Animated';
    case 'motion-transfer': return 'Motion';
    case 'b-roll': return 'B-Roll';
    default: return 'Cinematic';
  }
};

interface DiscoverHeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'recent' | 'popular';
  setSortBy: (sort: 'recent' | 'popular') => void;
  modeFilter: VideoGenerationMode | 'all';
  setModeFilter: (mode: VideoGenerationMode | 'all') => void;
  modeCounts: Record<string, number>;
}

export const DiscoverHero = memo(forwardRef<HTMLDivElement, DiscoverHeroProps>(function DiscoverHero({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  modeFilter,
  setModeFilter,
  modeCounts,
}, ref) {
  return (
    <div className="relative overflow-hidden pt-28 pb-12">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Floating Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="relative inline-block mb-8"
          >
            <Badge className="relative px-5 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 backdrop-blur-xl rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4 mr-2" />
              Community Gallery
            </Badge>
          </motion.div>

          {/* Main Title */}
          <motion.h1 
            className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            Discover{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300">
              Creations
            </span>
          </motion.h1>

          <motion.p 
            className="text-lg md:text-xl text-white/40 mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Explore stunning AI-generated videos from creators worldwide
          </motion.p>

          {/* Search Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="relative max-w-2xl mx-auto mb-8"
          >
            <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-1.5">
              <div className="relative flex items-center">
                <Search className="absolute left-5 w-5 h-5 text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, genre, or description..."
                  className="w-full h-14 pl-14 pr-6 bg-transparent border-0 text-white placeholder:text-white/25 focus:ring-0 focus-visible:ring-0 text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Filter Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {/* Sort Options */}
            <div className="flex items-center gap-1 p-1.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortBy('recent')}
                className={cn(
                  "h-9 px-5 rounded-full text-sm font-medium transition-all duration-300",
                  sortBy === 'recent' 
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" 
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <Clock className="w-4 h-4 mr-2" />
                Recent
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortBy('popular')}
                className={cn(
                  "h-9 px-5 rounded-full text-sm font-medium transition-all duration-300",
                  sortBy === 'popular' 
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" 
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Popular
              </Button>
            </div>
            
            <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />
            
            {/* Mode Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModeFilter('all')}
                className={cn(
                  "h-9 px-4 rounded-full text-sm transition-all duration-300",
                  modeFilter === 'all' 
                    ? "bg-white/10 text-white border border-white/20" 
                    : "text-white/35 hover:text-white/60 hover:bg-white/5"
                )}
              >
                All Videos
              </Button>
              {Object.entries(modeCounts).map(([mode, count]) => {
                const ModeFilterIcon = getModeIcon(mode as VideoGenerationMode);
                return (
                  <Button
                    key={mode}
                    variant="ghost"
                    size="sm"
                    onClick={() => setModeFilter(mode as VideoGenerationMode)}
                    className={cn(
                      "h-9 px-4 rounded-full text-sm transition-all duration-300 gap-2",
                      modeFilter === mode 
                        ? "bg-white/10 text-white border border-white/20" 
                        : "text-white/35 hover:text-white/60 hover:bg-white/5"
                    )}
                  >
                    <ModeFilterIcon className="w-3.5 h-3.5" />
                    {getModeLabel(mode as VideoGenerationMode)}
                    <span className="text-white/25 text-xs">({count})</span>
                  </Button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

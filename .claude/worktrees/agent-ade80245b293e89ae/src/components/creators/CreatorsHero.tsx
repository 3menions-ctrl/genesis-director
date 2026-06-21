import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Video, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatorsHeroProps {
  stats?: {
    totalCreators?: number;
    totalVideos: number;
  };
  title?: string;
  subtitle?: string;
}

export const CreatorsHero = memo(forwardRef<HTMLDivElement, CreatorsHeroProps>(function CreatorsHero({ 
  stats, 
  title = "Discover Creators", 
  subtitle 
}, ref) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="relative pt-4 pb-2"
    >
      {/* Main hero content */}
      <div className="relative text-center max-w-3xl mx-auto">
        {/* Overline badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] mb-6"
        >
          <Film className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Creator Showcase
          </span>
        </motion.div>

        {/* Title — bold and commanding */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4"
        >
          <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            {title}
          </span>
        </motion.h1>

        {/* Subtle accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent mb-5"
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-white/40 text-sm sm:text-base max-w-lg mx-auto leading-relaxed"
        >
          {subtitle || "Explore outstanding work from the community's most talented filmmakers"}
        </motion.p>

        {/* Stats row */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex items-center justify-center gap-8 mt-8"
          >
            {stats.totalCreators != null && (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-white tabular-nums">{stats.totalCreators}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Creators</div>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/[0.06]" />
              </>
            )}

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Video className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-lg font-bold text-white tabular-nums">{stats.totalVideos}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest">Videos</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}));

export default CreatorsHero;

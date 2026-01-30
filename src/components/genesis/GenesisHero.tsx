import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Globe, Sparkles, Users, Film, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGenesisStats } from '@/hooks/useGenesisUniverse';

interface GenesisHeroProps {
  onExplore: () => void;
  onContribute: () => void;
}

export const GenesisHero = memo(forwardRef<HTMLDivElement, GenesisHeroProps>(function GenesisHero({ onExplore, onContribute }, ref) {
  const { data: stats } = useGenesisStats();

  return (
    <div className="relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/10 to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full"
            initial={{ 
              x: Math.random() * 100 + '%', 
              y: Math.random() * 100 + '%',
              opacity: 0 
            }}
            animate={{ 
              y: [null, '-20%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative container mx-auto px-4 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Logo/Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 mb-6"
          >
            <Globe className="h-10 w-10 text-primary" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold mb-4"
          >
            The{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
              Genesis Universe
            </span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-muted-foreground mb-8"
          >
            One shared world. Infinite stories. Your videos shape the canon.
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap justify-center gap-8 mb-10"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{stats?.totalCities || 0}</span>
              <span>Cities</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{stats?.totalLandmarks || 0}</span>
              <span>Landmarks</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Film className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{stats?.totalVideos || 0}</span>
              <span>Stories</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold text-foreground">{stats?.canonVideos || 0}</span>
              <span>Canon</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <Button size="lg" onClick={onExplore} className="gap-2">
              <Globe className="h-5 w-5" />
              Explore the Universe
            </Button>
            <Button size="lg" variant="outline" onClick={onContribute} className="gap-2">
              <Film className="h-5 w-5" />
              Contribute a Story
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}));

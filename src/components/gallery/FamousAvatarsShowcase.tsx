import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Star, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Famous avatar data - mix of historical, animated, and realistic characters
const FAMOUS_AVATARS = [
  {
    id: 'cleopatra',
    name: 'Cleopatra',
    category: 'Historical',
    description: 'Queen of Egypt',
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-orange-500/20',
    accentColor: 'amber',
  },
  {
    id: 'einstein',
    name: 'Einstein',
    category: 'Historical',
    description: 'Genius Physicist',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-blue-500/20 via-cyan-500/10 to-teal-500/20',
    accentColor: 'blue',
  },
  {
    id: 'cat-wizard',
    name: 'Whiskers',
    category: 'Animated',
    description: 'Mystical Feline',
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-purple-500/20 via-violet-500/10 to-fuchsia-500/20',
    accentColor: 'purple',
  },
  {
    id: 'samurai',
    name: 'Kenji',
    category: 'Historical',
    description: 'Ancient Warrior',
    imageUrl: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-red-500/20 via-rose-500/10 to-pink-500/20',
    accentColor: 'red',
  },
  {
    id: 'space-explorer',
    name: 'Nova',
    category: 'Sci-Fi',
    description: 'Space Pioneer',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-indigo-500/20 via-blue-500/10 to-cyan-500/20',
    accentColor: 'indigo',
  },
  {
    id: 'dragon-rider',
    name: 'Draco',
    category: 'Fantasy',
    description: 'Dragon Master',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/20',
    accentColor: 'emerald',
  },
  {
    id: 'cyber-punk',
    name: 'Neon',
    category: 'Sci-Fi',
    description: 'Digital Rebel',
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-pink-500/20 via-fuchsia-500/10 to-purple-500/20',
    accentColor: 'pink',
  },
  {
    id: 'royal-owl',
    name: 'Athena',
    category: 'Animated',
    description: 'Wise Guardian',
    imageUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-slate-500/20 via-gray-500/10 to-zinc-500/20',
    accentColor: 'slate',
  },
  {
    id: 'viking',
    name: 'Ragnar',
    category: 'Historical',
    description: 'Norse Legend',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20',
    accentColor: 'orange',
  },
  {
    id: 'mermaid',
    name: 'Marina',
    category: 'Fantasy',
    description: 'Ocean Spirit',
    imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop&crop=face',
    gradient: 'from-cyan-500/20 via-teal-500/10 to-blue-500/20',
    accentColor: 'cyan',
  },
];

const AvatarCard = ({ avatar, index }: { avatar: typeof FAMOUS_AVATARS[0]; index: number }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: index * 0.08, 
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1]
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative cursor-pointer"
    >
      {/* Card container */}
      <div className={cn(
        "relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-500",
        "bg-gradient-to-br",
        avatar.gradient,
        isHovered ? "scale-[1.03] shadow-2xl shadow-white/5" : "shadow-xl shadow-black/20"
      )}>
        {/* Glass border effect */}
        <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none z-20" />
        
        {/* Shimmer loading state */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse" />
        )}
        
        {/* Avatar image */}
        <img 
          src={avatar.imageUrl}
          alt={avatar.name}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-full object-cover transition-all duration-700",
            isHovered ? "scale-110 brightness-110" : "scale-100 brightness-90",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500",
          isHovered && "opacity-100"
        )} style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
        }} />
        
        {/* Category badge */}
        <div className={cn(
          "absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider",
          "bg-black/60 backdrop-blur-xl border border-white/20 text-white/80"
        )}>
          {avatar.category}
        </div>
        
        {/* Premium star */}
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: index * 0.08 + 0.3, type: 'spring' }}
          className="absolute top-3 right-3"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Star className="w-3.5 h-3.5 text-white fill-white" />
          </div>
        </motion.div>
        
        {/* Info panel */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <motion.div
            initial={false}
            animate={{ y: isHovered ? 0 : 8, opacity: isHovered ? 1 : 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-white font-bold text-lg mb-0.5 tracking-tight">
              {avatar.name}
            </h3>
            <p className="text-white/60 text-sm">
              {avatar.description}
            </p>
          </motion.div>
          
          {/* Hover action hint */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center gap-2 text-xs text-white/50"
          >
            <Sparkles className="w-3 h-3" />
            <span>Click to create with this avatar</span>
          </motion.div>
        </div>
        
        {/* Shine effect */}
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ 
            x: isHovered ? '200%' : '-100%',
            opacity: isHovered ? 0.3 : 0
          }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
        />
      </div>
    </motion.div>
  );
};

interface FamousAvatarsShowcaseProps {
  className?: string;
}

export const FamousAvatarsShowcase = ({ className }: FamousAvatarsShowcaseProps) => {
  const navigate = useNavigate();
  
  return (
    <motion.section 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={cn("relative py-16 px-6 md:px-12", className)}
    >
      {/* Section background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-6"
        >
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-white/70 font-medium">Premium Avatar Collection</span>
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight"
        >
          Iconic Characters,{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Infinite Stories
          </span>
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-white/50 text-lg max-w-2xl mx-auto"
        >
          Create stunning videos with legendary personas. From ancient royalty to futuristic explorers.
        </motion.p>
      </div>
      
      {/* Avatar grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {FAMOUS_AVATARS.map((avatar, index) => (
            <AvatarCard key={avatar.id} avatar={avatar} index={index} />
          ))}
        </div>
      </div>
      
      {/* See More CTA */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="flex justify-center mt-12"
      >
        <Button
          onClick={() => navigate('/auth')}
          size="lg"
          className={cn(
            "group relative px-8 py-6 h-auto rounded-full text-lg font-semibold",
            "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600",
            "hover:from-violet-500 hover:via-fuchsia-500 hover:to-pink-500",
            "shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40",
            "border border-white/10 transition-all duration-300",
            "hover:scale-105"
          )}
        >
          <span className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            See More Avatars
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </span>
          
          {/* Button glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity -z-10" />
        </Button>
      </motion.div>
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />
    </motion.section>
  );
};

export default FamousAvatarsShowcase;

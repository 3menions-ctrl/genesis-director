import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Star, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Fetch real avatars from database
const useShowcaseAvatars = () => {
  return useQuery({
    queryKey: ['showcase-avatars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_templates')
        .select('id, name, face_image_url, thumbnail_url, description, gender, style, personality, tags')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Map style to gradient and accent
const getStyleGradient = (style: string | null, index: number): { gradient: string; accentColor: string } => {
  const styleMap: Record<string, { gradient: string; accentColor: string }> = {
    luxury: { gradient: 'from-amber-500/20 via-yellow-500/10 to-orange-500/20', accentColor: 'amber' },
    corporate: { gradient: 'from-slate-500/20 via-zinc-500/10 to-gray-500/20', accentColor: 'slate' },
    influencer: { gradient: 'from-pink-500/20 via-fuchsia-500/10 to-purple-500/20', accentColor: 'pink' },
    creative: { gradient: 'from-violet-500/20 via-purple-500/10 to-indigo-500/20', accentColor: 'violet' },
    educational: { gradient: 'from-blue-500/20 via-cyan-500/10 to-teal-500/20', accentColor: 'blue' },
    casual: { gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/20', accentColor: 'emerald' },
  };
  
  if (style && styleMap[style]) return styleMap[style];
  
  // Fallback gradients based on index
  const fallbacks = [
    { gradient: 'from-amber-500/20 via-yellow-500/10 to-orange-500/20', accentColor: 'amber' },
    { gradient: 'from-blue-500/20 via-cyan-500/10 to-teal-500/20', accentColor: 'blue' },
    { gradient: 'from-purple-500/20 via-violet-500/10 to-fuchsia-500/20', accentColor: 'purple' },
    { gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/20', accentColor: 'emerald' },
    { gradient: 'from-pink-500/20 via-fuchsia-500/10 to-rose-500/20', accentColor: 'pink' },
  ];
  return fallbacks[index % fallbacks.length];
};

// Get category from tags
const getCategoryFromTags = (tags: string[] | null): string => {
  if (!tags || tags.length === 0) return 'Avatar';
  
  // Check for specific keywords
  const tagStr = tags.join(' ').toLowerCase();
  if (tagStr.includes('queen') || tagStr.includes('emperor') || tagStr.includes('empress') || tagStr.includes('warrior') || tagStr.includes('samurai')) {
    return 'Historical';
  }
  if (tagStr.includes('influencer') || tagStr.includes('k-fashion')) {
    return 'Influencer';
  }
  if (tagStr.includes('creative') || tagStr.includes('artistic')) {
    return 'Creative';
  }
  if (tagStr.includes('educational')) {
    return 'Educational';
  }
  if (tagStr.includes('casual')) {
    return 'Lifestyle';
  }
  if (tagStr.includes('corporate')) {
    return 'Business';
  }
  
  // Capitalize first tag
  return tags[0].charAt(0).toUpperCase() + tags[0].slice(1);
};

interface AvatarCardProps {
  avatar: {
    id: string;
    name: string;
    face_image_url: string;
    thumbnail_url: string | null;
    description: string | null;
    personality: string | null;
    style: string | null;
    tags: string[] | null;
  };
  index: number;
}

const AvatarCard = ({ avatar, index }: AvatarCardProps) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  
  const { gradient } = getStyleGradient(avatar.style, index);
  const category = getCategoryFromTags(avatar.tags);
  const imageUrl = avatar.thumbnail_url || avatar.face_image_url;
  
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
        gradient,
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
          src={imageUrl}
          alt={avatar.name}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-full object-cover object-top transition-all duration-700",
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
          {category}
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
            <p className="text-white/60 text-sm line-clamp-1">
              {avatar.personality || avatar.description || 'AI Avatar'}
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
  const { data: avatars = [], isLoading } = useShowcaseAvatars();
  
  if (isLoading) {
    return (
      <div className={cn("relative py-16 px-6 md:px-12 flex items-center justify-center", className)}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (avatars.length === 0) {
    return null;
  }
  
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
          Create stunning videos with legendary personas. From ancient royalty to modern influencers.
        </motion.p>
      </div>
      
      {/* Avatar grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {avatars.map((avatar, index) => (
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
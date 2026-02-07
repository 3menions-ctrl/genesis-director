import React, { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useChunkedAvatars } from '@/hooks/useChunkedAvatars';
import { shuffleAvatarIds } from '@/lib/utils/shuffleAvatars';

// Performance: Conservative chunked loading to prevent crashes
const INITIAL_CHUNK_SIZE = 8; // Load first 8 immediately (reduced from 10)
const CHUNK_SIZE = 4; // Load 4 more at a time (reduced from 6)
const CHUNK_DELAY_MS = 300; // Longer delay between chunks (increased from 200)

// Curated showcase: 20 animated characters + 35 realistic humans (22 women, 13 men)
// REDUCED from 65 to 55 avatars to prevent memory pressure and crashes
const SHOWCASE_AVATAR_IDS = [
  // ========== 20 ANIMATED CHARACTERS ==========
  // Cute animals
  '6b6a08e2-0820-4d38-9543-1b38e1f4c171', // Goldie - golden retriever
  '1d2f62ad-bbc2-4104-8442-fb77eb1f612b', // Hoppy - bunny
  '434231a4-2b33-42f5-ab5c-1dba4a7adf46', // Foxy - fox
  'c5a5248c-3017-439f-bc94-62d825e57df7', // Mittens - cat
  '5ba76e9a-1611-4a5b-9102-878832176e8c', // Luna Wolf
  'd98f1871-3863-4dee-b39f-4a72a5c21676', // Bandit - raccoon
  'b8c7d1e6-76dd-4898-9051-0ea0e842f14a', // Bruno Bear
  '87c84f49-aa81-4e5e-8647-6ef6d9758982', // Flash - cheetah
  'b490d6bb-1747-48d8-87bb-cc649dcba84e', // Gallop - horse
  '75563fd4-b9c7-49aa-abef-9e134d5e8947', // Leo Toon - lion
  // Human animated characters
  '4b0f0fcc-203a-4152-8d3c-ef12fd773583', // Captain Nova - superhero
  '75ba8ba0-0a6d-4290-961c-c363f3f4bfa4', // Commander Orion - astronaut
  '0448f47b-a956-4a27-a838-55f7d1be5880', // Dr. Quantum - scientist
  '831a2fd7-9673-4dd5-9356-e317dde236c6', // Detective Morgan
  '3b4b131c-4110-49ad-840a-23f38345aa0e', // Ninja Sakura
  'a1360f5d-330b-4bf2-b503-eed6bf7f0e02', // Chef Gustavo
  '21787b56-75f0-452a-992a-15d1b6fe18c9', // Emma Thompson - assistant
  '437e0a31-919c-4e2f-b37e-481b252ae3b5', // Amara Johnson - creative
  '4c288d1e-a400-48fe-85fb-819b0738749c', // Olivia Brown - fitness
  '9bc97466-5bc1-4c6a-a6e2-3c7d9f8d5ea0', // Nina Volkov - fashion
  
  // ========== 35 REALISTIC HUMANS ==========
  // Women (22) - removed 5: Princess Aurora, Sofia Reyes, Mei Lin, Charlotte Hayes, Mia Reyes
  'd2709e97-7118-4142-8c1d-3c4aac544ab4', // Amara Okafor - Nigerian creative
  '114aa466-a38b-484b-a40e-9eb92d62a15b', // Maya Johnson - African-American creative
  'ed82d806-b3a0-409c-8f59-f81dd2d70826', // Destiny Williams - African American casual
  '748d6da8-28d8-4695-a67b-71373efd1c7b', // Luna Ramirez - Hispanic creative
  '119f769f-6f17-476b-86e9-0b3a80b9b2a5', // Elena Rodriguez - Hispanic corporate
  '0e6cd698-d396-4516-a551-036b3b99fb85', // Sarah Mitchell - Caucasian corporate
  '5b8487a2-31cf-429c-a043-edddcbaecd99', // Priya Nair - South Indian creative
  '8465eccd-7c41-43b7-b338-6bfded49d49d', // Min-Ji Park - Korean influencer
  'ecdab958-8b00-4871-925b-ed517215b7d4', // Ingrid Svensson - Swedish corporate
  'de0f71de-03d2-4f82-bd40-7b8a32dd69de', // Sophia Williams - Mixed wellness
  '20634956-67cc-4f17-a86d-87e300bae47b', // Isabella Martinez - Hispanic professional
  '0f84239c-dac3-4031-9850-220223c2f1d7', // Valentina Garcia - Spanish creative
  '9a0dfa86-f76b-4d28-8dde-473c96ca148e', // Emma Blackwood - British casual
  'b138bf24-3a44-48f0-a099-a2ad65673069', // Olivia Sterling - American executive
  '5cdcfcc6-73ff-4ce6-9d90-e184ad9ddef5', // Ava Monroe - American influencer
  '637444ef-7642-4066-b798-07793d0db303', // Camila Vega - Brazilian influencer
  '64e111c5-48c3-4b0e-badf-e232f171940f', // Hannah Weber - German executive
  '7c2639af-f1a4-4d85-bd7c-b09966778f69', // Grace Holloway - American casual
  // Beautiful Black Women
  'c7a2e3f1-8b4d-4c9e-a5f6-1d2e3f4a5b6c', // Zara Monroe - elegant casual
  'd8b3f402-9c5e-4d0f-b607-2e3f405a6b7c', // Nia Carter - glamorous influencer
  'e9c40503-0d6f-4e10-c708-3f4a5b6c7d8e', // Aaliyah Bennett - stylish creative
  // Men (13) - removed 5: João Silva, James Park, Jasper Stone, Ryan Cooper, Brandon Nguyen
  '00c5e01b-c33d-489c-acb5-084e331c27ad', // Tyler Brooks - African American casual
  '811080ff-0b63-4206-9c70-bd68e3db6783', // Kwame Mensah - Ghanaian casual
  'f58e92ea-ccb8-4814-90db-aa0185ec1fc3', // Kai Nakamura - Japanese influencer
  '80aa6e91-570f-463f-b3dc-d9d634d57ccf', // Alex Turner - Caucasian influencer
  '60ef02ce-8230-4cef-92b0-86d52024e9d3', // James Mitchell - corporate professional
  'a1fd1624-f2b8-4582-a386-54adb205a98e', // Marcus Stone - athletic casual
  '1a89cbdf-c077-4cfc-96ca-5dfe8b4aac96', // Derek Williams - athletic corporate
  '6d00c998-1c7c-4f18-921a-839b167cb28c', // Darius Jackson - athletic casual
  '197c274d-e966-4f74-a8ac-8bb12b2d659c', // Malcolm Davis - athletic casual
  'b2461b71-af6f-45cf-b6cc-98a7adab8356', // Kevin Chen - Chinese corporate
  '4a1d6892-5755-4433-a96d-315e13a3344d', // Hiroshi Tanaka - Japanese creative
  '5fd77fd4-1f0c-43a7-8cb4-180ba13d80a8', // Arjun Patel - Indian corporate
  '8701b822-e9f2-47f9-b788-35577595d21b', // Vikram Singh - Indian casual
];

// Type for showcase avatar data
interface ShowcaseAvatar {
  id: string;
  name: string;
  face_image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  personality: string | null;
  style: string | null;
  tags: string[] | null;
  avatar_type: string | null;
  gender?: string | null;
}

// Fetch curated avatars from database with error handling
// CRITICAL: Shuffle is done inside useMemo in the component, not at module level
const useShowcaseAvatars = () => {
  return useQuery({
    queryKey: ['showcase-avatars-curated'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('avatar_templates')
          .select('id, name, face_image_url, thumbnail_url, description, gender, style, personality, tags, avatar_type')
          .in('id', SHOWCASE_AVATAR_IDS)
          .eq('is_active', true);
        
        if (error) {
          console.error('[FamousAvatarsShowcase] Query error:', error.message);
          return []; // Return empty instead of throwing to prevent crash
        }
        
        // Return data in curated order (shuffle happens in component with useMemo)
        const sortedData = SHOWCASE_AVATAR_IDS
          .map(id => data?.find(a => a.id === id))
          .filter((a): a is NonNullable<typeof a> => a !== undefined);
        
        return sortedData as ShowcaseAvatar[];
      } catch (err) {
        console.error('[FamousAvatarsShowcase] Unexpected error:', err);
        return []; // Graceful degradation
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (increased for stability)
    retry: 1, // Limit retries to prevent infinite loops
    refetchOnWindowFocus: false, // Prevent refetch causing re-renders
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

// Get category from tags and avatar_type
const getCategoryFromTags = (tags: string[] | null, avatarType: string | null): string => {
  if (!tags || tags.length === 0) return avatarType === 'animated' ? 'Animated' : 'Avatar';
  
  // Check for specific keywords
  const tagStr = tags.join(' ').toLowerCase();
  
  // Animal characters
  if (tagStr.includes('dog') || tagStr.includes('cat') || tagStr.includes('bunny') || 
      tagStr.includes('tiger') || tagStr.includes('cheetah') || tagStr.includes('eagle') ||
      tagStr.includes('fox') || tagStr.includes('bear') || tagStr.includes('owl') ||
      tagStr.includes('horse') || tagStr.includes('dolphin') || tagStr.includes('gorilla')) {
    return 'Animal';
  }
  
  // Superheroes and fantasy
  if (tagStr.includes('superhero') || tagStr.includes('hero') || tagStr.includes('powerful')) {
    return 'Superhero';
  }
  
  // Sci-fi and space
  if (tagStr.includes('astronaut') || tagStr.includes('space') || tagStr.includes('futuristic') || tagStr.includes('scientist')) {
    return 'Sci-Fi';
  }
  
  // Historical figures
  if (tagStr.includes('queen') || tagStr.includes('emperor') || tagStr.includes('empress') || 
      tagStr.includes('warrior') || tagStr.includes('samurai') || tagStr.includes('ancient') ||
      tagStr.includes('egyptian') || tagStr.includes('roman')) {
    return 'Historical';
  }
  
  // Detective/Mystery
  if (tagStr.includes('detective') || tagStr.includes('mystery')) {
    return 'Mystery';
  }
  
  // Default based on avatar type
  if (avatarType === 'animated') return 'Animated';
  
  return 'Avatar';
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
    avatar_type: string | null;
  };
  index: number;
}

// Memoized avatar card to prevent unnecessary re-renders
const AvatarCard = memo(function AvatarCard({ avatar, index }: AvatarCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Memoize computed values
  const { gradient } = useMemo(() => getStyleGradient(avatar.style, index), [avatar.style, index]);
  const category = useMemo(() => getCategoryFromTags(avatar.tags, avatar.avatar_type), [avatar.tags, avatar.avatar_type]);
  const imageUrl = avatar.thumbnail_url || avatar.face_image_url;
  
  // Limit stagger delay to prevent animation overload (max 0.5s stagger)
  const animationDelay = Math.min(index * 0.05, 0.5);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: animationDelay, 
        duration: 0.4,
        ease: 'easeOut'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative cursor-pointer"
    >
      {/* Card container */}
      <div className={cn(
        "relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300",
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
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-full object-cover object-top transition-all duration-500",
            isHovered ? "scale-105 brightness-110" : "scale-100 brightness-90",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />
        
        {/* Category badge */}
        <div className={cn(
          "absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider",
          "bg-black/60 backdrop-blur-xl border border-white/20 text-white/80"
        )}>
          {category}
        </div>
        
        {/* Premium star - simplified, no staggered animation */}
        <div className="absolute top-3 right-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Star className="w-3.5 h-3.5 text-white fill-white" />
          </div>
        </div>
        
        {/* Info panel */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className={cn(
            "transition-all duration-300",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-90"
          )}>
            <h3 className="text-white font-bold text-lg mb-0.5 tracking-tight">
              {avatar.name}
            </h3>
            <p className="text-white/60 text-sm line-clamp-1">
              {avatar.personality || avatar.description || 'AI Avatar'}
            </p>
          </div>
          
          {/* Hover action hint */}
          <div className={cn(
            "mt-3 flex items-center gap-2 text-xs text-white/50 transition-all duration-200",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}>
            <Sparkles className="w-3 h-3" />
            <span>Click to create with this avatar</span>
          </div>
        </div>
        
        {/* Shine effect - only on hover, no motion animation */}
        {isHovered && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none animate-pulse" />
        )}
      </div>
    </motion.div>
  );
});

interface FamousAvatarsShowcaseProps {
  className?: string;
}

export const FamousAvatarsShowcase = memo(function FamousAvatarsShowcase({ className }: FamousAvatarsShowcaseProps) {
  const navigate = useNavigate();
  const { data: avatars = [], isLoading, error } = useShowcaseAvatars();
  
  // CRITICAL: Memoize shuffled avatars to prevent re-shuffle on every render
  // Uses stable session seed for consistent ordering during navigation
  const shuffledAvatars = useMemo(() => {
    if (avatars.length === 0) return [];
    return shuffleAvatarIds(avatars.map(a => a.id))
      .map(id => avatars.find(a => a.id === id))
      .filter((a): a is ShowcaseAvatar => a !== undefined);
  }, [avatars]);
  
  // Use world-class chunked loading pattern to prevent crashes
  // STABILITY: Conservative settings to prevent memory pressure
  const {
    visibleAvatars,
    isFullyLoaded,
    loadProgress,
    loadAll,
  } = useChunkedAvatars(shuffledAvatars as any, {
    enabled: true,
    initialSize: INITIAL_CHUNK_SIZE,
    chunkSize: CHUNK_SIZE,
    chunkDelay: CHUNK_DELAY_MS,
  });
  
  const hasMore = !isFullyLoaded && shuffledAvatars.length > 0;
  
  if (isLoading) {
    return (
      <div className={cn("relative py-16 px-6 md:px-12 flex items-center justify-center", className)}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }
  
  // Graceful handling of errors or empty state
  if (error || shuffledAvatars.length === 0) {
    return null;
  }
  
  return (
    <section className={cn("relative py-16 px-6 md:px-12", className)}>
      {/* Section background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-6">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-white/70 font-medium">Premium Avatar Collection</span>
        </div>
        
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
          Iconic Characters,{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Infinite Stories
          </span>
        </h2>
        
        <p className="text-white/50 text-lg max-w-2xl mx-auto">
          Create stunning videos with legendary personas. From ancient royalty to modern influencers.
        </p>
      </div>
      
      {/* Avatar grid with progressive loading */}
      <div className="max-w-7xl mx-auto">
        {/* Progress indicator during chunked loading */}
        {!isFullyLoaded && loadProgress > 0 && loadProgress < 100 && (
          <div className="flex items-center justify-center gap-2 mb-4 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading avatars... {loadProgress}%</span>
          </div>
        )}
        
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {visibleAvatars.map((avatar, index) => (
              <AvatarCard key={avatar.id} avatar={avatar as ShowcaseAvatar} index={index} />
            ))}
          </div>
        </AnimatePresence>
        
        {/* Load More button */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              onClick={loadAll}
              className="px-6 py-2 text-white/70 border-white/20 hover:bg-white/5 hover:text-white"
            >
              Show all {avatars.length} avatars
            </Button>
          </div>
        )}
      </div>
      
      {/* See More CTA */}
      <div className="flex justify-center mt-12">
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
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />
    </section>
  );
});

export default FamousAvatarsShowcase;
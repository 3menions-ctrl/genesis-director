import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Palette, Search, Sun, Moon, Sunrise, CloudSun,
  TreePine, Waves, Mountain, Home, Sparkles,
  Check, X, TrendingUp, Building2, Flame, 
  Snowflake, Camera, Zap, Star, Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Import generated environment images - 20 unique stunning environments
import goldenHourMagicImg from '@/assets/environments/golden-hour-magic.jpg';
import neonNightsImg from '@/assets/environments/neon-nights.jpg';
import cozyCabinImg from '@/assets/environments/cozy-cabin.jpg';
import desertDunesImg from '@/assets/environments/desert-dunes.jpg';
import volcanicDramaImg from '@/assets/environments/volcanic-drama.jpg';
import cherryBlossomImg from '@/assets/environments/cherry-blossom.jpg';
import underwaterDreamsImg from '@/assets/environments/underwater-dreams.jpg';
import spaceStationImg from '@/assets/environments/space-station.jpg';
import enchantedForestImg from '@/assets/environments/enchanted-forest.jpg';
import urbanLuxuryImg from '@/assets/environments/urban-luxury.jpg';
import arcticAuroraImg from '@/assets/environments/arctic-aurora.jpg';
import retroArcadeImg from '@/assets/environments/retro-arcade.jpg';
import ancientRuinsImg from '@/assets/environments/ancient-ruins.jpg';
import tropicalParadiseImg from '@/assets/environments/tropical-paradise.jpg';
import postApocalypticImg from '@/assets/environments/post-apocalyptic.jpg';
import whiteStudioImg from '@/assets/environments/white-studio.jpg';
import steampunkLabImg from '@/assets/environments/steampunk-lab.jpg';
import cloudNineImg from '@/assets/environments/cloud-nine.jpg';
import zenGardenImg from '@/assets/environments/zen-garden.jpg';
import mountainSummitImg from '@/assets/environments/mountain-summit.jpg';

// Environment presets with unique epic ideas - 20 stunning environments
const ENVIRONMENT_PRESETS = [
  // TRENDING - What creators love
  {
    id: 'golden_hour_magic',
    name: 'Golden Hour Magic',
    description: 'That perfect 30-minute window of warm, dreamy sunlight everyone chases',
    category: 'exterior',
    image: goldenHourMagicImg,
    lighting: { type: 'natural', direction: 'backlit', intensity: 'soft', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#FFB347', secondary: '#FFCC80', accent: '#FF8C00', shadows: '#8B4513' },
    mood: 'dreamy',
    icon: Sunrise,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'neon_nights',
    name: 'Neon Nights',
    description: 'Electric city lights, rain-slicked streets, cyberpunk energy',
    category: 'exterior',
    image: neonNightsImg,
    lighting: { type: 'artificial', direction: 'multi', intensity: 'vibrant', temperature: 'cool', timeOfDay: 'night' },
    colorPalette: { primary: '#FF1493', secondary: '#00FFFF', accent: '#9400D3', shadows: '#0D0D1A' },
    mood: 'electric',
    icon: Zap,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'cozy_cabin',
    name: 'Cozy Cabin',
    description: 'Warm firelight, wooden textures, hygge vibes for storytelling',
    category: 'interior',
    image: cozyCabinImg,
    lighting: { type: 'fire', direction: 'ambient', intensity: 'low', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#8B4513', secondary: '#D2691E', accent: '#FFD700', shadows: '#3D1F0F' },
    mood: 'intimate',
    icon: Flame,
    is_trending: true,
  },
  {
    id: 'desert_dunes',
    name: 'Desert Dunes',
    description: 'Endless golden sand waves under blazing sun, epic Sahara vibes',
    category: 'exterior',
    image: desertDunesImg,
    lighting: { type: 'natural', direction: 'overhead', intensity: 'harsh', temperature: 'warm', timeOfDay: 'sunset' },
    colorPalette: { primary: '#C2B280', secondary: '#DEB887', accent: '#CD853F', shadows: '#8B7355' },
    mood: 'epic',
    icon: Sun,
    is_trending: true,
  },
  {
    id: 'volcanic_drama',
    name: 'Volcanic Drama',
    description: 'Molten lava rivers, apocalyptic skies, raw elemental power',
    category: 'exterior',
    image: volcanicDramaImg,
    lighting: { type: 'fire', direction: 'below', intensity: 'harsh', temperature: 'very_warm', timeOfDay: 'night' },
    colorPalette: { primary: '#8B0000', secondary: '#FF4500', accent: '#FFD700', shadows: '#1A0000' },
    mood: 'intense',
    icon: Flame,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    description: 'Soft pink petals, koi pond, serene Japanese spring garden',
    category: 'exterior',
    image: cherryBlossomImg,
    lighting: { type: 'natural', direction: 'filtered', intensity: 'soft', temperature: 'warm', timeOfDay: 'afternoon' },
    colorPalette: { primary: '#FFB7C5', secondary: '#FFC0CB', accent: '#8B4513', shadows: '#DB7093' },
    mood: 'romantic',
    icon: Heart,
    is_trending: true,
  },
  {
    id: 'underwater_dreams',
    name: 'Underwater Dreams',
    description: 'Bioluminescent deep sea, coral reefs, aquatic mystery',
    category: 'exterior',
    image: underwaterDreamsImg,
    lighting: { type: 'filtered', direction: 'overhead', intensity: 'dappled', temperature: 'cool', timeOfDay: 'midday' },
    colorPalette: { primary: '#006994', secondary: '#00CED1', accent: '#00FF7F', shadows: '#00008B' },
    mood: 'mysterious',
    icon: Waves,
    is_trending: true,
  },
  {
    id: 'space_station',
    name: 'Space Station',
    description: 'Futuristic orbital hub with Earth views, sci-fi minimalism',
    category: 'interior',
    image: spaceStationImg,
    lighting: { type: 'artificial', direction: 'ambient', intensity: 'soft', temperature: 'cool', timeOfDay: 'space' },
    colorPalette: { primary: '#E8E8E8', secondary: '#B0C4DE', accent: '#4169E1', shadows: '#2F4F4F' },
    mood: 'futuristic',
    icon: Star,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'enchanted_forest',
    name: 'Enchanted Forest',
    description: 'Glowing mushrooms, fireflies, mystical fairy tale woodland',
    category: 'exterior',
    image: enchantedForestImg,
    lighting: { type: 'natural', direction: 'scattered', intensity: 'dappled', temperature: 'cool', timeOfDay: 'twilight' },
    colorPalette: { primary: '#228B22', secondary: '#32CD32', accent: '#FFD700', shadows: '#013220' },
    mood: 'magical',
    icon: TreePine,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'urban_luxury',
    name: 'Urban Luxury',
    description: 'Penthouse infinity pool, city skyline at twilight, glamour',
    category: 'interior',
    image: urbanLuxuryImg,
    lighting: { type: 'mixed', direction: 'ambient', intensity: 'soft', temperature: 'warm', timeOfDay: 'blue_hour' },
    colorPalette: { primary: '#1A1A1A', secondary: '#333333', accent: '#9370DB', shadows: '#0D0D0D' },
    mood: 'luxurious',
    icon: Building2,
    is_trending: true,
  },
  // MORE EPIC ENVIRONMENTS
  {
    id: 'arctic_aurora',
    name: 'Arctic Aurora',
    description: 'Northern lights dancing over frozen tundra, cosmic wonder',
    category: 'exterior',
    image: arcticAuroraImg,
    lighting: { type: 'natural', direction: 'overhead', intensity: 'ethereal', temperature: 'very_cool', timeOfDay: 'night' },
    colorPalette: { primary: '#00FF00', secondary: '#9400D3', accent: '#E8F4F8', shadows: '#191970' },
    mood: 'ethereal',
    icon: Snowflake,
    is_popular: true,
  },
  {
    id: 'retro_arcade',
    name: 'Retro Arcade',
    description: '80s synthwave nostalgia, neon machines, checkered floors',
    category: 'interior',
    image: retroArcadeImg,
    lighting: { type: 'artificial', direction: 'multi', intensity: 'vibrant', temperature: 'cool', timeOfDay: 'night' },
    colorPalette: { primary: '#FF1493', secondary: '#00CED1', accent: '#FFD700', shadows: '#1A1A2E' },
    mood: 'nostalgic',
    icon: Sparkles,
  },
  {
    id: 'ancient_ruins',
    name: 'Ancient Ruins',
    description: 'Greek temple at sunset, ivy-covered marble, timeless history',
    category: 'exterior',
    image: ancientRuinsImg,
    lighting: { type: 'natural', direction: 'low_angle', intensity: 'warm', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#D4A574', secondary: '#F5DEB3', accent: '#556B2F', shadows: '#8B7355' },
    mood: 'historic',
    icon: Building2,
    is_popular: true,
  },
  {
    id: 'tropical_paradise',
    name: 'Tropical Paradise',
    description: 'Pristine beach at sunset, palm silhouettes, vacation dreams',
    category: 'exterior',
    image: tropicalParadiseImg,
    lighting: { type: 'natural', direction: 'backlit', intensity: 'vibrant', temperature: 'warm', timeOfDay: 'sunset' },
    colorPalette: { primary: '#FF6B6B', secondary: '#40E0D0', accent: '#FF8C00', shadows: '#2E8B57' },
    mood: 'paradise',
    icon: Waves,
    is_popular: true,
  },
  {
    id: 'post_apocalyptic',
    name: 'Post-Apocalyptic',
    description: 'Overgrown abandoned city, nature reclaiming concrete, haunting beauty',
    category: 'exterior',
    image: postApocalypticImg,
    lighting: { type: 'natural', direction: 'diffused', intensity: 'moody', temperature: 'desaturated', timeOfDay: 'overcast' },
    colorPalette: { primary: '#556B2F', secondary: '#8B8378', accent: '#CD853F', shadows: '#3D3D3D' },
    mood: 'dramatic',
    icon: CloudSun,
  },
  {
    id: 'white_studio',
    name: 'White Studio',
    description: 'Clean professional backdrop, perfect for products and talking heads',
    category: 'interior',
    image: whiteStudioImg,
    lighting: { type: 'artificial', direction: 'even', intensity: 'bright', temperature: 'neutral', timeOfDay: 'controlled' },
    colorPalette: { primary: '#FFFFFF', secondary: '#F5F5F5', accent: '#333333', shadows: '#E0E0E0' },
    mood: 'professional',
    icon: Camera,
    is_popular: true,
  },
  {
    id: 'steampunk_lab',
    name: 'Steampunk Lab',
    description: 'Victorian brass machinery, copper pipes, industrial invention',
    category: 'interior',
    image: steampunkLabImg,
    lighting: { type: 'artificial', direction: 'ambient', intensity: 'warm', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#B8860B', secondary: '#CD7F32', accent: '#FFD700', shadows: '#3D2914' },
    mood: 'inventive',
    icon: Sparkles,
  },
  {
    id: 'cloud_nine',
    name: 'Cloud Nine',
    description: 'Heavenly cloudscape, golden rays, ethereal ascension',
    category: 'exterior',
    image: cloudNineImg,
    lighting: { type: 'natural', direction: 'backlit', intensity: 'glowing', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#FFFAF0', secondary: '#FFD700', accent: '#87CEEB', shadows: '#D3D3D3' },
    mood: 'divine',
    icon: CloudSun,
  },
  {
    id: 'zen_garden',
    name: 'Zen Garden',
    description: 'Raked sand patterns, bamboo, misty morning meditation',
    category: 'exterior',
    image: zenGardenImg,
    lighting: { type: 'natural', direction: 'diffused', intensity: 'soft', temperature: 'neutral', timeOfDay: 'dawn' },
    colorPalette: { primary: '#90EE90', secondary: '#F5F5DC', accent: '#228B22', shadows: '#696969' },
    mood: 'peaceful',
    icon: TreePine,
  },
  {
    id: 'mountain_summit',
    name: 'Mountain Summit',
    description: 'Epic peak above clouds at sunrise, achievement and adventure',
    category: 'exterior',
    image: mountainSummitImg,
    lighting: { type: 'natural', direction: 'low_angle', intensity: 'dramatic', temperature: 'warm', timeOfDay: 'dawn' },
    colorPalette: { primary: '#4682B4', secondary: '#FFD700', accent: '#FF6347', shadows: '#2F4F4F' },
    mood: 'epic',
    icon: Mountain,
    is_popular: true,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Palette },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'interior', label: 'Interior', icon: Home },
  { id: 'exterior', label: 'Exterior', icon: TreePine },
];

function EnvironmentCard({ 
  environment,
  onApply,
  index = 0,
}: { 
  environment: typeof ENVIRONMENT_PRESETS[0];
  onApply: () => void;
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = environment.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onApply}
      className="group relative cursor-pointer"
    >
      {/* Card Container - Compact */}
      <div className={cn(
        "relative aspect-[3/4] rounded-xl overflow-hidden",
        "bg-muted transition-all duration-300",
        "border border-border/50 hover:border-border",
        "shadow-sm hover:shadow-lg"
      )}>
        {/* Image */}
        <img 
          src={environment.image} 
          alt={environment.name}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-transform duration-500",
            isHovered ? "scale-110" : "scale-100"
          )}
        />
        
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300",
          isHovered 
            ? "bg-gradient-to-t from-black/90 via-black/50 to-black/20" 
            : "bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        )} />

        {/* Badges - Top */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          <div className="flex gap-1">
            {environment.is_trending && (
              <Badge className="bg-amber-500/90 text-white border-0 text-[10px] px-1.5 py-0.5">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                Hot
              </Badge>
            )}
            {environment.is_popular && (
              <Badge className="bg-rose-500/90 text-white border-0 text-[10px] px-1.5 py-0.5">
                <Heart className="w-2.5 h-2.5 mr-0.5" />
                Popular
              </Badge>
            )}
          </div>
          <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <IconComponent className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Quick Apply - Hover */}
        {isHovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg z-10"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
          >
            <Check className="w-4 h-4 text-foreground" />
          </motion.button>
        )}

        {/* Content - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
            {environment.name}
          </h3>
          
          {/* Show description on hover */}
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isHovered ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          )}>
            <p className="text-[11px] text-white/70 mb-2 line-clamp-2">
              {environment.description}
            </p>
          </div>
          
          {/* Tags */}
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="bg-white/10 border-white/20 text-white/90 text-[10px] px-1.5 py-0 capitalize">
              {environment.category}
            </Badge>
            <Badge variant="outline" className="bg-white/10 border-white/20 text-white/90 text-[10px] px-1.5 py-0 capitalize">
              {environment.mood}
            </Badge>
          </div>
          
          {/* Color Palette - Hover */}
          <div className={cn(
            "flex items-center gap-1 mt-2 transition-all duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            {Object.values(environment.colorPalette).slice(0, 4).map((color, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border border-white/30"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Environments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredEnvironments = ENVIRONMENT_PRESETS.filter(env => {
    const matchesSearch = !searchQuery || 
      env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      env.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      env.mood.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeCategory === 'trending') {
      return matchesSearch && env.is_trending;
    }
    
    const matchesCategory = activeCategory === 'all' || env.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleApplyEnvironment = (environment: typeof ENVIRONMENT_PRESETS[0]) => {
    navigate(`/create?environment=${environment.id}`);
    toast.success(`Applied "${environment.name}" environment`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showCreate={false} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Compact Header */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Environments
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredEnvironments.length} visual atmospheres for your production
            </p>
          </div>
          
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search environments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-card border-border rounded-lg text-sm"
            />
          </div>
        </motion.div>

        {/* Category Pills */}
        <motion.div 
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap",
                activeCategory === cat.id
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
              )}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Environments Grid - Compact 6 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredEnvironments.map((environment, index) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              onApply={() => handleApplyEnvironment(environment)}
              index={index}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredEnvironments.length === 0 && (
          <motion.div 
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No environments found</h3>
            <p className="text-xs text-muted-foreground mb-3">Try adjusting your search or filters</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="rounded-lg text-xs"
            >
              <X className="w-3 h-3 mr-1.5" />
              Clear Filters
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

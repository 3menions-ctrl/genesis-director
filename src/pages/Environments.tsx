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

// Import generated environment images
import goldenHourStudioImg from '@/assets/environments/golden-hour-studio.jpg';
import neonNoirCityImg from '@/assets/environments/neon-noir-city.jpg';
import coastalSerenityImg from '@/assets/environments/coastal-serenity.jpg';
import forestMystiqueImg from '@/assets/environments/forest-mystique.jpg';
import modernMinimalistImg from '@/assets/environments/modern-minimalist.jpg';
import alpineDawnImg from '@/assets/environments/alpine-dawn.jpg';
import cozyFirelightImg from '@/assets/environments/cozy-firelight.jpg';
import overcastDramaImg from '@/assets/environments/overcast-drama.jpg';

// Environment presets with generated images
const ENVIRONMENT_PRESETS = [
  // TRENDING ENVIRONMENTS
  {
    id: 'aesthetic_soft_glow',
    name: 'Aesthetic Soft Glow',
    description: 'Dreamy pastel lighting with soft bokeh, perfect for lifestyle and beauty content',
    category: 'interior',
    image: goldenHourStudioImg,
    lighting: { type: 'natural', direction: 'diffused', intensity: 'soft', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#FFE4E1', secondary: '#E6E6FA', accent: '#FFB6C1', shadows: '#DDA0DD' },
    mood: 'dreamy',
    icon: Heart,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'dark_moody_cinematic',
    name: 'Dark Moody Cinematic',
    description: 'High contrast shadows with dramatic rim lighting, Hollywood thriller vibes',
    category: 'interior',
    image: neonNoirCityImg,
    lighting: { type: 'artificial', direction: 'rim', intensity: 'high_contrast', temperature: 'cool', timeOfDay: 'night' },
    colorPalette: { primary: '#1A1A2E', secondary: '#16213E', accent: '#E94560', shadows: '#0F0F1A' },
    mood: 'dramatic',
    icon: Moon,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'y2k_retro_future',
    name: 'Y2K Retro Future',
    description: 'Chrome reflections, pink and blue neon, early 2000s aesthetic revival',
    category: 'interior',
    image: neonNoirCityImg,
    lighting: { type: 'artificial', direction: 'multi', intensity: 'vibrant', temperature: 'mixed', timeOfDay: 'night' },
    colorPalette: { primary: '#FF00FF', secondary: '#00FFFF', accent: '#C0C0C0', shadows: '#4B0082' },
    mood: 'nostalgic',
    icon: Star,
    is_trending: true,
  },
  {
    id: 'cottagecore_warmth',
    name: 'Cottagecore Warmth',
    description: 'Soft natural light through lace curtains, rustic countryside charm',
    category: 'interior',
    image: cozyFirelightImg,
    lighting: { type: 'natural', direction: 'window', intensity: 'soft', temperature: 'warm', timeOfDay: 'morning' },
    colorPalette: { primary: '#F5DEB3', secondary: '#8B7355', accent: '#556B2F', shadows: '#6B4423' },
    mood: 'cozy',
    icon: Home,
    is_trending: true,
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    description: 'Intense neon blues and pinks, rain-soaked urban dystopia',
    category: 'exterior',
    image: neonNoirCityImg,
    lighting: { type: 'artificial', direction: 'multi', intensity: 'high', temperature: 'cold', timeOfDay: 'night' },
    colorPalette: { primary: '#FF1493', secondary: '#00CED1', accent: '#7B68EE', shadows: '#0D0D1A' },
    mood: 'futuristic',
    icon: Zap,
    is_trending: true,
    is_popular: true,
  },
  {
    id: 'sunset_beach_vibes',
    name: 'Sunset Beach Vibes',
    description: 'Warm orange and pink sunset over calm ocean, vacation energy',
    category: 'exterior',
    image: coastalSerenityImg,
    lighting: { type: 'natural', direction: 'backlit', intensity: 'warm', temperature: 'very_warm', timeOfDay: 'sunset' },
    colorPalette: { primary: '#FF6B35', secondary: '#F7931E', accent: '#FFD700', shadows: '#8B4513' },
    mood: 'relaxed',
    icon: Sunrise,
    is_trending: true,
  },
  {
    id: 'clean_white_studio',
    name: 'Clean White Studio',
    description: 'Bright, even lighting on pure white backdrop, product photography standard',
    category: 'interior',
    image: modernMinimalistImg,
    lighting: { type: 'artificial', direction: 'even', intensity: 'bright', temperature: 'neutral', timeOfDay: 'controlled' },
    colorPalette: { primary: '#FFFFFF', secondary: '#F8F8F8', accent: '#E0E0E0', shadows: '#CCCCCC' },
    mood: 'professional',
    icon: Camera,
    is_trending: true,
  },
  {
    id: 'urban_rooftop',
    name: 'Urban Rooftop',
    description: 'City skyline backdrop with mixed ambient and artificial lighting',
    category: 'exterior',
    image: neonNoirCityImg,
    lighting: { type: 'mixed', direction: 'ambient', intensity: 'medium', temperature: 'mixed', timeOfDay: 'blue_hour' },
    colorPalette: { primary: '#2C3E50', secondary: '#34495E', accent: '#E74C3C', shadows: '#1A252F' },
    mood: 'urban',
    icon: Building2,
    is_trending: true,
  },
  // CLASSIC ENVIRONMENTS
  {
    id: 'golden_hour_studio',
    name: 'Golden Hour Studio',
    description: 'Warm natural light streaming through floor-to-ceiling windows',
    category: 'interior',
    image: goldenHourStudioImg,
    lighting: { type: 'natural', direction: 'side', intensity: 'soft', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#D4A056', secondary: '#B87333', accent: '#F5C563', shadows: '#5C3D2E' },
    mood: 'cinematic',
    icon: Sunrise,
    is_popular: true,
  },
  {
    id: 'neon_noir_city',
    name: 'Neon Noir City',
    description: 'Rain-slicked streets reflecting vibrant neon signs',
    category: 'exterior',
    image: neonNoirCityImg,
    lighting: { type: 'artificial', direction: 'multi', intensity: 'high_contrast', temperature: 'mixed', timeOfDay: 'night' },
    colorPalette: { primary: '#9B4DCA', secondary: '#00CED1', accent: '#FF1493', shadows: '#1A1A2E' },
    mood: 'dramatic',
    icon: Moon,
  },
  {
    id: 'coastal_serenity',
    name: 'Coastal Serenity',
    description: 'Soft diffused light with ocean breeze atmosphere',
    category: 'exterior',
    image: coastalSerenityImg,
    lighting: { type: 'natural', direction: 'overhead', intensity: 'bright', temperature: 'neutral', timeOfDay: 'midday' },
    colorPalette: { primary: '#5DADE2', secondary: '#F4D03F', accent: '#58D68D', shadows: '#3498DB' },
    mood: 'peaceful',
    icon: Waves,
  },
  {
    id: 'forest_mystique',
    name: 'Forest Mystique',
    description: 'Dappled sunlight through dense canopy',
    category: 'exterior',
    image: forestMystiqueImg,
    lighting: { type: 'natural', direction: 'scattered', intensity: 'dappled', temperature: 'cool', timeOfDay: 'afternoon' },
    colorPalette: { primary: '#2E7D32', secondary: '#689F38', accent: '#C9A227', shadows: '#1B4332' },
    mood: 'mysterious',
    icon: TreePine,
  },
  {
    id: 'modern_minimalist',
    name: 'Modern Minimalist',
    description: 'Clean lines with carefully controlled studio lighting',
    category: 'interior',
    image: modernMinimalistImg,
    lighting: { type: 'artificial', direction: 'diffused', intensity: 'even', temperature: 'neutral', timeOfDay: 'controlled' },
    colorPalette: { primary: '#F5F5F5', secondary: '#D9D9D9', accent: '#2D2D2D', shadows: '#B3B3B3' },
    mood: 'professional',
    icon: Home,
  },
  {
    id: 'alpine_dawn',
    name: 'Alpine Dawn',
    description: 'Crisp mountain air with early morning light',
    category: 'exterior',
    image: alpineDawnImg,
    lighting: { type: 'natural', direction: 'low_angle', intensity: 'soft', temperature: 'cool', timeOfDay: 'dawn' },
    colorPalette: { primary: '#87CEEB', secondary: '#DAA520', accent: '#DC143C', shadows: '#4A6FA5' },
    mood: 'inspiring',
    icon: Mountain,
  },
  {
    id: 'cozy_firelight',
    name: 'Cozy Firelight',
    description: 'Warm flickering glow, intimate cabin interior',
    category: 'interior',
    image: cozyFirelightImg,
    lighting: { type: 'fire', direction: 'point', intensity: 'low', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#CD853F', secondary: '#8B4513', accent: '#DEB887', shadows: '#3D1F0F' },
    mood: 'intimate',
    icon: Flame,
  },
  {
    id: 'overcast_drama',
    name: 'Overcast Drama',
    description: 'Soft diffused light from cloudy sky',
    category: 'exterior',
    image: overcastDramaImg,
    lighting: { type: 'natural', direction: 'overhead', intensity: 'soft', temperature: 'cool', timeOfDay: 'overcast' },
    colorPalette: { primary: '#7F8C8D', secondary: '#6C7A89', accent: '#5D8AA8', shadows: '#4A5568' },
    mood: 'contemplative',
    icon: CloudSun,
  },
  {
    id: 'winter_wonderland',
    name: 'Winter Wonderland',
    description: 'Bright snow reflection with crisp blue shadows',
    category: 'exterior',
    image: alpineDawnImg,
    lighting: { type: 'natural', direction: 'reflected', intensity: 'bright', temperature: 'very_cool', timeOfDay: 'midday' },
    colorPalette: { primary: '#E8F4F8', secondary: '#B0C4DE', accent: '#4682B4', shadows: '#5F9EA0' },
    mood: 'magical',
    icon: Snowflake,
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

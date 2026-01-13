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
  Check, ArrowRight, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
  {
    id: 'golden_hour_studio',
    name: 'Golden Hour Studio',
    description: 'Warm natural light streaming through floor-to-ceiling windows, casting long golden shadows',
    category: 'interior',
    image: goldenHourStudioImg,
    lighting: { type: 'natural', direction: 'side', intensity: 'soft', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#D4A056', secondary: '#B87333', accent: '#F5C563', shadows: '#5C3D2E' },
    mood: 'cinematic',
    icon: Sunrise,
  },
  {
    id: 'neon_noir_city',
    name: 'Neon Noir City',
    description: 'Rain-slicked streets reflecting vibrant neon signs, moody urban atmosphere',
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
    description: 'Soft diffused light with ocean breeze, peaceful beach villa atmosphere',
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
    description: 'Dappled sunlight through dense canopy, enchanting woodland setting',
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
    description: 'Clean lines, neutral tones, and carefully controlled studio lighting',
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
    description: 'Crisp mountain air with early morning light painting snow-capped peaks',
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
    description: 'Warm flickering glow from fireplace, intimate cabin interior',
    category: 'interior',
    image: cozyFirelightImg,
    lighting: { type: 'fire', direction: 'point', intensity: 'low', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#CD853F', secondary: '#8B4513', accent: '#DEB887', shadows: '#3D1F0F' },
    mood: 'intimate',
    icon: Sun,
  },
  {
    id: 'overcast_drama',
    name: 'Overcast Drama',
    description: 'Soft diffused light from cloudy sky, moody and contemplative atmosphere',
    category: 'exterior',
    image: overcastDramaImg,
    lighting: { type: 'natural', direction: 'overhead', intensity: 'soft', temperature: 'cool', timeOfDay: 'overcast' },
    colorPalette: { primary: '#7F8C8D', secondary: '#6C7A89', accent: '#5D8AA8', shadows: '#4A5568' },
    mood: 'contemplative',
    icon: CloudSun,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Environments', icon: Palette },
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      {/* Card Container */}
      <div className={cn(
        "relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer",
        "bg-muted transition-all duration-500",
        "shadow-sm hover:shadow-xl"
      )}>
        {/* Full Image */}
        <img 
          src={environment.image} 
          alt={environment.name}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700",
            isHovered ? "scale-110" : "scale-100"
          )}
        />
        
        {/* Subtle gradient overlay always visible at bottom */}
        <div className={cn(
          "absolute inset-0 transition-all duration-500",
          isHovered 
            ? "bg-gradient-to-t from-black/80 via-black/40 to-black/10" 
            : "bg-gradient-to-t from-black/60 via-transparent to-transparent"
        )} />

        {/* Title - Always visible at bottom */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-5 transition-all duration-500",
          isHovered ? "translate-y-[-60px]" : "translate-y-0"
        )}>
          <h3 className="text-xl font-semibold text-white mb-1 drop-shadow-lg">
            {environment.name}
          </h3>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 text-xs capitalize">
              {environment.category}
            </Badge>
            <Badge variant="outline" className="bg-white/10 backdrop-blur-sm border-white/30 text-white/90 text-xs capitalize">
              {environment.mood}
            </Badge>
          </div>
        </div>

        {/* Expanded info on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 p-5"
            >
              <p className="text-sm text-white/80 mb-4 line-clamp-2">
                {environment.description}
              </p>
              
              {/* Color Palette */}
              <div className="flex items-center gap-2 mb-4">
                {Object.values(environment.colorPalette).map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full shadow-lg border-2 border-white/30"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                className="w-full bg-white text-foreground hover:bg-white/90 rounded-xl h-11 font-medium shadow-lg"
              >
                Apply Environment
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick apply button - top right */}
        <AnimatePresence>
          {isHovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={(e) => {
                e.stopPropagation();
                onApply();
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-white transition-colors"
            >
              <Check className="w-5 h-5 text-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
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
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground mb-6 shadow-lg">
            <Palette className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Environment Library
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choose a visual atmosphere to define the lighting, colors, and mood of your production
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search environments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-card border-border rounded-xl"
            />
          </div>
          
          {/* Category Filters */}
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                  activeCategory === cat.id
                    ? "bg-foreground text-background shadow-md"
                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results count */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-sm text-muted-foreground">
            {filteredEnvironments.length} environment{filteredEnvironments.length !== 1 ? 's' : ''} available
          </p>
        </motion.div>

        {/* Environments Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No environments found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <Button 
              variant="outline" 
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="rounded-xl"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

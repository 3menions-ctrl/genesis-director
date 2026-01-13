import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Palette, Search, Sun, Moon, Sunrise, CloudSun,
  TreePine, Waves, Mountain, Home, Sparkles,
  Check, Eye, Wand2, Lightbulb, Camera, Layers,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Environment presets with full DNA
const ENVIRONMENT_PRESETS = [
  {
    id: 'golden_hour_studio',
    name: 'Golden Hour Studio',
    description: 'Warm natural light streaming through floor-to-ceiling windows, casting long golden shadows',
    category: 'interior',
    lighting: {
      type: 'natural',
      direction: 'side',
      intensity: 'soft',
      temperature: 'warm',
      timeOfDay: 'golden_hour',
    },
    colorPalette: {
      primary: '#D4A056',
      secondary: '#B87333',
      accent: '#F5C563',
      shadows: '#5C3D2E',
    },
    mood: 'cinematic',
    icon: Sunrise,
    gradient: 'from-amber-500/30 via-orange-500/20 to-yellow-500/10',
  },
  {
    id: 'neon_noir_city',
    name: 'Neon Noir City',
    description: 'Rain-slicked streets reflecting vibrant neon signs, moody urban atmosphere',
    category: 'exterior',
    lighting: {
      type: 'artificial',
      direction: 'multi',
      intensity: 'high_contrast',
      temperature: 'mixed',
      timeOfDay: 'night',
    },
    colorPalette: {
      primary: '#9B4DCA',
      secondary: '#00CED1',
      accent: '#FF1493',
      shadows: '#1A1A2E',
    },
    mood: 'dramatic',
    icon: Moon,
    gradient: 'from-violet-500/30 via-fuchsia-500/20 to-cyan-500/10',
  },
  {
    id: 'coastal_serenity',
    name: 'Coastal Serenity',
    description: 'Soft diffused light with ocean breeze, peaceful beach villa atmosphere',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'overhead',
      intensity: 'bright',
      temperature: 'neutral',
      timeOfDay: 'midday',
    },
    colorPalette: {
      primary: '#5DADE2',
      secondary: '#F4D03F',
      accent: '#58D68D',
      shadows: '#3498DB',
    },
    mood: 'peaceful',
    icon: Waves,
    gradient: 'from-cyan-500/30 via-blue-500/20 to-teal-500/10',
  },
  {
    id: 'forest_mystique',
    name: 'Forest Mystique',
    description: 'Dappled sunlight through dense canopy, enchanting woodland setting',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'scattered',
      intensity: 'dappled',
      temperature: 'cool',
      timeOfDay: 'afternoon',
    },
    colorPalette: {
      primary: '#2E7D32',
      secondary: '#689F38',
      accent: '#C9A227',
      shadows: '#1B4332',
    },
    mood: 'mysterious',
    icon: TreePine,
    gradient: 'from-emerald-500/30 via-green-500/20 to-lime-500/10',
  },
  {
    id: 'modern_minimalist',
    name: 'Modern Minimalist',
    description: 'Clean lines, neutral tones, and carefully controlled studio lighting',
    category: 'interior',
    lighting: {
      type: 'artificial',
      direction: 'diffused',
      intensity: 'even',
      temperature: 'neutral',
      timeOfDay: 'controlled',
    },
    colorPalette: {
      primary: '#F5F5F5',
      secondary: '#D9D9D9',
      accent: '#2D2D2D',
      shadows: '#B3B3B3',
    },
    mood: 'professional',
    icon: Home,
    gradient: 'from-slate-400/30 via-gray-400/20 to-zinc-400/10',
  },
  {
    id: 'alpine_dawn',
    name: 'Alpine Dawn',
    description: 'Crisp mountain air with early morning light painting snow-capped peaks',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'low_angle',
      intensity: 'soft',
      temperature: 'cool',
      timeOfDay: 'dawn',
    },
    colorPalette: {
      primary: '#87CEEB',
      secondary: '#DAA520',
      accent: '#DC143C',
      shadows: '#4A6FA5',
    },
    mood: 'inspiring',
    icon: Mountain,
    gradient: 'from-sky-500/30 via-blue-500/20 to-indigo-500/10',
  },
  {
    id: 'cozy_firelight',
    name: 'Cozy Firelight',
    description: 'Warm flickering glow from fireplace, intimate cabin interior',
    category: 'interior',
    lighting: {
      type: 'fire',
      direction: 'point',
      intensity: 'low',
      temperature: 'very_warm',
      timeOfDay: 'evening',
    },
    colorPalette: {
      primary: '#CD853F',
      secondary: '#8B4513',
      accent: '#DEB887',
      shadows: '#3D1F0F',
    },
    mood: 'intimate',
    icon: Sun,
    gradient: 'from-orange-500/30 via-amber-500/20 to-red-500/10',
  },
  {
    id: 'overcast_drama',
    name: 'Overcast Drama',
    description: 'Soft diffused light from cloudy sky, moody and contemplative atmosphere',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'overhead',
      intensity: 'soft',
      temperature: 'cool',
      timeOfDay: 'overcast',
    },
    colorPalette: {
      primary: '#7F8C8D',
      secondary: '#6C7A89',
      accent: '#5D8AA8',
      shadows: '#4A5568',
    },
    mood: 'contemplative',
    icon: CloudSun,
    gradient: 'from-slate-500/30 via-gray-500/20 to-zinc-500/10',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Palette },
  { id: 'interior', label: 'Interior', icon: Home },
  { id: 'exterior', label: 'Exterior', icon: TreePine },
];

const MOODS = ['cinematic', 'dramatic', 'peaceful', 'mysterious', 'professional', 'inspiring', 'intimate', 'contemplative'];

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(color);
    setCopied(true);
    toast.success('Color copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="group flex flex-col items-center gap-1.5 transition-transform hover:scale-105"
    >
      <div 
        className="w-12 h-12 rounded-xl shadow-lg border border-white/10 transition-all group-hover:shadow-xl group-hover:scale-110"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-white/40 capitalize font-medium">{label}</span>
      {copied && <Check className="w-3 h-3 text-emerald-400 absolute -top-1 -right-1" />}
    </button>
  );
}

function EnvironmentCard({ 
  environment,
  onApply,
  onPreview,
  index = 0,
}: { 
  environment: typeof ENVIRONMENT_PRESETS[0];
  onApply: () => void;
  onPreview: () => void;
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = environment.icon;
  
  const getLightingBadge = () => {
    const { timeOfDay } = environment.lighting;
    const badges: Record<string, { icon: typeof Sun; label: string }> = {
      golden_hour: { icon: Sunrise, label: 'Golden Hour' },
      night: { icon: Moon, label: 'Night' },
      midday: { icon: Sun, label: 'Midday' },
      dawn: { icon: Sunrise, label: 'Dawn' },
      afternoon: { icon: CloudSun, label: 'Afternoon' },
      evening: { icon: Moon, label: 'Evening' },
      overcast: { icon: CloudSun, label: 'Overcast' },
      controlled: { icon: Lightbulb, label: 'Studio' },
    };
    return badges[timeOfDay] || { icon: Sun, label: timeOfDay };
  };
  
  const lightingInfo = getLightingBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={cn(
        "group relative overflow-hidden transition-all duration-500 cursor-pointer border-0",
        "bg-white/[0.03] hover:bg-white/[0.06]",
        "hover:shadow-2xl hover:shadow-white/5"
      )}>
        {/* Visual Header with gradient from color palette */}
        <div 
          className={cn(
            "relative h-36 overflow-hidden bg-gradient-to-br",
            environment.gradient
          )}
        >
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 30% 70%, ${environment.colorPalette.accent}40 0%, transparent 50%)`,
            }} />
          </div>
          
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className={cn(
                "w-18 h-18 rounded-2xl flex items-center justify-center",
                "bg-white/10 backdrop-blur-sm border border-white/20"
              )}
              animate={{ scale: isHovered ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Icon className="w-9 h-9 text-white/80" />
            </motion.div>
          </div>
          
          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <Badge className="bg-black/40 backdrop-blur-sm text-white/90 border-0 capitalize">
              {environment.category}
            </Badge>
          </div>
          
          {/* Lighting badge */}
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-black/40 backdrop-blur-sm border-white/20 text-white/80 gap-1">
              <lightingInfo.icon className="w-3 h-3" />
              {lightingInfo.label}
            </Badge>
          </div>
          
          {/* Quick actions on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3"
              >
                <Button size="sm" variant="outline" onClick={onPreview} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Eye className="w-4 h-4 mr-1.5" />
                  Preview
                </Button>
                <Button size="sm" onClick={onApply} className="bg-white text-black hover:bg-white/90">
                  <Check className="w-4 h-4 mr-1.5" />
                  Apply
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-white text-lg">
              {environment.name}
            </h3>
          </div>
          
          <p className="text-sm text-white/50 line-clamp-2 mb-4 min-h-[40px]">
            {environment.description}
          </p>
          
          {/* Color Palette Preview */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-white/30 font-medium">Palette:</span>
            <div className="flex gap-1.5">
              {Object.entries(environment.colorPalette).map(([key, color]) => (
                <div
                  key={key}
                  className="w-6 h-6 rounded-lg shadow-md border border-white/10"
                  style={{ backgroundColor: color }}
                  title={`${key}: ${color}`}
                />
              ))}
            </div>
          </div>
          
          {/* Lighting info */}
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full capitalize">
              <Lightbulb className="w-3.5 h-3.5" />
              {environment.lighting.type}
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full capitalize">
              <Camera className="w-3.5 h-3.5" />
              {environment.lighting.direction}
            </span>
            <Badge variant="outline" className="border-white/10 text-white/50 capitalize ml-auto">
              {environment.mood}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Environments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<typeof ENVIRONMENT_PRESETS[0] | null>(null);

  const filteredEnvironments = ENVIRONMENT_PRESETS.filter(env => {
    const matchesSearch = !searchQuery || 
      env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      env.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || env.category === activeCategory;
    const matchesMood = !activeMood || env.mood === activeMood;
    
    return matchesSearch && matchesCategory && matchesMood;
  });

  const handleApplyEnvironment = (environment: typeof ENVIRONMENT_PRESETS[0]) => {
    navigate(`/create?environment=${environment.id}`);
    toast.success(`Applied "${environment.name}" environment`);
  };

  const handlePreviewEnvironment = (environment: typeof ENVIRONMENT_PRESETS[0]) => {
    setSelectedEnvironment(environment);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-emerald-500/[0.03] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-tl from-cyan-500/[0.02] to-transparent blur-[180px]" />
      </div>
      
      <AppHeader showCreate={false} />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 mb-8 shadow-2xl shadow-emerald-500/20">
            <Palette className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-4">
            Environment DNA
          </h1>
          <p className="text-xl text-white/50 max-w-2xl mx-auto">
            Craft your visual atmosphere with lighting, color palettes, and mood settings
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          className="flex flex-col gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                placeholder="Search environments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 rounded-xl"
              />
            </div>
            
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                    activeCategory === cat.id
                      ? "bg-white text-black"
                      : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Mood filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-white/40 font-medium">Mood:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveMood(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeMood === null
                    ? "bg-white text-black"
                    : "bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                All
              </button>
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  onClick={() => setActiveMood(mood === activeMood ? null : mood)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
                    activeMood === mood
                      ? "bg-white text-black"
                      : "bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white"
                  )}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Environment Grid */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                <Layers className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {activeCategory === 'all' ? 'All Environments' : CATEGORIES.find(c => c.id === activeCategory)?.label}
                </h2>
                <p className="text-white/40 text-sm">{filteredEnvironments.length} environments available</p>
              </div>
            </div>
          </div>

          {filteredEnvironments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-6">
                <Palette className="w-10 h-10 text-white/20" />
              </div>
              <h3 className="font-semibold text-white text-xl mb-2">No environments found</h3>
              <p className="text-white/40 max-w-sm">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEnvironments.map((environment, index) => (
                <EnvironmentCard 
                  key={environment.id}
                  environment={environment}
                  onApply={() => handleApplyEnvironment(environment)}
                  onPreview={() => handlePreviewEnvironment(environment)}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>

        {/* Create Custom CTA */}
        <motion.section 
          className="mt-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-br from-white/[0.05] to-white/[0.02] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
            <CardContent className="relative py-12 px-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Build Your Own Environment
              </h3>
              <p className="text-white/50 mb-8 max-w-md mx-auto">
                Mix and match lighting, colors, and atmosphere settings to create your unique visual style
              </p>
              <Button 
                onClick={() => navigate('/create')} 
                size="lg"
                className="bg-white text-black hover:bg-white/90 shadow-xl h-12 px-8"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create Custom Environment
              </Button>
            </CardContent>
          </Card>
        </motion.section>
      </main>

      {/* Environment Preview Modal */}
      <AnimatePresence>
        {selectedEnvironment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedEnvironment(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview header with gradient */}
              <div 
                className={cn(
                  "h-56 relative bg-gradient-to-br",
                  selectedEnvironment.gradient
                )}
              >
                <button
                  onClick={() => setSelectedEnvironment(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center">
                  <selectedEnvironment.icon className="w-24 h-24 text-white/60" />
                </div>
              </div>
              
              <div className="p-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {selectedEnvironment.name}
                </h2>
                <p className="text-white/50 mb-8 text-lg">
                  {selectedEnvironment.description}
                </p>
                
                {/* Color palette */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wider">Color Palette</h3>
                  <div className="flex gap-6">
                    {Object.entries(selectedEnvironment.colorPalette).map(([key, color]) => (
                      <ColorSwatch key={key} color={color} label={key} />
                    ))}
                  </div>
                </div>
                
                {/* Lighting details */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wider">Lighting Settings</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">Type</p>
                      <p className="text-sm font-medium text-white capitalize">{selectedEnvironment.lighting.type}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">Direction</p>
                      <p className="text-sm font-medium text-white capitalize">{selectedEnvironment.lighting.direction}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">Intensity</p>
                      <p className="text-sm font-medium text-white capitalize">{selectedEnvironment.lighting.intensity}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">Temperature</p>
                      <p className="text-sm font-medium text-white capitalize">{selectedEnvironment.lighting.temperature}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedEnvironment(null)}
                    className="bg-white/[0.05] border-white/[0.1] text-white hover:bg-white/[0.1]"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      handleApplyEnvironment(selectedEnvironment);
                      setSelectedEnvironment(null);
                    }}
                    className="bg-white text-black hover:bg-white/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Apply Environment
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

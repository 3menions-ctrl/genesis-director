import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Palette, Search, Sun, Moon, Sunrise, CloudSun,
  Building, TreePine, Waves, Mountain, Home, Sparkles,
  Loader2, Check, Copy, Eye, Plus, Paintbrush, Lightbulb,
  Camera, Layers, Wand2
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
      primary: 'hsl(35, 85%, 55%)',
      secondary: 'hsl(25, 70%, 45%)',
      accent: 'hsl(45, 90%, 65%)',
      shadows: 'hsl(20, 40%, 25%)',
    },
    mood: 'cinematic',
    icon: Sunrise,
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
      primary: 'hsl(280, 80%, 50%)',
      secondary: 'hsl(190, 85%, 45%)',
      accent: 'hsl(340, 90%, 55%)',
      shadows: 'hsl(240, 30%, 10%)',
    },
    mood: 'dramatic',
    icon: Moon,
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
      primary: 'hsl(195, 75%, 60%)',
      secondary: 'hsl(45, 80%, 70%)',
      accent: 'hsl(150, 50%, 60%)',
      shadows: 'hsl(200, 30%, 35%)',
    },
    mood: 'peaceful',
    icon: Waves,
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
      primary: 'hsl(120, 45%, 35%)',
      secondary: 'hsl(90, 55%, 45%)',
      accent: 'hsl(45, 70%, 55%)',
      shadows: 'hsl(150, 35%, 20%)',
    },
    mood: 'mysterious',
    icon: TreePine,
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
      primary: 'hsl(0, 0%, 95%)',
      secondary: 'hsl(0, 0%, 85%)',
      accent: 'hsl(0, 0%, 15%)',
      shadows: 'hsl(0, 0%, 70%)',
    },
    mood: 'professional',
    icon: Building,
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
      primary: 'hsl(210, 60%, 75%)',
      secondary: 'hsl(35, 70%, 60%)',
      accent: 'hsl(350, 65%, 55%)',
      shadows: 'hsl(220, 40%, 30%)',
    },
    mood: 'inspiring',
    icon: Mountain,
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
      primary: 'hsl(25, 90%, 45%)',
      secondary: 'hsl(15, 85%, 35%)',
      accent: 'hsl(40, 80%, 55%)',
      shadows: 'hsl(10, 50%, 15%)',
    },
    mood: 'intimate',
    icon: Home,
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
      primary: 'hsl(210, 20%, 60%)',
      secondary: 'hsl(200, 15%, 50%)',
      accent: 'hsl(180, 25%, 45%)',
      shadows: 'hsl(220, 25%, 35%)',
    },
    mood: 'contemplative',
    icon: CloudSun,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Environments', icon: Palette },
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
      className="group flex flex-col items-center gap-1 transition-transform hover:scale-105"
    >
      <div 
        className="w-10 h-10 rounded-lg shadow-md border border-border/50 transition-all group-hover:shadow-lg"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-muted-foreground capitalize">{label}</span>
      {copied && <Check className="w-3 h-3 text-success absolute" />}
    </button>
  );
}

function EnvironmentCard({ 
  environment,
  onApply,
  onPreview,
}: { 
  environment: typeof ENVIRONMENT_PRESETS[0];
  onApply: () => void;
  onPreview: () => void;
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
      transition={{ duration: 0.4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="group card-premium overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* Visual Header */}
        <div 
          className="relative h-32 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${environment.colorPalette.primary}, ${environment.colorPalette.secondary})`,
          }}
        >
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 30% 70%, ${environment.colorPalette.accent} 0%, transparent 50%)`,
            }} />
          </div>
          
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
              "bg-white/20 backdrop-blur-sm",
              isHovered && "scale-110"
            )}>
              <Icon className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-white/90 text-foreground shadow-sm">
              {environment.category}
            </Badge>
          </div>
          
          {/* Quick actions */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2"
              >
                <Button size="sm" variant="secondary" onClick={onPreview}>
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button size="sm" onClick={onApply}>
                  <Check className="w-4 h-4 mr-1" />
                  Apply
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-foreground">
              {environment.name}
            </h3>
            <Badge variant="outline" className="shrink-0 text-xs gap-1">
              <lightingInfo.icon className="w-3 h-3" />
              {lightingInfo.label}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {environment.description}
          </p>
          
          {/* Color Palette */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground font-medium">Palette:</span>
            <div className="flex gap-1.5">
              {Object.entries(environment.colorPalette).map(([key, color]) => (
                <div
                  key={key}
                  className="w-5 h-5 rounded shadow-sm border border-border/50"
                  style={{ backgroundColor: color }}
                  title={`${key}: ${color}`}
                />
              ))}
            </div>
          </div>
          
          {/* Lighting info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5" />
              {environment.lighting.type}
            </span>
            <span className="flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              {environment.lighting.direction}
            </span>
            <span className="capitalize">{environment.mood}</span>
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
    // Navigate to create with environment preset
    navigate(`/create?environment=${environment.id}`);
    toast.success(`Applied "${environment.name}" environment`);
  };

  const handlePreviewEnvironment = (environment: typeof ENVIRONMENT_PRESETS[0]) => {
    setSelectedEnvironment(environment);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <AppHeader showCreate={false} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 mb-6 shadow-lg shadow-primary/20">
            <Palette className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
            Environment DNA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Craft your visual atmosphere with lighting, color palettes, and mood settings
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search environments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/80 backdrop-blur-sm border-border/50"
              />
            </div>
            
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="bg-muted/60 backdrop-blur-sm">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                    <cat.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          
          {/* Mood filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground font-medium">Mood:</span>
            <div className="flex gap-1.5 flex-wrap">
              <Badge
                variant={activeMood === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveMood(null)}
              >
                All
              </Badge>
              {MOODS.map((mood) => (
                <Badge
                  key={mood}
                  variant={activeMood === mood ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => setActiveMood(mood === activeMood ? null : mood)}
                >
                  {mood}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Environment Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeCategory === 'all' ? 'All Environments' : CATEGORIES.find(c => c.id === activeCategory)?.label}
              </h2>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {filteredEnvironments.length} environments
            </Badge>
          </div>

          {filteredEnvironments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Palette className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No environments found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEnvironments.map((environment, index) => (
                <motion.div
                  key={environment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <EnvironmentCard 
                    environment={environment}
                    onApply={() => handleApplyEnvironment(environment)}
                    onPreview={() => handlePreviewEnvironment(environment)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Create Custom CTA */}
        <section className="mt-16 text-center">
          <Card className="card-premium p-8 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Build Your Own Environment
              </h3>
              <p className="text-muted-foreground mb-6">
                Mix and match lighting, colors, and atmosphere settings to create your unique visual style
              </p>
              <Button onClick={() => navigate('/create')} size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Environment
              </Button>
            </div>
          </Card>
        </section>
      </main>

      {/* Environment Preview Modal */}
      <AnimatePresence>
        {selectedEnvironment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedEnvironment(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview header with gradient */}
              <div 
                className="h-48 relative"
                style={{
                  background: `linear-gradient(135deg, ${selectedEnvironment.colorPalette.primary}, ${selectedEnvironment.colorPalette.secondary})`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <selectedEnvironment.icon className="w-20 h-20 text-white/80" />
                </div>
              </div>
              
              <div className="p-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {selectedEnvironment.name}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {selectedEnvironment.description}
                </p>
                
                {/* Color palette */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Color Palette</h3>
                  <div className="flex gap-4">
                    {Object.entries(selectedEnvironment.colorPalette).map(([key, color]) => (
                      <ColorSwatch key={key} color={color} label={key} />
                    ))}
                  </div>
                </div>
                
                {/* Lighting details */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Lighting Settings</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium capitalize">{selectedEnvironment.lighting.type}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Direction</p>
                      <p className="text-sm font-medium capitalize">{selectedEnvironment.lighting.direction}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Intensity</p>
                      <p className="text-sm font-medium capitalize">{selectedEnvironment.lighting.intensity}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Temperature</p>
                      <p className="text-sm font-medium capitalize">{selectedEnvironment.lighting.temperature}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setSelectedEnvironment(null)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    handleApplyEnvironment(selectedEnvironment);
                    setSelectedEnvironment(null);
                  }}>
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutTemplate, Search, Play, Clock, Users, Sparkles,
  Film, Megaphone, BookOpen, Smile, Briefcase,
  ArrowRight, Star, X, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  is_public: boolean | null;
  use_count: number | null;
  genre: string | null;
  mood: string | null;
  quality_tier: string | null;
  target_duration_minutes: number | null;
  clip_count: number | null;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Templates', icon: LayoutTemplate },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'commercial', label: 'Commercial', icon: Megaphone },
  { id: 'educational', label: 'Educational', icon: BookOpen },
  { id: 'entertainment', label: 'Entertainment', icon: Smile },
  { id: 'corporate', label: 'Corporate', icon: Briefcase },
];

// Built-in templates with trendy, high-quality visuals
const BUILT_IN_TEMPLATES = [
  {
    id: 'featured-1',
    name: 'Cinematic Product Reveal',
    description: 'Stunning product showcase with dramatic lighting and slow-motion reveals',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=900&fit=crop',
    use_count: 4821,
    target_duration_minutes: 2,
    clip_count: 8,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
  },
  {
    id: 'featured-2',
    name: 'Documentary Story',
    description: 'Authentic storytelling with intimate interviews and cinematic B-roll',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=400&fit=crop',
    use_count: 3247,
    target_duration_minutes: 5,
    clip_count: 12,
    mood: 'emotional',
    genre: 'documentary',
    is_featured: true,
  },
  {
    id: 'featured-3',
    name: 'Viral Social Content',
    description: 'Hook-driven content engineered for maximum engagement on TikTok & Reels',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=600&fit=crop',
    use_count: 8934,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: true,
  },
  {
    id: 'template-edu-1',
    name: 'Educational Breakdown',
    description: 'Visual explainers that make complex topics simple and engaging',
    category: 'educational',
    thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=800&fit=crop',
    use_count: 2156,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'educational',
    is_featured: false,
  },
  {
    id: 'template-story-1',
    name: 'Short Film',
    description: 'Narrative-driven cinema with emotional arcs and compelling characters',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=600&h=450&fit=crop',
    use_count: 1892,
    target_duration_minutes: 4,
    clip_count: 10,
    mood: 'emotional',
    genre: 'storytelling',
    is_featured: false,
  },
  {
    id: 'template-noir-1',
    name: 'Neo-Noir Thriller',
    description: 'Moody atmospherics with neon-lit shadows and tension-building sequences',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=700&fit=crop',
    use_count: 1478,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'mysterious',
    genre: 'cinematic',
    is_featured: false,
  },
  {
    id: 'template-action-1',
    name: 'Action Montage',
    description: 'High-octane sequences with dynamic movement and adrenaline-pumping cuts',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&h=400&fit=crop',
    use_count: 2756,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'action',
    genre: 'cinematic',
    is_featured: false,
  },
  {
    id: 'template-corp-1',
    name: 'Brand Story',
    description: 'Premium corporate narratives that humanize your brand identity',
    category: 'corporate',
    thumbnail_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=500&fit=crop',
    use_count: 3421,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'corporate',
    is_featured: false,
  },
  {
    id: 'template-travel-1',
    name: 'Travel Vlog',
    description: 'Wanderlust-inducing journeys with stunning landscapes and authentic moments',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=700&fit=crop',
    use_count: 5123,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: false,
  },
  {
    id: 'template-music-1',
    name: 'Music Video',
    description: 'Rhythm-synced visuals with artistic flair and bold creative direction',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
    use_count: 4267,
    target_duration_minutes: 4,
    clip_count: 10,
    mood: 'epic',
    genre: 'cinematic',
    is_featured: false,
  },
  {
    id: 'template-food-1',
    name: 'Food & Lifestyle',
    description: 'Appetizing food cinematography with warm, inviting aesthetics',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop',
    use_count: 3892,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'ad',
    is_featured: false,
  },
  {
    id: 'template-tech-1',
    name: 'Tech Showcase',
    description: 'Sleek product demos with futuristic visuals and clean transitions',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=800&fit=crop',
    use_count: 2934,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'epic',
    genre: 'ad',
    is_featured: false,
  },
];

type TemplateItem = typeof BUILT_IN_TEMPLATES[0];

function TemplateCard({ 
  template,
  onUse,
  index = 0,
}: { 
  template: TemplateItem;
  onUse: () => void;
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
        {template.thumbnail_url ? (
          <img 
            src={template.thumbnail_url} 
            alt={template.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-700",
              isHovered ? "scale-110" : "scale-100"
            )}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/20" />
        )}
        
        {/* Subtle gradient overlay always visible at bottom */}
        <div className={cn(
          "absolute inset-0 transition-all duration-500",
          isHovered 
            ? "bg-gradient-to-t from-black/80 via-black/40 to-black/10" 
            : "bg-gradient-to-t from-black/60 via-transparent to-transparent"
        )} />

        {/* Featured Badge */}
        {template.is_featured && (
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-white text-foreground border-0 shadow-lg text-xs font-semibold">
              <Star className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          </div>
        )}

        {/* Title - Always visible at bottom */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-5 transition-all duration-500",
          isHovered ? "translate-y-[-80px]" : "translate-y-0"
        )}>
          <h3 className="text-xl font-semibold text-white mb-1 drop-shadow-lg">
            {template.name}
          </h3>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 text-xs capitalize">
              {template.category}
            </Badge>
            <Badge variant="outline" className="bg-white/10 backdrop-blur-sm border-white/30 text-white/90 text-xs capitalize">
              {template.mood}
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
                {template.description || 'No description available'}
              </p>
              
              {/* Stats */}
              <div className="flex items-center gap-2 mb-4">
                {template.clip_count && (
                  <div className="flex items-center gap-1 text-xs text-white/60 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Film className="w-3 h-3" />
                    {template.clip_count} clips
                  </div>
                )}
                {template.target_duration_minutes && (
                  <div className="flex items-center gap-1 text-xs text-white/60 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {template.target_duration_minutes}m
                  </div>
                )}
                {template.use_count && template.use_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-white/60 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Users className="w-3 h-3" />
                    {template.use_count.toLocaleString()}
                  </div>
                )}
              </div>
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onUse();
                }}
                className="w-full bg-white text-foreground hover:bg-white/90 rounded-xl h-11 font-medium shadow-lg"
              >
                Use Template
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
                onUse();
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-white transition-colors"
            >
              <Play className="w-5 h-5 text-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .eq('is_public', true)
        .order('use_count', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Combine DB templates with built-in templates
  const allTemplates: TemplateItem[] = [...BUILT_IN_TEMPLATES, ...templates.map((t) => ({
    ...t,
    is_featured: false,
  }))];

  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.mood?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: TemplateItem) => {
    navigate(`/create?template=${template.id}`);
    toast.success(`Using "${template.name}" template`);
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
            <LayoutTemplate className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Template Library
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start with a professionally crafted template and customize it to match your vision
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
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-card border-border rounded-xl"
            />
          </div>
          
          {/* Category Filters */}
          <div className="flex gap-2 flex-wrap">
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
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
        </motion.div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template)}
              index={index}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <motion.div 
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No templates found</h3>
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

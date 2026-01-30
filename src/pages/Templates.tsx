import { useState, useEffect, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutTemplate, Search, Play, Clock, Users, Sparkles,
  Film, Megaphone, BookOpen, Smile, Briefcase, TrendingUp,
  ArrowRight, Star, Flame, Zap, Heart, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import TemplatesBackground from '@/components/templates/TemplatesBackground';
import { ErrorBoundary } from '@/components/ui/error-boundary';

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
  { id: 'all', label: 'All', icon: LayoutTemplate },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'commercial', label: 'Commercial', icon: Megaphone },
  { id: 'educational', label: 'Educational', icon: BookOpen },
  { id: 'entertainment', label: 'Entertainment', icon: Smile },
  { id: 'corporate', label: 'Corporate', icon: Briefcase },
];

// Trendy, viral-ready templates based on what people love making
const BUILT_IN_TEMPLATES = [
  // 🔥 TRENDING - Viral & Social
  {
    id: 'viral-hook',
    name: 'Viral Hook Opener',
    description: 'Stop-the-scroll hooks that capture attention in 0.5 seconds',
    category: 'trending',
    thumbnail_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=900&fit=crop',
    use_count: 24500,
    target_duration_minutes: 1,
    clip_count: 4,
    mood: 'action',
    genre: 'vlog',
    is_featured: true,
    is_trending: true,
  },
  {
    id: 'aesthetic-vlog',
    name: 'Aesthetic Day-in-Life',
    description: 'Dreamy, soft-lit vlogs with that perfect cozy aesthetic',
    category: 'trending',
    thumbnail_url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=900&fit=crop',
    use_count: 18900,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'peaceful',
    genre: 'vlog',
    is_featured: true,
    is_trending: true,
  },
  {
    id: 'transformation',
    name: 'Glow-Up Transformation',
    description: 'Dramatic before/after reveals with cinematic transitions',
    category: 'trending',
    thumbnail_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=900&fit=crop',
    use_count: 15200,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: true,
    is_trending: true,
  },
  {
    id: 'asmr-satisfying',
    name: 'Satisfying ASMR',
    description: 'Oddly satisfying visuals with calming, hypnotic sequences',
    category: 'trending',
    thumbnail_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=900&fit=crop',
    use_count: 21300,
    target_duration_minutes: 1,
    clip_count: 6,
    mood: 'peaceful',
    genre: 'ad',
    is_trending: true,
  },
  {
    id: 'storytime',
    name: 'Storytime Drama',
    description: 'Captivating personal stories with dramatic pauses and reveals',
    category: 'trending',
    thumbnail_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=900&fit=crop',
    use_count: 12800,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'emotional',
    genre: 'storytelling',
    is_trending: true,
  },
  // 🎬 CINEMATIC
  {
    id: 'featured-2',
    name: 'Documentary Story',
    description: 'Authentic storytelling with intimate interviews and cinematic B-roll',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=900&fit=crop',
    use_count: 8200,
    target_duration_minutes: 5,
    clip_count: 12,
    mood: 'emotional',
    genre: 'documentary',
    is_featured: true,
  },
  {
    id: 'template-noir-1',
    name: 'Neo-Noir Thriller',
    description: 'Moody atmospherics with neon-lit shadows and tension',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=900&fit=crop',
    use_count: 6400,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'mysterious',
    genre: 'cinematic',
  },
  {
    id: 'template-action-1',
    name: 'Action Montage',
    description: 'High-octane sequences with adrenaline-pumping cuts',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&h=900&fit=crop',
    use_count: 7800,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'action',
    genre: 'cinematic',
  },
  {
    id: 'anime-style',
    name: 'Anime-Inspired',
    description: 'Dynamic anime-style cuts with bold visuals and energy',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=900&fit=crop',
    use_count: 11200,
    target_duration_minutes: 2,
    clip_count: 8,
    mood: 'epic',
    genre: 'cinematic',
    is_trending: true,
  },
  // 📺 COMMERCIAL
  {
    id: 'featured-1',
    name: 'Product Reveal',
    description: 'Stunning product showcase with dramatic lighting',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=900&fit=crop',
    use_count: 9500,
    target_duration_minutes: 2,
    clip_count: 8,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
  },
  {
    id: 'template-food-1',
    name: 'Food & Lifestyle',
    description: 'Mouthwatering food cinematography',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=900&fit=crop',
    use_count: 8900,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'ad',
  },
  {
    id: 'template-tech-1',
    name: 'Tech Showcase',
    description: 'Sleek product demos with futuristic visuals',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=900&fit=crop',
    use_count: 7200,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'epic',
    genre: 'ad',
  },
  {
    id: 'ugc-testimonial',
    name: 'UGC Testimonial',
    description: 'Authentic user-generated style testimonials',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=900&fit=crop',
    use_count: 13400,
    target_duration_minutes: 1,
    clip_count: 4,
    mood: 'uplifting',
    genre: 'ad',
    is_trending: true,
  },
  // 📚 EDUCATIONAL
  {
    id: 'template-edu-1',
    name: 'Educational Breakdown',
    description: 'Visual explainers that make complex topics simple',
    category: 'educational',
    thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=900&fit=crop',
    use_count: 5600,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'how-to-tutorial',
    name: 'Step-by-Step Tutorial',
    description: 'Clear, engaging how-to guides with visual steps',
    category: 'educational',
    thumbnail_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=900&fit=crop',
    use_count: 8100,
    target_duration_minutes: 3,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'educational',
  },
  // 🎉 ENTERTAINMENT
  {
    id: 'featured-3',
    name: 'Viral Social Content',
    description: 'Hook-driven content for TikTok & Reels',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=900&fit=crop',
    use_count: 16800,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: true,
  },
  {
    id: 'template-travel-1',
    name: 'Travel Vlog',
    description: 'Wanderlust-inducing journeys with stunning landscapes',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=900&fit=crop',
    use_count: 11200,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'vlog',
  },
  {
    id: 'template-music-1',
    name: 'Music Video',
    description: 'Rhythm-synced visuals with artistic flair',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=900&fit=crop',
    use_count: 9400,
    target_duration_minutes: 4,
    clip_count: 10,
    mood: 'epic',
    genre: 'cinematic',
  },
  {
    id: 'podcast-clips',
    name: 'Podcast Clips',
    description: 'Engaging podcast highlights with captions',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&h=900&fit=crop',
    use_count: 7600,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'uplifting',
    genre: 'educational',
  },
  // 💼 CORPORATE
  {
    id: 'template-corp-1',
    name: 'Brand Story',
    description: 'Premium corporate narratives that humanize brands',
    category: 'corporate',
    thumbnail_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=900&fit=crop',
    use_count: 6800,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'corporate',
  },
  {
    id: 'team-intro',
    name: 'Team Introduction',
    description: 'Professional team showcases with personality',
    category: 'corporate',
    thumbnail_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=900&fit=crop',
    use_count: 4200,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'corporate',
  },
];

type TemplateItem = typeof BUILT_IN_TEMPLATES[0];

// Wrap TemplateCard with forwardRef for Framer Motion compatibility
const TemplateCard = forwardRef<HTMLDivElement, { 
  template: TemplateItem;
  onUse: () => void;
  index?: number;
}>(function TemplateCard({ 
  template,
  onUse,
  index = 0,
}, ref) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onUse}
      className="group relative cursor-pointer"
    >
      {/* Compact Card */}
      <div className={cn(
        "relative aspect-[3/4] rounded-xl overflow-hidden",
        "bg-zinc-900 transition-all duration-300",
        "ring-1 ring-white/10 hover:ring-white/20",
        isHovered && "shadow-xl shadow-black/50"
      )}>
        {/* Image */}
        {template.thumbnail_url && (
          <img 
            src={template.thumbnail_url} 
            alt={template.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform duration-500",
              isHovered ? "scale-105" : "scale-100"
            )}
          />
        )}
        
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300",
          isHovered 
            ? "bg-gradient-to-t from-black/90 via-black/50 to-black/20" 
            : "bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        )} />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          <div className="flex gap-1.5">
            {template.is_trending && (
              <Badge className="bg-orange-500 text-white border-0 text-[10px] px-1.5 py-0.5 font-semibold">
                <Flame className="w-2.5 h-2.5 mr-0.5" />
                Hot
              </Badge>
            )}
            {template.is_featured && !template.is_trending && (
              <Badge className="bg-amber-500 text-black border-0 text-[10px] px-1.5 py-0.5 font-semibold">
                <Star className="w-2.5 h-2.5 mr-0.5" />
                Featured
              </Badge>
            )}
          </div>
          
          {/* Quick Use Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              onUse();
            }}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg"
          >
            <Play className="w-4 h-4 text-black ml-0.5" />
          </motion.button>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
            {template.name}
          </h3>
          
          <p className={cn(
            "text-xs text-white/60 line-clamp-1 transition-all duration-300 mb-2",
            isHovered ? "opacity-100" : "opacity-0 h-0 mb-0"
          )}>
            {template.description}
          </p>
          
          {/* Stats Row */}
          <div className="flex items-center gap-2 text-[10px] text-white/50">
            <span className="flex items-center gap-0.5">
              <Film className="w-3 h-3" />
              {template.clip_count}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {template.target_duration_minutes}m
            </span>
            {template.use_count && template.use_count > 1000 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {(template.use_count / 1000).toFixed(1)}k
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

TemplateCard.displayName = 'TemplateCard';

// Main content component separated for error boundary
const TemplatesContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function TemplatesContent(_, ref) {
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
    is_trending: false,
  }))];

  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.mood?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    // "Trending" shows all templates with is_trending flag
    if (activeCategory === 'trending') {
      matchesCategory = template.is_trending === true;
    }
    
    return matchesSearch && matchesCategory;
  });

  // Sort: trending first, then featured, then by use count
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.is_trending && !b.is_trending) return -1;
    if (!a.is_trending && b.is_trending) return 1;
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (b.use_count || 0) - (a.use_count || 0);
  });

  const handleUseTemplate = (template: TemplateItem) => {
    navigate(`/create?template=${template.id}`);
    toast.success(`Using "${template.name}" template`);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      <TemplatesBackground />
      <AppHeader showCreate={false} />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Templates</h1>
            <p className="text-sm text-white/50">
              {sortedTemplates.length} professional templates
            </p>
          </div>
          
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Category Pills - Scrollable */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeCategory === cat.id
                  ? "bg-violet-500 text-white"
                  : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white border border-white/[0.1]"
              )}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates Grid - Compact 5-column */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sortedTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template)}
              index={index}
            />
          ))}
        </div>

        {/* Empty State */}
        {sortedTemplates.length === 0 && (
          <motion.div 
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-white/40" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
            <p className="text-sm text-white/50 mb-4">
              Try adjusting your search or filter
            </p>
            <Button 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
            >
              Clear filters
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}));

// Wrapper with error boundary for fault isolation
export default function Templates() {
  return (
    <ErrorBoundary>
      <TemplatesContent />
    </ErrorBoundary>
  );
}

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
  Loader2, ArrowRight, Star, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'commercial', label: 'Commercial', icon: Megaphone },
  { id: 'educational', label: 'Educational', icon: BookOpen },
  { id: 'entertainment', label: 'Entertainment', icon: Smile },
  { id: 'corporate', label: 'Corporate', icon: Briefcase },
];

// Built-in featured templates with varying heights for masonry
const BUILT_IN_TEMPLATES = [
  {
    id: 'featured-1',
    name: 'Epic Product Launch',
    description: 'Dramatic reveal sequence with cinematic transitions and impactful music cues',
    category: 'commercial',
    thumbnail_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&h=900&fit=crop',
    use_count: 2847,
    target_duration_minutes: 2,
    clip_count: 8,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
    height: 'tall',
  },
  {
    id: 'featured-2',
    name: 'Documentary Storyteller',
    description: 'Professional documentary style with interview segments and B-roll integration',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&h=400&fit=crop',
    use_count: 1923,
    target_duration_minutes: 5,
    clip_count: 12,
    mood: 'emotional',
    genre: 'documentary',
    is_featured: true,
    height: 'medium',
  },
  {
    id: 'featured-3',
    name: 'Social Media Series',
    description: 'Fast-paced, engaging content optimized for TikTok and Instagram Reels',
    category: 'entertainment',
    thumbnail_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=600&fit=crop',
    use_count: 4521,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: true,
    height: 'short',
  },
  {
    id: 'template-edu-1',
    name: 'Educational Explainer',
    description: 'Clear, engaging educational content with visual demonstrations',
    category: 'educational',
    thumbnail_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=800&fit=crop',
    use_count: 1250,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'educational',
    is_featured: false,
    height: 'tall',
  },
  {
    id: 'template-story-1',
    name: 'Short Film Drama',
    description: 'Cinematic narrative with emotional depth and character development',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&h=450&fit=crop',
    use_count: 892,
    target_duration_minutes: 4,
    clip_count: 10,
    mood: 'emotional',
    genre: 'storytelling',
    is_featured: false,
    height: 'medium',
  },
  {
    id: 'template-noir-1',
    name: 'Noir Mystery',
    description: 'Atmospheric noir thriller with high contrast and moody lighting',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=700&fit=crop',
    use_count: 678,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'mysterious',
    genre: 'cinematic',
    is_featured: false,
    height: 'tall',
  },
  {
    id: 'template-action-1',
    name: 'Action Sequence',
    description: 'High-energy action scenes with dynamic camera movements',
    category: 'cinematic',
    thumbnail_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&h=400&fit=crop',
    use_count: 1456,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'action',
    genre: 'cinematic',
    is_featured: false,
    height: 'short',
  },
  {
    id: 'template-corp-1',
    name: 'Corporate Presentation',
    description: 'Professional business videos with clean, modern aesthetics',
    category: 'corporate',
    thumbnail_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=500&fit=crop',
    use_count: 2100,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'corporate',
    is_featured: false,
    height: 'medium',
  },
];

function MasonryCard({ 
  template, 
  onUse, 
  isFeatured = false,
}: { 
  template: typeof BUILT_IN_TEMPLATES[0]; 
  onUse: () => void;
  isFeatured?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  
  const showContent = isHovered || isPressed;
  
  const getHeightClass = () => {
    switch(template.height) {
      case 'tall': return 'row-span-2';
      case 'short': return 'row-span-1';
      default: return 'row-span-1';
    }
  };

  return (
    <motion.div
      className={cn("relative group cursor-pointer", getHeightClass())}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onClick={() => setIsPressed(!isPressed)}
      onDoubleClick={onUse}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Card Container */}
      <div className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
        "border border-white/[0.08] hover:border-white/20",
        "transition-all duration-500",
        showContent && "border-white/30 shadow-2xl shadow-violet-500/20"
      )}>
        {/* Background Image */}
        {template.thumbnail_url ? (
          <div className="absolute inset-0">
            <img 
              src={template.thumbnail_url} 
              alt={template.name}
              className={cn(
                "w-full h-full object-cover transition-all duration-700",
                showContent ? "scale-110 blur-sm" : "scale-100"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-500",
              showContent 
                ? "bg-gradient-to-t from-black via-black/80 to-black/40" 
                : "bg-gradient-to-t from-black/60 via-transparent to-transparent"
            )} />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-fuchsia-500/20" />
        )}

        {/* Featured Badge - Always visible */}
        {isFeatured && (
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg backdrop-blur-sm">
              <Star className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          </div>
        )}

        {/* Content Overlay - Only visible on hover/click */}
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex flex-col justify-end p-5"
            >
              {/* Title */}
              <motion.h3 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="text-xl font-bold text-white mb-2 drop-shadow-lg"
              >
                {template.name}
              </motion.h3>
              
              {/* Description */}
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="text-sm text-white/70 line-clamp-2 mb-4"
              >
                {template.description || 'No description available'}
              </motion.p>
              
              {/* Stats */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="flex items-center gap-3 text-xs text-white/50 mb-4"
              >
                {template.clip_count && (
                  <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Film className="w-3 h-3" />
                    {template.clip_count} clips
                  </span>
                )}
                {template.target_duration_minutes && (
                  <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {template.target_duration_minutes}m
                  </span>
                )}
                {template.use_count && template.use_count > 0 && (
                  <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Users className="w-3 h-3" />
                    {template.use_count.toLocaleString()}
                  </span>
                )}
              </motion.div>
              
              {/* Action Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Button 
                  onClick={(e) => { e.stopPropagation(); onUse(); }}
                  className="w-full bg-white text-black hover:bg-white/90 shadow-xl font-semibold"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Use Template
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mood Badge - Bottom right, always visible but subtle */}
        <div className={cn(
          "absolute bottom-4 right-4 z-5 transition-all duration-300",
          showContent ? "opacity-0" : "opacity-100"
        )}>
          <Badge variant="outline" className="bg-black/40 backdrop-blur-md border-white/20 text-white/80 text-xs">
            {template.mood}
          </Badge>
        </div>
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
  const allTemplates = [...BUILT_IN_TEMPLATES, ...templates.map((t, idx) => ({
    ...t,
    is_featured: false,
    height: ['tall', 'medium', 'short'][idx % 3] as 'tall' | 'medium' | 'short',
  }))];

  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (templateId: string) => {
    navigate(`/create?template=${templateId}`);
  };

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-violet-500/[0.08] via-purple-500/[0.04] to-transparent blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-fuchsia-500/[0.06] via-pink-500/[0.03] to-transparent blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-gradient-to-bl from-cyan-500/[0.04] to-transparent blur-[80px]" />
        
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
      </div>
      
      <AppHeader showCreate={false} />
      
      <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Minimal Hero */}
        <motion.div 
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2">
            Templates
          </h1>
          <p className="text-lg text-white/40">
            Hover or tap to explore
          </p>
        </motion.div>

        {/* Search and Filters - Floating style */}
        <motion.div 
          className="sticky top-20 z-40 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.08]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 bg-white/[0.05] border-0 text-white placeholder:text-white/30 focus:ring-1 focus:ring-white/20 rounded-xl"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                    activeCategory === cat.id
                      ? "bg-white text-black shadow-lg"
                      : "text-white/50 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Masonry Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full" />
                <Loader2 className="relative w-10 h-10 animate-spin text-white/60" />
              </div>
              <p className="text-white/40">Loading templates...</p>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-3xl bg-white/[0.03] flex items-center justify-center mb-6 border border-white/[0.08]">
              <LayoutTemplate className="w-12 h-12 text-white/20" />
            </div>
            <h3 className="font-semibold text-white text-xl mb-2">No templates found</h3>
            <p className="text-white/40 max-w-sm">
              {searchQuery 
                ? 'Try adjusting your search or filters'
                : 'More templates coming soon'}
            </p>
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <MasonryCard 
                  template={template}
                  onUse={() => handleUseTemplate(template.id)}
                  isFeatured={template.is_featured}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Floating CTA */}
        <motion.div 
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <Button 
              onClick={() => navigate('/create')} 
              size="lg"
              className="relative bg-black text-white hover:bg-black/90 shadow-2xl h-14 px-8 rounded-2xl border border-white/20 font-semibold"
            >
              <Zap className="w-5 h-5 mr-2" />
              Create from Scratch
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>

        {/* Bottom spacing for floating CTA */}
        <div className="h-32" />
      </main>
    </div>
  );
}

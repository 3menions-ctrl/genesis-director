import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  LayoutTemplate, Search, Play, Clock, Users, Sparkles,
  Film, Megaphone, BookOpen, Smile, Briefcase,
  Loader2, ArrowRight, Star, TrendingUp, Zap
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

// Built-in featured templates (always available)
const BUILT_IN_TEMPLATES = [
  {
    id: 'featured-1',
    name: 'Epic Product Launch',
    description: 'Dramatic reveal sequence with cinematic transitions and impactful music cues',
    category: 'commercial',
    thumbnail_url: null,
    use_count: 2847,
    target_duration_minutes: 2,
    clip_count: 8,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
    gradient: 'from-violet-500/20 via-fuchsia-500/20 to-pink-500/20',
  },
  {
    id: 'featured-2',
    name: 'Documentary Storyteller',
    description: 'Professional documentary style with interview segments and B-roll integration',
    category: 'cinematic',
    thumbnail_url: null,
    use_count: 1923,
    target_duration_minutes: 5,
    clip_count: 12,
    mood: 'emotional',
    genre: 'documentary',
    is_featured: true,
    gradient: 'from-amber-500/20 via-orange-500/20 to-red-500/20',
  },
  {
    id: 'featured-3',
    name: 'Social Media Series',
    description: 'Fast-paced, engaging content optimized for TikTok and Instagram Reels',
    category: 'entertainment',
    thumbnail_url: null,
    use_count: 4521,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'vlog',
    is_featured: true,
    gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
  },
  {
    id: 'template-edu-1',
    name: 'Educational Explainer',
    description: 'Clear, engaging educational content with visual demonstrations',
    category: 'educational',
    thumbnail_url: null,
    use_count: 1250,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'uplifting',
    genre: 'educational',
    is_featured: false,
    gradient: 'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
  },
  {
    id: 'template-story-1',
    name: 'Short Film Drama',
    description: 'Cinematic narrative with emotional depth and character development',
    category: 'cinematic',
    thumbnail_url: null,
    use_count: 892,
    target_duration_minutes: 4,
    clip_count: 10,
    mood: 'emotional',
    genre: 'storytelling',
    is_featured: false,
    gradient: 'from-rose-500/20 via-pink-500/20 to-fuchsia-500/20',
  },
  {
    id: 'template-noir-1',
    name: 'Noir Mystery',
    description: 'Atmospheric noir thriller with high contrast and moody lighting',
    category: 'cinematic',
    thumbnail_url: null,
    use_count: 678,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'mysterious',
    genre: 'cinematic',
    is_featured: false,
    gradient: 'from-slate-500/20 via-gray-500/20 to-zinc-500/20',
  },
];

function TemplateCard({ 
  template, 
  onUse, 
  isFeatured = false,
  index = 0,
}: { 
  template: typeof BUILT_IN_TEMPLATES[0]; 
  onUse: () => void;
  isFeatured?: boolean;
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const getCategoryIcon = (category: string | null) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.icon || LayoutTemplate;
  };
  
  const CategoryIcon = getCategoryIcon(template.category);

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
        "hover:shadow-2xl hover:shadow-white/5",
        isFeatured && "ring-1 ring-white/10"
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          template.gradient || 'from-violet-500/10 to-transparent'
        )} />
        
        {/* Content */}
        <div className="relative">
          {/* Visual Header */}
          <div className={cn(
            "relative h-40 overflow-hidden bg-gradient-to-br",
            template.gradient || 'from-white/[0.05] to-white/[0.02]'
          )}>
            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center",
                  "bg-white/10 backdrop-blur-sm border border-white/10"
                )}
                animate={{ scale: isHovered ? 1.1 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <CategoryIcon className="w-10 h-10 text-white/60" />
              </motion.div>
            </div>
            
            {/* Featured badge */}
            {isFeatured && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              </div>
            )}
            
            {/* Mood badge */}
            <div className="absolute top-4 right-4">
              <Badge variant="outline" className="bg-black/40 backdrop-blur-sm border-white/20 text-white/80">
                {template.mood}
              </Badge>
            </div>
            
            {/* Hover overlay with action */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                >
                  <Button 
                    onClick={onUse}
                    className="bg-white text-black hover:bg-white/90 shadow-xl"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Use Template
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-white line-clamp-1 text-lg">
                {template.name}
              </h3>
            </div>
            
            <p className="text-sm text-white/50 line-clamp-2 mb-4 min-h-[40px]">
              {template.description || 'No description available'}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-white/40">
              {template.clip_count && (
                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full">
                  <Film className="w-3.5 h-3.5" />
                  {template.clip_count} clips
                </span>
              )}
              {template.target_duration_minutes && (
                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  {template.target_duration_minutes} min
                </span>
              )}
              {template.use_count && template.use_count > 0 && (
                <span className="flex items-center gap-1.5 ml-auto">
                  <Users className="w-3.5 h-3.5" />
                  {template.use_count.toLocaleString()}
                </span>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
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
  const allTemplates = [...BUILT_IN_TEMPLATES, ...templates.map(t => ({
    ...t,
    is_featured: false,
    gradient: 'from-white/[0.05] to-white/[0.02]',
  }))];

  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const featuredTemplates = filteredTemplates.filter(t => t.is_featured);
  const regularTemplates = filteredTemplates.filter(t => !t.is_featured);

  const handleUseTemplate = (templateId: string) => {
    navigate(`/create?template=${templateId}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-violet-500/[0.03] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-tl from-blue-500/[0.02] to-transparent blur-[180px]" />
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-8 shadow-2xl shadow-violet-500/20">
            <LayoutTemplate className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-4">
            Video Templates
          </h1>
          <p className="text-xl text-white/50 max-w-2xl mx-auto">
            Start with professionally crafted templates and bring your vision to life faster
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 rounded-xl"
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
                    ? "bg-white text-black"
                    : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Featured Templates */}
        {featuredTemplates.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Popular Templates</h2>
                <p className="text-white/40 text-sm">Most used by creators</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTemplates.map((template, index) => (
                <TemplateCard 
                  key={template.id}
                  template={template}
                  onUse={() => handleUseTemplate(template.id)}
                  isFeatured
                  index={index}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Templates */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {activeCategory === 'all' ? 'All Templates' : CATEGORIES.find(c => c.id === activeCategory)?.label}
                </h2>
                <p className="text-white/40 text-sm">{regularTemplates.length} templates available</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-white/40" />
                <p className="text-white/40">Loading templates...</p>
              </div>
            </div>
          ) : regularTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-6">
                <LayoutTemplate className="w-10 h-10 text-white/20" />
              </div>
              <h3 className="font-semibold text-white text-xl mb-2">No templates found</h3>
              <p className="text-white/40 max-w-sm">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'More templates coming soon'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regularTemplates.map((template, index) => (
                <TemplateCard 
                  key={template.id}
                  template={template}
                  onUse={() => handleUseTemplate(template.id)}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>

        {/* CTA Section */}
        <motion.section 
          className="mt-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-br from-white/[0.05] to-white/[0.02] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/10" />
            <CardContent className="relative py-12 px-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/20">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Can't find what you're looking for?
              </h3>
              <p className="text-white/50 mb-8 max-w-md mx-auto">
                Start from scratch and create your own custom video with our AI-powered studio
              </p>
              <Button 
                onClick={() => navigate('/create')} 
                size="lg"
                className="bg-white text-black hover:bg-white/90 shadow-xl h-12 px-8"
              >
                Create Custom Video
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}

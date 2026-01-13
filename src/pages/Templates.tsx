import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutTemplate, Search, Play, Clock, Users, Sparkles,
  Film, Megaphone, BookOpen, Smile, Heart, Briefcase,
  Loader2, ArrowRight, Star, TrendingUp, Zap, Moon, Mountain
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
  { id: 'all', label: 'All Templates', icon: LayoutTemplate },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'commercial', label: 'Commercial', icon: Megaphone },
  { id: 'educational', label: 'Educational', icon: BookOpen },
  { id: 'entertainment', label: 'Entertainment', icon: Smile },
  { id: 'lifestyle', label: 'Lifestyle', icon: Heart },
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
  },
];

function TemplateCard({ 
  template, 
  onUse, 
  isFeatured = false 
}: { 
  template: Template | typeof BUILT_IN_TEMPLATES[0];
  onUse: () => void;
  isFeatured?: boolean;
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
      transition={{ duration: 0.4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={cn(
        "group relative overflow-hidden transition-all duration-300 cursor-pointer",
        "card-premium hover:shadow-xl",
        isFeatured && "ring-2 ring-primary/20"
      )}>
        {/* Thumbnail / Visual */}
        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
          {template.thumbnail_url ? (
            <img 
              src={template.thumbnail_url} 
              alt={template.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                  "bg-gradient-to-br from-primary/10 to-primary/5",
                  isHovered && "scale-110"
                )}>
                  <CategoryIcon className="w-8 h-8 text-primary/60" />
                </div>
              </div>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Featured badge */}
          {isFeatured && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-primary text-primary-foreground shadow-lg">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}
          
          {/* Quick use button */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Button 
                  onClick={onUse}
                  className="shadow-xl"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Use Template
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-foreground line-clamp-1">
              {template.name}
            </h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {template.category}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {template.description || 'No description available'}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {template.clip_count && (
              <span className="flex items-center gap-1">
                <Film className="w-3.5 h-3.5" />
                {template.clip_count} clips
              </span>
            )}
            {template.target_duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {template.target_duration_minutes} min
              </span>
            )}
            {template.use_count && template.use_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {template.use_count.toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
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

  const filteredTemplates = templates.filter(template => {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <AppHeader showCreate={false} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 mb-6 shadow-lg shadow-primary/20">
            <LayoutTemplate className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
            Video Templates
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with professionally crafted templates and bring your vision to life faster
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/80 backdrop-blur-sm border-border/50"
            />
          </div>
          
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-muted/60 backdrop-blur-sm">
              {CATEGORIES.slice(0, 4).map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                  <cat.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Featured Templates */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-warning" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Popular Templates</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUILT_IN_TEMPLATES.filter(t => t.is_featured).map((template) => (
              <TemplateCard 
                key={template.id}
                template={template as any}
                onUse={() => handleUseTemplate(template.id)}
                isFeatured
              />
            ))}
          </div>
        </section>

        {/* All Templates */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeCategory === 'all' ? 'All Templates' : CATEGORIES.find(c => c.id === activeCategory)?.label}
              </h2>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {filteredTemplates.length} templates
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <LayoutTemplate className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No templates found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Templates will appear here once they are created'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <TemplateCard 
                    template={template}
                    onUse={() => handleUseTemplate(template.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* CTA Section */}
        <section className="mt-16 text-center">
          <Card className="card-premium p-8 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Can't find what you're looking for?
              </h3>
              <p className="text-muted-foreground mb-6">
                Start from scratch and create your own custom video with our AI-powered studio
              </p>
              <Button onClick={() => navigate('/create')} size="lg">
                Create Custom Video
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

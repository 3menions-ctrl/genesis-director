import { useState, useEffect, useRef, memo, forwardRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation, useRouteCleanup } from '@/lib/navigation';
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
import { toast } from 'sonner';
import { CinematicAtmosphere, DiagnosticTicker } from '@/components/premium/CinematicAtmosphere';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PremiumPageHero, type HeroStat } from '@/components/premium/PremiumPageHero';
import { TemplatePreviewPlayer } from '@/components/templates/TemplatePreviewPlayer';

// Import AI-generated template thumbnails
import viralHookImg from '@/assets/templates/viral-hook.jpg';
import aestheticVlogImg from '@/assets/templates/aesthetic-vlog.jpg';
import transformationImg from '@/assets/templates/transformation.jpg';
import asmrSatisfyingImg from '@/assets/templates/asmr-satisfying.jpg';
import storytimeImg from '@/assets/templates/storytime.jpg';
import documentaryImg from '@/assets/templates/documentary.jpg';
import neoNoirImg from '@/assets/templates/neo-noir.jpg';
import actionMontageImg from '@/assets/templates/action-montage.jpg';
import animeStyleImg from '@/assets/templates/anime-style.jpg';
import productRevealImg from '@/assets/templates/product-reveal.jpg';
import foodLifestyleImg from '@/assets/templates/food-lifestyle.jpg';
import techShowcaseImg from '@/assets/templates/tech-showcase.jpg';
import ugcTestimonialImg from '@/assets/templates/ugc-testimonial.jpg';
import educationalImg from '@/assets/templates/educational.jpg';
import tutorialImg from '@/assets/templates/tutorial.jpg';
import viralSocialImg from '@/assets/templates/viral-social.jpg';
import travelVlogImg from '@/assets/templates/travel-vlog.jpg';
import musicVideoImg from '@/assets/templates/music-video.jpg';
import podcastClipsImg from '@/assets/templates/podcast-clips.jpg';
import brandStoryImg from '@/assets/templates/brand-story.jpg';
import teamIntroImg from '@/assets/templates/team-intro.jpg';
import lectureRecapImg from '@/assets/templates/lecture-recap.jpg';
import microLessonImg from '@/assets/templates/micro-lesson.jpg';
import whiteboardExplainerImg from '@/assets/templates/whiteboard-explainer.jpg';
import languageDrillImg from '@/assets/templates/language-drill.jpg';
import scienceDemoImg from '@/assets/templates/science-demo.jpg';
import courseTrailerImg from '@/assets/templates/course-trailer.jpg';
import examCramImg from '@/assets/templates/exam-cram.jpg';

// 🔥 NEW 5 PREMIUM BREAKOUT EFFECT THUMBNAILS
import postEscapeImg from '@/assets/templates/post-escape.jpg';
import scrollGrabImg from '@/assets/templates/scroll-grab.jpg';
import freezeWalkImg from '@/assets/templates/freeze-walk.jpg';
import realityRipImg from '@/assets/templates/reality-rip.jpg';
import aspectEscapeImg from '@/assets/templates/aspect-escape.jpg';

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
  // 🔥 PREMIUM BREAKOUT EFFECTS ROW
  {
    id: 'post-escape',
    name: 'Post Escape',
    description: 'Avatar trapped in a social post, presses against glass, then SMASHES through into reality',
    category: 'trending',
    thumbnail_url: postEscapeImg,
    use_count: 52400,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
    is_trending: true,
    is_breakout: true,
  },
  {
    id: 'scroll-grab',
    name: 'Scroll Grab',
    description: 'Avatar reaches OUT of vertical video and grabs the screen edge to pull themselves through',
    category: 'trending',
    thumbnail_url: scrollGrabImg,
    use_count: 48900,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'action',
    genre: 'ad',
    is_featured: true,
    is_trending: true,
    is_breakout: true,
  },
  {
    id: 'freeze-walk',
    name: 'Freeze & Walk',
    description: 'Avatar freezes in a video call while others keep moving, then steps OUT of their box into 3D space',
    category: 'trending',
    thumbnail_url: freezeWalkImg,
    use_count: 41200,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'mysterious',
    genre: 'ad',
    is_featured: true,
    is_trending: true,
    is_breakout: true,
  },
  {
    id: 'reality-rip',
    name: 'Reality Rip',
    description: 'Reality TEARS like fabric, avatar silhouette emerges through the glowing rip with power',
    category: 'trending',
    thumbnail_url: realityRipImg,
    use_count: 39700,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'epic',
    genre: 'ad',
    is_featured: true,
    is_trending: true,
    is_breakout: true,
  },
  {
    id: 'aspect-escape',
    name: 'Aspect Ratio Escape',
    description: 'Avatar STEPS ACROSS the boundary between vertical and horizontal video formats',
    category: 'trending',
    thumbnail_url: aspectEscapeImg,
    use_count: 36500,
    target_duration_minutes: 1,
    clip_count: 3,
    mood: 'action',
    genre: 'ad',
    is_featured: true,
    is_trending: true,
    is_breakout: true,
  },
  // 🔥 TRENDING - Viral & Social
  {
    id: 'viral-hook',
    name: 'Viral Hook Opener',
    description: 'Stop-the-scroll hooks that capture attention in 0.5 seconds',
    category: 'trending',
    thumbnail_url: viralHookImg,
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
    thumbnail_url: aestheticVlogImg,
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
    thumbnail_url: transformationImg,
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
    thumbnail_url: asmrSatisfyingImg,
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
    thumbnail_url: storytimeImg,
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
    thumbnail_url: documentaryImg,
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
    thumbnail_url: neoNoirImg,
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
    thumbnail_url: actionMontageImg,
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
    thumbnail_url: animeStyleImg,
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
    thumbnail_url: productRevealImg,
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
    thumbnail_url: foodLifestyleImg,
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
    thumbnail_url: techShowcaseImg,
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
    thumbnail_url: ugcTestimonialImg,
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
    thumbnail_url: educationalImg,
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
    thumbnail_url: tutorialImg,
    use_count: 8100,
    target_duration_minutes: 3,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'lecture-recap',
    name: 'Lecture Recap',
    description: '2-minute recap of a long lecture: hook, four chapter beats, takeaway payoff',
    category: 'educational',
    thumbnail_url: lectureRecapImg,
    use_count: 4720,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'micro-lesson',
    name: 'Micro-Lesson',
    description: '60-second single-concept lesson in 4 beats: hook, teach, example, payoff',
    category: 'educational',
    thumbnail_url: microLessonImg,
    use_count: 6310,
    target_duration_minutes: 1,
    clip_count: 4,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'whiteboard-explainer',
    name: 'Whiteboard Explainer',
    description: '2-minute hand-drawn breakdown: hook, four diagram beats, summary payoff',
    category: 'educational',
    thumbnail_url: whiteboardExplainerImg,
    use_count: 3980,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'language-drill',
    name: 'Language Drill',
    description: '60-second vocab drill in 5 beats: hook word, three reps, recall payoff',
    category: 'educational',
    thumbnail_url: languageDrillImg,
    use_count: 5210,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'uplifting',
    genre: 'educational',
  },
  {
    id: 'science-demo',
    name: 'Science Demo',
    description: '3-minute cinematic experiment in 8 beats: setup, six macro reactions, slow-mo payoff',
    category: 'educational',
    thumbnail_url: scienceDemoImg,
    use_count: 4640,
    target_duration_minutes: 3,
    clip_count: 8,
    mood: 'epic',
    genre: 'educational',
  },
  {
    id: 'course-trailer',
    name: 'Course Trailer',
    description: '60-second sales trailer in 5 beats: hook promise, three module previews, CTA payoff',
    category: 'educational',
    thumbnail_url: courseTrailerImg,
    use_count: 3870,
    target_duration_minutes: 1,
    clip_count: 5,
    mood: 'epic',
    genre: 'educational',
  },
  {
    id: 'exam-cram',
    name: 'Exam Cram Sheet',
    description: '2-minute rapid review in 7 beats: hook, five must-know facts, recall payoff',
    category: 'educational',
    thumbnail_url: examCramImg,
    use_count: 7090,
    target_duration_minutes: 2,
    clip_count: 7,
    mood: 'uplifting',
    genre: 'educational',
    is_trending: true,
  },
  // 🎉 ENTERTAINMENT
  {
    id: 'featured-3',
    name: 'Viral Social Content',
    description: 'Hook-driven content for TikTok & Reels',
    category: 'entertainment',
    thumbnail_url: viralSocialImg,
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
    thumbnail_url: travelVlogImg,
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
    thumbnail_url: musicVideoImg,
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
    thumbnail_url: podcastClipsImg,
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
    thumbnail_url: brandStoryImg,
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
    thumbnail_url: teamIntroImg,
    use_count: 4200,
    target_duration_minutes: 2,
    clip_count: 6,
    mood: 'uplifting',
    genre: 'corporate',
  },
];

type TemplateItem = typeof BUILT_IN_TEMPLATES[0];

/**
 * TemplateCard - STABILITY FIX: Uses CSS animations instead of Framer Motion
 * 
 * ROOT CAUSE: 26+ motion.div instances with individual animation state
 * caused memory pressure and GPU exhaustion on mobile/constrained devices.
 * CSS animations are GPU-composited and don't create JS object overhead.
 */
const TemplateCard = memo(function TemplateCard({ 
  template,
  onUse,
  onPreview,
  index = 0,
}: { 
  template: TemplateItem;
  onUse: () => void;
  onPreview?: () => void;
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onUse}
      className="group relative cursor-pointer animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Compact Card */}
      <div className={cn(
        "relative aspect-[3/4] rounded-xl overflow-hidden",
        "bg-[hsl(220,14%,4%)] transition-all duration-500",
        "ring-1 ring-[hsla(215,100%,60%,0.10)] hover:ring-[hsla(215,100%,60%,0.45)]",
        isHovered && "shadow-[0_30px_80px_-20px_hsla(215,100%,60%,0.55)] -translate-y-0.5"
      )}>
        {/* Image */}
        {template.thumbnail_url && (
          <img 
            src={template.thumbnail_url} 
            alt={template.name}
            loading="lazy"
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
            ? "bg-gradient-to-t from-[hsl(220,14%,2%)] via-[hsla(220,14%,2%,0.55)] to-[hsla(215,100%,60%,0.10)]"
            : "bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        )} />
        {/* Cursor halo on hover */}
        {isHovered && (
          <div
            className="absolute -inset-px rounded-xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 0%, hsla(215,100%,60%,0.35), transparent 60%)',
              mixBlendMode: 'screen',
            }}
          />
        )}

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          <div className="flex gap-1.5">
            {template.is_breakout && (
              <Badge className="bg-[hsl(215,100%,60%)] text-white border border-[hsla(215,100%,75%,0.4)] text-[10px] px-1.5 py-0.5 font-semibold shadow-[0_8px_20px_-8px_hsla(215,100%,60%,0.8)] uppercase tracking-wider">
                <Zap className="w-2.5 h-2.5 mr-0.5" />
                Premium
              </Badge>
            )}
            {template.is_trending && !template.is_breakout && (
              <Badge className="bg-[hsla(215,100%,60%,0.18)] text-[hsl(215,100%,82%)] border border-[hsla(215,100%,60%,0.4)] text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur uppercase tracking-wider">
                <Flame className="w-2.5 h-2.5 mr-0.5" />
                Hot
              </Badge>
            )}
            {template.is_featured && !template.is_trending && !template.is_breakout && (
              <Badge className="bg-[hsla(220,14%,4%,0.7)] text-[hsl(215,100%,82%)] border border-[hsla(215,100%,60%,0.35)] text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur uppercase tracking-wider">
                <Star className="w-2.5 h-2.5 mr-0.5" />
                Featured
              </Badge>
            )}
            {template.category === 'educational' && template.target_duration_minutes != null && (
              <Badge className="bg-[hsla(220,14%,8%,0.75)] text-white/70 border border-white/[0.12] text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur uppercase tracking-wider">
                <Clock className="w-2.5 h-2.5 mr-0.5 opacity-70" />
                {template.target_duration_minutes <= 1 ? '≤1m' : template.target_duration_minutes === 2 ? '2m' : template.target_duration_minutes === 3 ? '3m' : '3m+'}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            {onPreview && (
              <button
                type="button"
                title="Preview pacing"
                aria-label="Preview pacing"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
                className={cn(
                  "w-8 h-8 rounded-full bg-[hsla(220,14%,4%,0.85)] backdrop-blur",
                  "border border-[hsla(215,100%,60%,0.45)] flex items-center justify-center",
                  "shadow-[0_8px_20px_-8px_hsla(215,100%,60%,0.7)] transition-all duration-200",
                  isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                )}
              >
                <Eye className="w-3.5 h-3.5 text-[hsl(215,100%,82%)]" />
              </button>
            )}
            {/* Quick Use Button - CSS transition instead of motion */}
            <button
              type="button"
              title="Use template"
              aria-label="Use template"
              onClick={(e) => {
                e.stopPropagation();
                onUse();
              }}
              className={cn(
                "w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg",
                "transition-all duration-200",
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
              )}
            >
              <Play className="w-4 h-4 text-black ml-0.5" />
            </button>
          </div>
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
    </div>
  );
});

TemplateCard.displayName = 'TemplateCard';

// Main content component separated for error boundary
const TemplatesContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function TemplatesContent(_, ref) {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();

  // Preview player state — opens the schematic pacing preview for a template.
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  
  // FIX: useAuth now returns safe fallback if context is missing
  const { user } = useAuth();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Persist search, category, duration filter, and duration mode across reloads / revisits.
  // Stored as a single JSON blob so one read covers all four.
  const FILTERS_KEY = 'apex_templates_filters_v1';
  type DurationFilter = 'any' | '1' | '2' | '3' | '3plus';
  type DurationMode = 'bucket' | 'exact';
  type PersistedFilters = {
    search: string;
    category: string;
    duration: DurationFilter;
    durationMode: DurationMode;
  };
  const loadPersistedFilters = (): PersistedFilters => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          search: typeof p.search === 'string' ? p.search : '',
          category: typeof p.category === 'string' ? p.category : 'all',
          duration: ['any', '1', '2', '3', '3plus'].includes(p.duration) ? p.duration : 'any',
          durationMode: p.durationMode === 'exact' ? 'exact' : 'bucket',
        };
      }
    } catch {}
    return { search: '', category: 'all', duration: 'any', durationMode: 'bucket' };
  };
  const initialFilters = loadPersistedFilters();
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [activeCategory, setActiveCategory] = useState(initialFilters.category);
  // Educational-tab-only: filter by target length bucket.
  const [durationFilter, setDurationFilter] = useState<DurationFilter>(initialFilters.duration);
  // Educational-tab-only: toggle between bucketed ranges and exact minute matching.
  const [durationMode, setDurationMode] = useState<DurationMode>(initialFilters.durationMode);

  // Save filters whenever any of the four change.
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ search: searchQuery, category: activeCategory, duration: durationFilter, durationMode }),
      );
    } catch {}
  }, [searchQuery, activeCategory, durationFilter, durationMode]);

  // "Jump to results" — auto-scroll to the first matching educational template
  // whenever the duration filter changes (skips initial mount and the "any" reset).
  const firstMatchRef = useRef<HTMLDivElement>(null);
  const didMountDurationRef = useRef(false);
  useEffect(() => {
    if (!didMountDurationRef.current) {
      didMountDurationRef.current = true;
      return;
    }
    if (activeCategory !== 'educational' || durationFilter === 'any') return;
    // Wait one frame so the filtered grid has re-rendered.
    const id = window.requestAnimationFrame(() => {
      const el = firstMatchRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[hsla(215,100%,65%,0.55)]', 'rounded-xl');
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[hsla(215,100%,65%,0.55)]', 'rounded-xl');
      }, 1400);
    });
    return () => window.cancelAnimationFrame(id);
  }, [durationFilter, activeCategory]);

  // Cleanup on navigation away
  useRouteCleanup(() => {
    // No-op: lightweight page, no async to cancel
  }, []);

  useEffect(() => {
    let cancelled = false;
    
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
        if (!cancelled) setTemplates(data || []);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTemplates();
    return () => { cancelled = true; };
  }, []);

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

    // Duration filter applies only on the Educational tab.
    let matchesDuration = true;
    if (activeCategory === 'educational' && durationFilter !== 'any') {
      const d = template.target_duration_minutes ?? 0;
      if (durationMode === 'bucket') {
        if (durationFilter === '1') matchesDuration = d <= 1;
        else if (durationFilter === '2') matchesDuration = d === 2;
        else if (durationFilter === '3') matchesDuration = d === 3;
        else if (durationFilter === '3plus') matchesDuration = d > 3;
      } else {
        // exact mode: match the exact minute value (stored as string in durationFilter)
        matchesDuration = d === Number(durationFilter);
      }
    }

    return matchesSearch && matchesCategory && matchesDuration;
  });

  // Unique exact durations for the Educational tab (derived from currently visible edu templates before duration filtering)
  const exactDurations = activeCategory === 'educational'
    ? Array.from(new Set(
        allTemplates
          .filter(t => t.category === 'educational')
          .map(t => t.target_duration_minutes ?? 0)
          .filter(d => d > 0)
      )).sort((a, b) => a - b)
    : [];

  // Sort: trending first, then featured, then by use count
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.is_trending && !b.is_trending) return -1;
    if (!a.is_trending && b.is_trending) return 1;
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (b.use_count || 0) - (a.use_count || 0);
  });

  const handleUseTemplate = useCallback((template: TemplateItem) => {
    navigate(`/create?template=${template.id}`);
    toast.success(`Using "${template.name}" template`);
  }, [navigate]);

  return (
    <div ref={ref} className="min-h-screen text-white overflow-x-hidden relative">
      <CinematicAtmosphere ns="tmpl" stars={26} />
      <AppHeader />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Diagnostic ticker */}
        <div className="flex justify-center pt-12">
          <DiagnosticTicker
            ns="tmpl"
            items={[
              { code: 'LIB', label: 'Library' },
              { code: 'CUR', label: 'Curated' },
              { code: 'LIVE', label: 'Stream' },
            ]}
          />
        </div>
        {/* Premium editorial header */}
        <div className="pt-6 sm:pt-8">
          <PremiumPageHero
            eyebrow="Library · Curated"
            titlePrefix="Premium"
            titleHighlight="templates"
            titleSuffix="."
            description="Production-ready scene blueprints. Pick a template, swap your story, ship in minutes."
            stats={[
              { label: 'Templates', value: sortedTemplates.length, accent: 'text-white' },
              { label: 'Categories', value: CATEGORIES.length - 1, accent: 'text-[hsl(var(--primary))]' },
              { label: 'Featured', value: sortedTemplates.filter((t: any) => t.is_featured).length, accent: 'text-white/85' },
              { label: 'Trending', value: sortedTemplates.filter((t: any) => (t.use_count || 0) > 100).length, accent: 'text-white/85' },
            ] as HeroStat[]}
            actions={
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-full text-sm backdrop-blur-md"
                />
              </div>
            }
          />
        </div>

        {/* Category Pills - Scrollable */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-all uppercase tracking-[0.18em]",
                activeCategory === cat.id
                  ? "text-white shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.7)] border border-[hsla(215,100%,75%,0.3)]"
                  : "bg-[hsla(220,14%,4%,0.6)] text-white/55 hover:text-white hover:bg-[hsla(215,100%,60%,0.08)] border border-[hsla(215,100%,60%,0.12)] hover:border-[hsla(215,100%,60%,0.32)] backdrop-blur-xl"
              )}
              style={activeCategory === cat.id ? {
                background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
              } : undefined}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Educational-only duration filter rail */}
        {activeCategory === 'educational' && (
          <div className="-mt-2 mb-6 flex flex-col items-center gap-3">
            {/* Mode toggle */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsla(220,14%,4%,0.5)] border border-[hsla(215,100%,60%,0.12)] backdrop-blur-xl">
              <button
                onClick={() => { setDurationMode('bucket'); setDurationFilter('any'); }}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all',
                  durationMode === 'bucket'
                    ? 'text-white shadow-[0_4px_12px_-6px_hsla(215,100%,60%,0.6)]'
                    : 'text-white/45 hover:text-white/70'
                )}
                style={durationMode === 'bucket' ? {
                  background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                } : undefined}
              >
                Buckets
              </button>
              <button
                onClick={() => { setDurationMode('exact'); setDurationFilter('any'); }}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all',
                  durationMode === 'exact'
                    ? 'text-white shadow-[0_4px_12px_-6px_hsla(215,100%,60%,0.6)]'
                    : 'text-white/45 hover:text-white/70'
                )}
                style={durationMode === 'exact' ? {
                  background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                } : undefined}
              >
                Exact
              </button>
            </div>

            {/* Filter pills */}
            <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.18)] backdrop-blur-xl">
              <span className="hidden sm:inline-flex items-center gap-1.5 pl-2 pr-1 text-[10px] uppercase tracking-[0.22em] text-white/45">
                <Clock className="w-3 h-3" /> Length
              </span>
              {durationMode === 'bucket' ? (
                ([
                  { id: 'any', label: 'Any' },
                  { id: '1', label: '≤ 1 min' },
                  { id: '2', label: '2 min' },
                  { id: '3', label: '3 min' },
                  { id: '3plus', label: '3 min+' },
                ] as const).map((opt) => {
                  const active = durationFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setDurationFilter(opt.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all whitespace-nowrap',
                        active
                          ? 'text-white shadow-[0_8px_24px_-10px_hsla(215,100%,60%,0.7)]'
                          : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                      )}
                      style={active ? {
                        background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                      } : undefined}
                    >
                      {opt.label}
                    </button>
                  );
                })
              ) : (
                <>
                  <button
                    onClick={() => setDurationFilter('any')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all whitespace-nowrap',
                      durationFilter === 'any'
                        ? 'text-white shadow-[0_8px_24px_-10px_hsla(215,100%,60%,0.7)]'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                    )}
                    style={durationFilter === 'any' ? {
                      background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                    } : undefined}
                  >
                    Any
                  </button>
                  {exactDurations.map((d) => {
                    const id = String(d) as DurationFilter;
                    const active = durationFilter === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setDurationFilter(id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all whitespace-nowrap',
                          active
                            ? 'text-white shadow-[0_8px_24px_-10px_hsla(215,100%,60%,0.7)]'
                            : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                        )}
                        style={active ? {
                          background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                        } : undefined}
                      >
                        {d} min
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Templates Grid - Compact 5-column */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sortedTemplates.map((template, index) => (
            <div
              key={template.id}
              ref={index === 0 ? firstMatchRef : undefined}
              className="scroll-mt-24"
            >
              <TemplateCard
                template={template}
                onUse={() => handleUseTemplate(template)}
                onPreview={
                  template.category === 'educational'
                    ? () => setPreviewTemplate(template)
                    : undefined
                }
                index={index}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {sortedTemplates.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
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
                setDurationFilter('any');
                setDurationMode('bucket');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </main>

      {/* Schematic pacing preview for learning templates */}
      <TemplatePreviewPlayer
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onApply={handleUseTemplate}
      />
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

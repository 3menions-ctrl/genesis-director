import { useState, useEffect, memo, forwardRef, useRef, useCallback } from 'react';
import { useNavigationWithLoading } from '@/components/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, Clock, Film, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { SafeComponent } from '@/components/ui/error-boundary';

interface ActiveProject {
  id: string;
  title: string;
  status: string;
  pipeline_stage: string;
  created_at: string;
  thumbnail_url?: string;
  mode?: string;
}

interface ActiveProjectBannerProps {
  className?: string;
}

// Inner component with all the logic
const ActiveProjectBannerInner = memo(forwardRef<HTMLDivElement, ActiveProjectBannerProps>(
  function ActiveProjectBannerInner({ className }, ref) {
  const { navigateTo } = useNavigationWithLoading();
  const { user } = useAuth();
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Navigation guard for safe async operations
  const isMountedRef = useRef(true);
  
  // Safe state setters
  const safeSetActiveProject = useCallback((value: ActiveProject | null) => {
    if (isMountedRef.current) setActiveProject(value);
  }, []);
  
  const safeSetIsLoading = useCallback((value: boolean) => {
    if (isMountedRef.current) setIsLoading(value);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!user) {
      safeSetIsLoading(false);
      return;
    }

    const fetchActiveProject = async () => {
      try {
        // Query for projects in active generation states
        const { data, error } = await supabase
          .from('movie_projects')
          .select('id, title, status, pipeline_stage, created_at, thumbnail_url, mode')
          .eq('user_id', user.id)
          .in('status', ['generating', 'processing', 'pending', 'awaiting_approval', 'rendering'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMountedRef.current) return;

        if (error) {
          console.error('Error fetching active project:', error);
          return;
        }

        safeSetActiveProject(data);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Failed to fetch active project:', err);
      } finally {
        safeSetIsLoading(false);
      }
    };

    fetchActiveProject();

    // Set up realtime subscription for project status changes
    // STABILITY FIX: Debounce to prevent rapid-fire queries during pipeline activity
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const channel = supabase
      .channel('active-project-banner')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (isMountedRef.current) {
              fetchActiveProject();
            }
          }, 2000); // 2s debounce - banner is low-priority UI
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // STABILITY FIX: Only user.id, not callback refs

  const handleResume = () => {
    if (activeProject) {
      navigateTo(`/production/${activeProject.id}`);
    }
  };

  const getStatusLabel = (status: string, pipelineStage: string) => {
    if (pipelineStage === 'generating_clips') return 'Generating clips...';
    if (pipelineStage === 'voice_generation') return 'Creating voiceover...';
    if (pipelineStage === 'music_generation') return 'Composing music...';
    if (pipelineStage === 'stitching') return 'Assembling video...';
    if (status === 'awaiting_approval') return 'Awaiting approval';
    if (status === 'rendering') return 'Rendering...';
    if (status === 'processing') return 'Processing...';
    return 'In progress...';
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Don't render if loading, no active project, or dismissed
  if (isLoading || !activeProject || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative overflow-hidden rounded-3xl",
          className
        )}
        style={{
          background: 'linear-gradient(135deg, hsla(215,100%,60%,0.10) 0%, hsla(200,100%,55%,0.06) 100%)',
          backdropFilter: 'blur(56px) saturate(180%)',
          WebkitBackdropFilter: 'blur(56px) saturate(180%)',
          boxShadow: '0 24px 64px -24px hsla(215,100%,40%,0.45), inset 0 1px 0 hsla(0,0%,100%,0.06)',
        }}
      >
        {/* Soft luminous bloom */}
        <div
          className="absolute -top-1/2 left-1/4 h-[200%] w-[60%] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.45) 0%, transparent 70%)' }}
        />
        
        {/* Progress shimmer effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
        />

        <div className="relative p-5 flex items-center gap-5">
          {/* Thumbnail or Icon */}
          <div className="relative shrink-0">
            {activeProject.thumbnail_url ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.08), 0 8px 24px -8px rgba(0,0,0,0.5)' }}>
                <img 
                  src={activeProject.thumbnail_url} 
                  alt={activeProject.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'hsla(0,0%,100%,0.04)',
                  backdropFilter: 'blur(24px)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
                }}
              >
                <Film className="w-7 h-7" strokeWidth={1.5} style={{ color: 'hsla(215,100%,75%,0.95)' }} />
              </div>
            )}
            
            {/* Active indicator */}
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: 'hsla(215,100%,60%,1)',
                boxShadow: '0 0 0 2px hsl(220,14%,2%), 0 0 12px hsla(215,100%,60%,0.7)',
              }}
            >
              <Loader2 className="w-2.5 h-2.5 text-white animate-spin" strokeWidth={2} />
            </div>
          </div>

          {/* Project info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-light uppercase tracking-[0.18em]" style={{ color: 'hsla(215,100%,75%,0.95)' }}>
                Active Project
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[10px] font-light text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {getTimeAgo(activeProject.created_at)}
              </span>
            </div>
            
            <h3 className="text-lg font-light tracking-tight text-white/95 truncate mb-1">
              {activeProject.title}
            </h3>
            
            <p className="text-sm font-light text-white/50 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} style={{ color: 'hsla(215,100%,75%,0.95)' }} />
              {getStatusLabel(activeProject.status, activeProject.pipeline_stage || '')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleResume}
              className="font-light tracking-wide px-5 py-2.5 rounded-full gap-2 border-0 transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: 'linear-gradient(180deg, hsla(215,100%,60%,0.98) 0%, hsla(215,100%,55%,0.98) 100%)',
                color: 'white',
                boxShadow: '0 12px 32px -8px hsla(215,100%,60%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.2)',
              }}
            >
              <Play className="w-4 h-4 fill-current" strokeWidth={1.5} />
              Resume
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Button>
            
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 rounded-full hover:bg-white/[0.06] transition-all duration-300 text-white/40 hover:text-white/70"
              title="Dismiss"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}));

// Exported component wrapped in SafeComponent for crash isolation
// Uses forwardRef to prevent "Function components cannot be given refs" warnings
export const ActiveProjectBanner = memo(forwardRef<HTMLDivElement, ActiveProjectBannerProps>(
  function ActiveProjectBanner({ className }, ref) {
    return (
      <SafeComponent name="ActiveProjectBanner" fallback={null}>
        <ActiveProjectBannerInner ref={ref} className={className} />
      </SafeComponent>
    );
  }
));

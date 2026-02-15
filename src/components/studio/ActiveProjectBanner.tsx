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
    const channel = supabase
      .channel('active-project-banner')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movie_projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Only refetch if still mounted
          if (isMountedRef.current) {
            fetchActiveProject();
          }
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, safeSetActiveProject, safeSetIsLoading]);

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
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10",
          "border border-cyan-500/20",
          "backdrop-blur-xl",
          className
        )}
      >
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-violet-500/5 animate-pulse" />
        
        {/* Progress shimmer effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        />

        <div className="relative p-5 flex items-center gap-5">
          {/* Thumbnail or Icon */}
          <div className="relative shrink-0">
            {activeProject.thumbnail_url ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                <img 
                  src={activeProject.thumbnail_url} 
                  alt={activeProject.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                <Film className="w-7 h-7 text-cyan-400" />
              </div>
            )}
            
            {/* Active indicator */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 border-2 border-zinc-900 flex items-center justify-center">
              <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
            </div>
          </div>

          {/* Project info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
                Active Project
              </span>
              <span className="text-white/30">•</span>
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeAgo(activeProject.created_at)}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-white truncate mb-1">
              {activeProject.title}
            </h3>
            
            <p className="text-sm text-white/50 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              {getStatusLabel(activeProject.status, activeProject.pipeline_stage || '')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleResume}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-2.5 rounded-xl gap-2 shadow-lg shadow-cyan-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume
              <ArrowRight className="w-4 h-4" />
            </Button>
            
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/60"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
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

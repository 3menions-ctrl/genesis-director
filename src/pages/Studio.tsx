import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Film, Play, MoreVertical, Trash2, RotateCcw, 
  Loader2, XCircle, Clock, AlertTriangle, ArrowRight
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StudioProject {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
  pending_video_tasks: any;
}

export default function Studio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      if (!user) return;
      
      // CRITICAL: Verify Supabase client has valid session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('Studio: No valid session yet, skipping load');
        return;
      }
      
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, title, status, created_at, updated_at, thumbnail_url, pending_video_tasks')
        .eq('user_id', session.user.id) // Use session user ID
        .in('status', ['draft', 'awaiting_approval', 'producing', 'generating', 'rendering', 'failed'])
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading projects:', error);
        toast.error('Failed to load projects');
      } else {
        setProjects(data || []);
      }
      setIsLoading(false);
    };

    loadProjects();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('studio_projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movie_projects',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'producing':
      case 'generating':
      case 'rendering':
        return { 
          label: 'In Progress', 
          icon: Loader2, 
          color: 'text-amber-400', 
          bgColor: 'bg-amber-500/20',
          animate: true 
        };
      case 'awaiting_approval':
        return { 
          label: 'Awaiting Review', 
          icon: Clock, 
          color: 'text-blue-400', 
          bgColor: 'bg-blue-500/20',
          animate: false 
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          color: 'text-red-400', 
          bgColor: 'bg-red-500/20',
          animate: false 
        };
      default:
        return { 
          label: 'Draft', 
          icon: Film, 
          color: 'text-white/50', 
          bgColor: 'bg-white/10',
          animate: false 
        };
    }
  };

  const handleContinue = (project: StudioProject) => {
    if (['producing', 'generating', 'rendering'].includes(project.status)) {
      navigate(`/production?projectId=${project.id}`);
    } else if (project.status === 'awaiting_approval') {
      navigate(`/script-review?projectId=${project.id}`);
    } else {
      navigate('/create');
    }
  };

  const handleRetry = async (project: StudioProject) => {
    // Reset project status to allow retry
    const { error } = await supabase
      .from('movie_projects')
      .update({ status: 'draft' })
      .eq('id', project.id);

    if (error) {
      toast.error('Failed to reset project');
    } else {
      toast.success('Project reset. You can now retry.');
      navigate('/create');
    }
  };

  const handleDelete = async (projectId: string) => {
    const { error } = await supabase
      .from('movie_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      toast.error('Failed to delete project');
    } else {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    }
  };

  const inProgressCount = projects.filter(p => ['producing', 'generating', 'rendering'].includes(p.status)).length;
  const failedCount = projects.filter(p => p.status === 'failed').length;
  const awaitingCount = projects.filter(p => p.status === 'awaiting_approval').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-amber-500/[0.03] to-transparent blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-red-500/[0.02] to-transparent blur-[150px]" />
      </div>

      <AppHeader />

      {/* Stats */}
      <div className="sticky top-16 z-40 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm font-medium text-white">{inProgressCount}</span>
            <span className="text-xs text-white/30">In Progress</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">{awaitingCount}</span>
            <span className="text-xs text-white/30">Awaiting</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-white">{failedCount}</span>
            <span className="text-xs text-white/30">Failed</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6">
              <Film className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No active projects</h2>
            <p className="text-white/40 text-base mb-8 text-center max-w-md">
              All your projects have been completed or you haven't started any yet.
            </p>
            <Button onClick={() => navigate('/create')} className="bg-white text-black hover:bg-white/90">
              Start Creating
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const statusConfig = getStatusConfig(project.status);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={project.id}
                  className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-black/50 relative">
                    {project.thumbnail_url ? (
                      <img 
                        src={project.thumbnail_url} 
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-10 h-10 text-white/10" />
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      <Badge className={cn("gap-1.5", statusConfig.bgColor, statusConfig.color, "border-0")}>
                        <StatusIcon className={cn("w-3 h-3", statusConfig.animate && "animate-spin")} />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="w-8 h-8 bg-black/50 hover:bg-black/70 text-white/70"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                          {project.status === 'failed' && (
                            <DropdownMenuItem 
                              onClick={() => handleRetry(project)}
                              className="text-white/70 hover:text-white"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDelete(project.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white truncate mb-1">{project.title}</h3>
                    <p className="text-xs text-white/40">{formatDate(project.updated_at)}</p>
                    
                    <Button 
                      onClick={() => handleContinue(project)}
                      className="w-full mt-4 gap-2"
                      variant={project.status === 'failed' ? 'destructive' : 'default'}
                    >
                      {project.status === 'failed' ? (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          View Error
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Continue
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

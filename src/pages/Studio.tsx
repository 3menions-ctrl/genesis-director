import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Film, MoreVertical, Trash2, RotateCcw, 
  Loader2, XCircle, Clock, AlertTriangle, ArrowRight,
  Sparkles, Play, Zap, Timer
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
import { motion } from 'framer-motion';

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
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, title, status, created_at, updated_at, thumbnail_url, pending_video_tasks')
        .eq('user_id', session.user.id)
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
          className: 'bg-warning/10 text-warning border-warning/20',
          animate: true 
        };
      case 'awaiting_approval':
        return { 
          label: 'Awaiting Review', 
          icon: Clock, 
          className: 'bg-info/10 text-info border-info/20',
          animate: false 
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          animate: false 
        };
      default:
        return { 
          label: 'Draft', 
          icon: Film, 
          className: 'bg-muted text-muted-foreground',
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
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Studio</h1>
              <p className="text-muted-foreground mt-1">
                Track your in-progress and pending projects
              </p>
            </div>

            <Button onClick={() => navigate('/create')} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Timer className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{awaitingCount}</p>
                <p className="text-sm text-muted-foreground">Awaiting</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{failedCount}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Projects */}
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 px-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Film className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">No active projects</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              All your projects have been completed or you haven't started any yet.
            </p>
            <Button onClick={() => navigate('/create')} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Start Creating
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {projects.map((project, index) => {
              const statusConfig = getStatusConfig(project.status);
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-card border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {project.thumbnail_url ? (
                      <img 
                        src={project.thumbnail_url} 
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      <Badge variant="outline" className={cn("gap-1.5 backdrop-blur-sm bg-background/80", statusConfig.className)}>
                        <StatusIcon className={cn("w-3 h-3", statusConfig.animate && "animate-spin")} />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="secondary" 
                            size="icon"
                            className="w-8 h-8"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {project.status === 'failed' && (
                            <DropdownMenuItem onClick={() => handleRetry(project)}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDelete(project.id)}
                            className="text-destructive focus:text-destructive"
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
                    <h3 className="font-semibold text-foreground truncate mb-1">{project.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{formatDate(project.updated_at)}</p>
                    
                    <Button 
                      onClick={() => handleContinue(project)}
                      className="w-full"
                      variant={project.status === 'failed' ? 'destructive' : 'default'}
                    >
                      {project.status === 'failed' ? (
                        <>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          View Error
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Continue
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}

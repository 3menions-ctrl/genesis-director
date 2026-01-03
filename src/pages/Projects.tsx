import { useNavigate } from 'react-router-dom';
import { 
  Plus, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, Sparkles, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';

export default function Projects() {
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject } = useStudio();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    navigate('/script');
  };

  const handleCreateProject = () => {
    createProject();
    navigate('/script');
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2.5">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="success" className="text-xs gap-1">
                <TrendingUp className="w-3 h-3" />
                3 videos this week
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display text-foreground mb-2">
                Your Projects
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Create stunning AI-powered videos in minutes
              </p>
            </div>
          </div>
          
          <Button 
            variant="glow" 
            size="lg" 
            onClick={handleCreateProject} 
            className="gap-2 shrink-0 group"
          >
            <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
            New Project
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
            <div className="relative w-24 h-24 glass rounded-3xl flex items-center justify-center">
              <Film className="w-10 h-10 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-display text-foreground mb-3">No projects yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Create your first AI video project and bring your ideas to life
          </p>
          <Button variant="glow" size="lg" onClick={handleCreateProject} className="gap-2">
            <Sparkles className="w-5 h-5" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className={cn(
                "group relative card-elegant overflow-hidden cursor-pointer transition-all duration-300 animate-scale-up hover-lift",
                activeProjectId === project.id && "ring-2 ring-primary/30 border-primary/40"
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-muted/20 to-background">
                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.04)_1px,transparent_1px)] bg-[size:20px_20px]" />
                
                {project.status === 'completed' ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `linear-gradient(to bottom, transparent 40%, hsl(var(--card) / 0.95)),
                        url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                      project.status === 'generating' || project.status === 'rendering'
                        ? "icon-container"
                        : "bg-muted/30 group-hover:bg-muted/50"
                    )}>
                      {project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant={project.status as 'idle' | 'generating' | 'rendering' | 'completed'}>
                    {project.status}
                  </Badge>
                </div>

                {/* Duration */}
                {project.duration_seconds && (
                  <div className="absolute bottom-3 right-3 z-10">
                    <Badge variant="outline" className="font-mono text-xs">
                      {Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}
                    </Badge>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-background/90 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <Button 
                    variant="glow" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(project.id);
                    }}
                    className="gap-2 shadow-xl"
                  >
                    Open Project
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate mb-1.5 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                      {project.credits_used && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          <span>{project.credits_used.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass border-border/20">
                      <DropdownMenuItem onClick={() => handleOpenProject(project.id)} className="gap-2.5 py-2">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2.5 py-2">
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/20" />
                      <DropdownMenuItem
                        className="gap-2.5 py-2 text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Active indicator */}
              {activeProjectId === project.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary to-transparent" />
              )}
            </div>
          ))}

          {/* New Project Card */}
          <button
            onClick={handleCreateProject}
            className={cn(
              "group rounded-2xl border-2 border-dashed transition-all duration-300",
              "border-border/30 hover:border-primary/40 bg-transparent",
              "flex flex-col items-center justify-center p-10 min-h-[280px]",
              "hover:bg-card/20 animate-scale-up"
            )}
            style={{ animationDelay: `${projects.length * 60}ms` }}
          >
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-14 h-14 rounded-xl bg-muted/30 group-hover:bg-primary/10 flex items-center justify-center transition-all duration-300">
                <Plus className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:rotate-90" />
              </div>
            </div>
            <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Create New Project
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start from scratch
            </p>
          </button>
        </div>
      )}
    </div>
  );
}
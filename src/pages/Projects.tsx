import { useNavigate } from 'react-router-dom';
import { 
  Plus, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, Sparkles, TrendingUp, Zap, Star
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="mb-12 animate-fade-in-up">
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="icon-box p-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <Badge variant="aurora" className="text-xs gap-1.5 px-3 py-1">
                <TrendingUp className="w-3 h-3" />
                3 videos this week
              </Badge>
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-display text-foreground mb-3 tracking-tight">
                Your <span className="text-gradient-aurora">Projects</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Create stunning AI-powered videos in minutes with our next-gen studio
              </p>
            </div>
          </div>
          
          <Button 
            variant="aurora" 
            size="xl" 
            onClick={handleCreateProject} 
            className="gap-3 shrink-0 group"
          >
            <Plus className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" />
            New Project
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
          <div className="relative mb-10">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/20 via-[hsl(280,85%,60%)]/15 to-accent/20 blur-3xl" />
            <div className="relative w-28 h-28 glass rounded-3xl flex items-center justify-center">
              <Film className="w-12 h-12 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-3xl font-display text-foreground mb-4">No projects yet</h2>
          <p className="text-muted-foreground mb-10 max-w-md text-lg">
            Create your first AI video project and bring your ideas to life
          </p>
          <Button variant="aurora" size="xl" onClick={handleCreateProject} className="gap-3">
            <Zap className="w-5 h-5" />
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
                "group relative card-premium cursor-pointer transition-all duration-500 animate-scale-in hover-lift",
                activeProjectId === project.id && "ring-2 ring-primary/40 border-primary/30"
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-muted/30 via-background to-muted/20">
                {/* Decorative grid */}
                <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
                
                {project.status === 'completed' ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{
                      backgroundImage: `linear-gradient(to bottom, transparent 30%, hsl(var(--card))),
                        url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                      project.status === 'generating' || project.status === 'rendering'
                        ? "icon-box"
                        : "bg-muted/40 group-hover:bg-primary/10"
                    )}>
                      {project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <Play className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant={project.status as 'idle' | 'generating' | 'rendering' | 'completed'}>
                    {project.status}
                  </Badge>
                </div>

                {/* Duration */}
                {project.duration_seconds && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <Badge variant="outline" className="font-mono text-xs backdrop-blur-xl bg-background/60">
                      {Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}
                    </Badge>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-background/95 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-all duration-400 flex items-center justify-center">
                  <Button 
                    variant="glow" 
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(project.id);
                    }}
                    className="gap-2 shadow-2xl"
                  >
                    Open Project
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate mb-2 group-hover:text-gradient-aurora transition-all">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                      {project.credits_used && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
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
                        className="h-9 w-9 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass border-border/30 p-2">
                      <DropdownMenuItem onClick={() => handleOpenProject(project.id)} className="gap-2.5 py-2.5 rounded-lg cursor-pointer">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2.5 py-2.5 rounded-lg cursor-pointer">
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/20 my-1" />
                      <DropdownMenuItem
                        className="gap-2.5 py-2.5 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
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

              {/* Active indicator gradient */}
              {activeProjectId === project.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent" />
              )}
            </div>
          ))}

          {/* New Project Card */}
          <button
            onClick={handleCreateProject}
            className={cn(
              "group rounded-2xl border-2 border-dashed transition-all duration-500",
              "border-border/40 hover:border-primary/50",
              "bg-transparent hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5",
              "flex flex-col items-center justify-center p-12 min-h-[340px]",
              "animate-scale-in"
            )}
            style={{ animationDelay: `${projects.length * 80}ms` }}
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/30 to-accent/30 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-16 h-16 rounded-2xl bg-muted/40 group-hover:bg-primary/15 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-all duration-500 group-hover:rotate-180" />
              </div>
            </div>
            <p className="font-semibold text-lg text-muted-foreground group-hover:text-foreground transition-colors">
              Create New Project
            </p>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Start from scratch
            </p>
          </button>
        </div>
      )}
    </div>
  );
}
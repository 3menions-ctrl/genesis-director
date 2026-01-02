import { useNavigate } from 'react-router-dom';
import { Plus, Folder, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, ArrowRight } from 'lucide-react';
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage your AI video projects</p>
        </div>
        <Button variant="glow" size="lg" onClick={handleCreateProject} className="gap-2">
          <Plus className="w-5 h-5" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-3xl bg-muted/30 border border-border/50 flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create your first AI video project to get started
          </p>
          <Button variant="glow" onClick={handleCreateProject}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className={cn(
                "group relative rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 cursor-pointer",
                activeProjectId === project.id
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : "border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              {/* Thumbnail / Preview */}
              <div className="aspect-video bg-gradient-to-br from-muted/50 to-background relative overflow-hidden">
                {project.status === 'completed' ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--card))),
                        url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center",
                      project.status === 'generating' || project.status === 'rendering'
                        ? "bg-primary/20"
                        : "bg-muted/50"
                    )}>
                      {project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <Badge variant={project.status as any}>{project.status}</Badge>
                </div>

                {/* Duration Badge */}
                {project.duration_seconds && (
                  <div className="absolute bottom-3 right-3">
                    <Badge variant="outline" className="font-mono text-xs bg-background/80 backdrop-blur-sm">
                      {Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}
                    </Badge>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button 
                    variant="glow" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(project.id);
                    }}
                  >
                    Open Project
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate mb-1">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(project.updated_at)}</span>
                      {project.credits_used && (
                        <>
                          <span>•</span>
                          <span>{project.credits_used.toLocaleString()} credits</span>
                        </>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenProject(project.id)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}

          {/* New Project Card */}
          <button
            onClick={handleCreateProject}
            className="group rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/50 bg-transparent transition-all duration-300 flex flex-col items-center justify-center p-8 aspect-[4/3]"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/30 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
              <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Create New Project
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

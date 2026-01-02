import { Plus, Folder, Clock, MoreVertical, Trash2, Copy, Edit2, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Project } from '@/types/studio';
import { cn } from '@/lib/utils';

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDeleteProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
}

export function ProjectList({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onDuplicateProject,
}: ProjectListProps) {
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Folder className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Projects</h3>
              <p className="text-xs text-muted-foreground">{projects.length} total</p>
            </div>
          </div>
          <Button variant="glow" size="sm" onClick={onCreateProject} className="gap-1.5">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center">
              <Film className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No projects yet</p>
            <p className="text-xs text-muted-foreground mb-4">Create your first AI video</p>
            <Button variant="outline" size="sm" onClick={onCreateProject}>
              Create Project
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition-all",
                  activeProjectId === project.id 
                    ? "bg-primary/10 border border-primary/30" 
                    : "hover:bg-muted/30 border border-transparent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn(
                        "font-medium truncate text-sm",
                        activeProjectId === project.id ? "text-primary" : "text-foreground"
                      )}>
                        {project.name}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={project.status as 'idle' | 'generating' | 'rendering' | 'completed'}
                        className="text-[10px] px-2 py-0"
                      >
                        {project.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                    </div>

                    {project.duration_seconds && (
                      <div className="mt-1.5 text-xs text-muted-foreground font-mono">
                        Duration: {Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelectProject(project.id)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicateProject?.(project.id)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDeleteProject?.(project.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

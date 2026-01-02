import { useState } from 'react';
import { Plus, Folder, Clock, MoreVertical, Trash2, Copy, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Project, ProjectStatus } from '@/types/studio';
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
    <div className="glass-panel h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Projects</h3>
          </div>
          <Button variant="glow" size="sm" onClick={onCreateProject}>
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">No projects yet</p>
            <Button variant="outline" size="sm" onClick={onCreateProject}>
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  "w-full p-4 text-left transition-all hover:bg-muted/20",
                  activeProjectId === project.id && "bg-primary/10 border-l-2 border-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {project.name}
                      </p>
                      <Badge
                        variant={project.status as 'idle' | 'generating' | 'rendering' | 'completed'}
                        className="text-[10px] px-1.5"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(project.updated_at)}</span>
                      {project.duration_seconds && (
                        <>
                          <span>•</span>
                          <span>{Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}</span>
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

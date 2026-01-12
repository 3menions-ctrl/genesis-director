import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Film, Loader2, CheckCircle2, ChevronLeft, FolderOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ProductionProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  clipsCompleted: number;
  totalClips: number;
  thumbnail?: string;
  updatedAt: string;
}

interface ProductionSidebarProps {
  projects: ProductionProject[];
  activeProjectId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function ProductionSidebar({ 
  projects, 
  activeProjectId, 
  isCollapsed,
  onToggle
}: ProductionSidebarProps) {
  const navigate = useNavigate();
  
  const handleSelectProject = (id: string) => {
    navigate(`/production?projectId=${id}`);
  };

  const getStatusColor = (status: string, progress: number) => {
    if (progress >= 100) return 'success';
    if (status === 'failed' || status === 'stitching_failed') return 'destructive';
    if (['generating', 'producing', 'stitching'].includes(status)) return 'info';
    return 'warning';
  };

  const getStatusLabel = (status: string, progress: number) => {
    if (progress >= 100) return 'Complete';
    if (status === 'failed') return 'Failed';
    if (status === 'stitching_failed') return 'Stitch Failed';
    if (status === 'stitching') return 'Stitching';
    if (status === 'generating') return 'Generating';
    if (status === 'producing') return 'Rendering';
    return 'Paused';
  };
  
  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 56 : 260 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sidebar-accent flex items-center justify-center">
              <Layers className="w-4 h-4 text-sidebar-foreground" />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground">Productions</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "w-8 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg shrink-0", 
            isCollapsed && "mx-auto"
          )}
          onClick={onToggle}
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Projects List */}
      <ScrollArea className="flex-1">
        <div className={cn("py-3", isCollapsed ? "px-2" : "px-3")}>
          {!isCollapsed && projects.length > 0 && (
            <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-3 px-1">
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
          
          <div className="space-y-1.5">
            {projects.map((project, index) => {
              const isActive = project.id === activeProjectId;
              const isProcessing = ['generating', 'producing', 'stitching'].includes(project.status);
              const statusColor = getStatusColor(project.status, project.progress);
              const statusLabel = getStatusLabel(project.status, project.progress);
              
              return (
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "w-full rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isCollapsed ? "p-2 flex justify-center" : "p-3",
                    isActive 
                      ? "bg-sidebar-accent ring-1 ring-sidebar-ring" 
                      : "hover:bg-sidebar-accent/50"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div 
                      layoutId="activeSidebarIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-sidebar-primary"
                    />
                  )}

                  {isCollapsed ? (
                    /* Collapsed View */
                    <div className="relative">
                      <div className={cn(
                        "w-10 h-10 rounded-lg overflow-hidden bg-sidebar-accent flex items-center justify-center",
                        isActive && "ring-1 ring-sidebar-ring"
                      )}>
                        {project.thumbnail ? (
                          <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Film className="w-4 h-4 text-sidebar-foreground/40" />
                        )}
                      </div>
                      {isProcessing && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-info flex items-center justify-center ring-2 ring-sidebar">
                          <Loader2 className="w-2.5 h-2.5 text-info-foreground animate-spin" />
                        </div>
                      )}
                      {project.progress >= 100 && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success flex items-center justify-center ring-2 ring-sidebar">
                          <CheckCircle2 className="w-2.5 h-2.5 text-success-foreground" />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Expanded View */
                    <div className="flex gap-3 items-center">
                      {/* Thumbnail */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-12 h-12 rounded-lg overflow-hidden bg-sidebar-accent flex items-center justify-center",
                          isActive && "ring-1 ring-sidebar-ring"
                        )}>
                          {project.thumbnail ? (
                            <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Film className="w-5 h-5 text-sidebar-foreground/30" />
                          )}
                        </div>
                        {isProcessing && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-info flex items-center justify-center ring-2 ring-sidebar">
                            <Loader2 className="w-2.5 h-2.5 text-info-foreground animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                          {project.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[10px] font-medium",
                            statusColor === 'success' && "text-success",
                            statusColor === 'destructive' && "text-destructive",
                            statusColor === 'info' && "text-info",
                            statusColor === 'warning' && "text-warning"
                          )}>
                            {statusLabel}
                          </span>
                          <span className="text-[10px] text-sidebar-foreground/30">
                            {project.clipsCompleted}/{project.totalClips}
                          </span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-sidebar-accent overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              statusColor === 'success' && "bg-success",
                              statusColor === 'destructive' && "bg-destructive",
                              statusColor === 'info' && "bg-info",
                              statusColor === 'warning' && "bg-warning"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${project.progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className={cn("p-3 border-t border-sidebar-border", isCollapsed && "px-2")}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors",
            isCollapsed ? "p-2.5" : "justify-start gap-2.5 h-9"
          )}
          onClick={() => navigate('/projects')}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="text-xs font-medium">All Projects</span>}
        </Button>
      </div>
    </motion.aside>
  );
}
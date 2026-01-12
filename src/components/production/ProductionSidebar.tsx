import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Film, 
  Loader2, 
  CheckCircle2, 
  PanelLeftClose,
  PanelLeft,
  LayoutGrid,
  AlertTriangle,
  Circle,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

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

  const getStatusConfig = (status: string, progress: number) => {
    if (progress >= 100) return { 
      label: 'Complete',
      icon: CheckCircle2,
      dotColor: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      barColor: 'bg-emerald-500'
    };
    if (status === 'failed' || status === 'stitching_failed') return { 
      label: 'Failed',
      icon: AlertTriangle,
      dotColor: 'bg-rose-400',
      textColor: 'text-rose-400',
      barColor: 'bg-rose-500'
    };
    if (['generating', 'producing', 'stitching'].includes(status)) return { 
      label: status === 'stitching' ? 'Stitching' : 'Rendering',
      icon: Loader2,
      dotColor: 'bg-sky-400',
      textColor: 'text-sky-400',
      barColor: 'bg-sky-500',
      isAnimated: true
    };
    return { 
      label: 'Queued',
      icon: Circle,
      dotColor: 'bg-zinc-500',
      textColor: 'text-zinc-500',
      barColor: 'bg-zinc-600'
    };
  };
  
  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 56 : 220 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="h-full flex flex-col shrink-0 bg-zinc-950"
      >
        {/* Header */}
        <div className={cn(
          "h-12 flex items-center",
          isCollapsed ? "justify-center" : "justify-between px-3"
        )}>
          {!isCollapsed && (
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
              Projects
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-zinc-600 hover:text-zinc-400 hover:bg-transparent"
            onClick={onToggle}
          >
            {isCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Projects List */}
        <ScrollArea className="flex-1">
          <div className={cn("space-y-px", isCollapsed ? "px-1.5 py-1" : "px-1.5 py-1")}>
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              const config = getStatusConfig(project.status, project.progress);
              
              return (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        "w-full rounded-md transition-colors duration-100",
                        isCollapsed ? "p-1.5 flex justify-center" : "px-2 py-1.5",
                        isActive 
                          ? "bg-zinc-800/80" 
                          : "hover:bg-zinc-800/40"
                      )}
                    >
                      {isCollapsed ? (
                        /* Collapsed: Icon only */
                        <div className="relative">
                          <div className={cn(
                            "w-8 h-8 rounded overflow-hidden flex items-center justify-center",
                            "bg-zinc-800",
                            isActive && "ring-1 ring-zinc-600"
                          )}>
                            {project.thumbnail ? (
                              <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Film className="w-3 h-3 text-zinc-600" />
                            )}
                          </div>
                          {/* Status dot */}
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-950",
                            config.dotColor,
                            config.isAnimated && "animate-pulse"
                          )} />
                        </div>
                      ) : (
                        /* Expanded: Full row */
                        <div className="flex items-center gap-2.5 w-full">
                          {/* Status indicator */}
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            config.dotColor,
                            config.isAnimated && "animate-pulse"
                          )} />
                          
                          {/* Title & Progress */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "text-[12px] font-medium truncate",
                                isActive ? "text-zinc-100" : "text-zinc-400"
                              )}>
                                {project.title}
                              </span>
                              <span className={cn(
                                "text-[10px] tabular-nums shrink-0",
                                config.textColor
                              )}>
                                {Math.round(project.progress)}%
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-1 h-[3px] rounded-full bg-zinc-800 overflow-hidden">
                              <motion.div
                                className={cn("h-full rounded-full", config.barColor)}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(project.progress, 100)}%` }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" sideOffset={8}>
                      <p className="font-medium text-xs">{project.title}</p>
                      <p className="text-[10px] text-zinc-400">{config.label} · {Math.round(project.progress)}%</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
            
            {/* Empty state */}
            {projects.length === 0 && !isCollapsed && (
              <div className="text-center py-10 px-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center mx-auto mb-2">
                  <Film className="w-4 h-4 text-zinc-600" />
                </div>
                <p className="text-[11px] text-zinc-600">No projects in pipeline</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className={cn(
          "border-t border-zinc-800/50",
          isCollapsed ? "p-1.5" : "p-2"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                  isCollapsed ? "h-8 w-8 p-0 justify-center mx-auto" : "h-7 justify-start gap-2 px-2 text-[11px]"
                )}
                onClick={() => navigate('/projects')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {!isCollapsed && <span>All Projects</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">All Projects</TooltipContent>}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

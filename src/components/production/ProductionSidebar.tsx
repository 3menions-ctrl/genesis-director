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
  Zap
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
      label: 'Done',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      ring: 'ring-emerald-500/20'
    };
    if (status === 'failed' || status === 'stitching_failed') return { 
      label: 'Failed',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/15',
      ring: 'ring-rose-500/20'
    };
    if (['generating', 'producing', 'stitching'].includes(status)) return { 
      label: status === 'stitching' ? 'Stitching' : 'Rendering',
      icon: Loader2,
      color: 'text-sky-400',
      bg: 'bg-sky-500/15',
      ring: 'ring-sky-500/20',
      spin: true
    };
    return { 
      label: 'Queued',
      icon: Zap,
      color: 'text-zinc-400',
      bg: 'bg-zinc-500/15',
      ring: 'ring-zinc-500/20'
    };
  };
  
  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="h-full flex flex-col shrink-0 bg-zinc-950 border-r border-zinc-800/50"
      >
        {/* Header */}
        <div className={cn(
          "h-14 flex items-center border-b border-zinc-800/50",
          isCollapsed ? "justify-center px-2" : "justify-between px-3"
        )}>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
              >
                Pipeline
              </motion.span>
            )}
          </AnimatePresence>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                onClick={onToggle}
              >
                {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Projects */}
        <ScrollArea className="flex-1">
          <div className={cn("py-1.5", isCollapsed ? "px-1.5" : "px-2")}>
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              const config = getStatusConfig(project.status, project.progress);
              const StatusIcon = config.icon;
              
              return (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        "w-full mb-0.5 rounded-lg transition-all duration-150 text-left",
                        isCollapsed ? "p-2 flex justify-center" : "p-2",
                        isActive 
                          ? "bg-zinc-800" 
                          : "hover:bg-zinc-800/50"
                      )}
                    >
                      {isCollapsed ? (
                        <div className="relative">
                          <div className={cn(
                            "w-9 h-9 rounded-md overflow-hidden flex items-center justify-center",
                            "bg-zinc-800 border border-zinc-700/50",
                            isActive && "ring-1 ring-zinc-600"
                          )}>
                            {project.thumbnail ? (
                              <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Film className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                          </div>
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center",
                            "ring-2 ring-zinc-950",
                            config.bg
                          )}>
                            <StatusIcon className={cn("w-2 h-2", config.color, config.spin && "animate-spin")} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          {/* Thumbnail */}
                          <div className={cn(
                            "w-8 h-8 rounded-md overflow-hidden flex items-center justify-center shrink-0",
                            "bg-zinc-800 border border-zinc-700/50"
                          )}>
                            {project.thumbnail ? (
                              <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Film className="w-3 h-3 text-zinc-500" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs font-medium truncate",
                              isActive ? "text-zinc-100" : "text-zinc-400"
                            )}>
                              {project.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <StatusIcon className={cn("w-2.5 h-2.5", config.color, config.spin && "animate-spin")} />
                              <span className={cn("text-[10px]", config.color)}>{config.label}</span>
                              <span className="text-[10px] text-zinc-600">·</span>
                              <span className="text-[10px] text-zinc-500">{Math.round(project.progress)}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      <div className="font-medium text-xs">{project.title}</div>
                      <div className="text-[10px] text-muted-foreground">{config.label} · {Math.round(project.progress)}%</div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
            
            {projects.length === 0 && !isCollapsed && (
              <div className="text-center py-8 px-2">
                <Film className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                <p className="text-[11px] text-zinc-500">No projects</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className={cn("border-t border-zinc-800/50", isCollapsed ? "p-1.5" : "p-2")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                  isCollapsed ? "h-9 p-0 justify-center" : "h-8 justify-start gap-2 px-2"
                )}
                onClick={() => navigate('/projects')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {!isCollapsed && <span className="text-xs">All Projects</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">All Projects</TooltipContent>}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

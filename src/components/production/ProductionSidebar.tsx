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
      <AnimatePresence mode="wait">
        {!isCollapsed ? (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full flex flex-col shrink-0 bg-zinc-950 overflow-hidden"
          >
            {/* Header */}
            <div className="h-12 flex items-center justify-between px-3">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                Projects
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-zinc-600 hover:text-zinc-400 hover:bg-transparent"
                onClick={onToggle}
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Projects List */}
            <ScrollArea className="flex-1">
              <div className="space-y-px px-1.5 py-1">
                {projects.map((project) => {
                  const isActive = project.id === activeProjectId;
                  const config = getStatusConfig(project.status, project.progress);
                  
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        "w-full rounded-md transition-colors duration-100 px-2 py-1.5",
                        isActive 
                          ? "bg-zinc-800/80" 
                          : "hover:bg-zinc-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 w-full">
                        {/* Status indicator */}
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          config.dotColor,
                          config.isAnimated && "animate-pulse"
                        )} />
                        
                        {/* Title & Progress */}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
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
                      </div>
                    </button>
                  );
                })}
                
                {/* Empty state */}
                {projects.length === 0 && (
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
            <div className="border-t border-zinc-800/50 p-2">
              <Button
                variant="ghost"
                className="w-full h-7 justify-start gap-2 px-2 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                onClick={() => navigate('/projects')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All Projects</span>
              </Button>
            </div>
          </motion.aside>
        ) : (
          /* When collapsed, show a small toggle button */
          <motion.div
            key="toggle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col shrink-0 bg-zinc-950 border-r border-zinc-800/50"
          >
            <div className="h-12 flex items-center justify-center px-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50"
                    onClick={onToggle}
                  >
                    <PanelLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Show Projects</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}

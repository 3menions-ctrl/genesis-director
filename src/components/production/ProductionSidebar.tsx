import { memo, forwardRef } from 'react';
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
  Sparkles,
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

// Extracted component to avoid ref forwarding conflict with AnimatePresence + Tooltip
const CollapsedToggleButton = memo(function CollapsedToggleButton({ onToggle }: { onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl"
          onClick={onToggle}
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-popover border-border">
        Show Projects
      </TooltipContent>
    </Tooltip>
  );
});

export const ProductionSidebar = memo(forwardRef<HTMLDivElement, ProductionSidebarProps>(function ProductionSidebar({ 
  projects, 
  activeProjectId, 
  isCollapsed,
  onToggle
}, ref) {
  const navigate = useNavigate();
  
  const handleSelectProject = (id: string) => {
    navigate(`/production?projectId=${id}`);
  };

  const getStatusConfig = (status: string, progress: number) => {
    if (progress >= 100) return { 
      label: 'Complete',
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-teal-500',
      bgClass: 'bg-emerald-500/15 border-emerald-500/20',
      textClass: 'text-emerald-400',
    };
    if (status === 'failed' || status === 'stitching_failed') return { 
      label: 'Failed',
      icon: AlertTriangle,
      gradient: 'from-rose-500 to-red-500',
      bgClass: 'bg-rose-500/15 border-rose-500/20',
      textClass: 'text-rose-400',
    };
    if (['generating', 'producing', 'stitching'].includes(status)) return { 
      label: status === 'stitching' ? 'Stitching' : 'Rendering',
      icon: Loader2,
      gradient: 'from-sky-500 to-blue-500',
      bgClass: 'bg-sky-500/15 border-sky-500/20',
      textClass: 'text-sky-400',
      isAnimated: true
    };
    return { 
      label: 'Queued',
      icon: Sparkles,
      gradient: 'from-zinc-500 to-zinc-600',
      bgClass: 'bg-muted/50 border-border',
      textClass: 'text-muted-foreground',
    };
  };
  
  return (
    <TooltipProvider delayDuration={0}>
      <AnimatePresence mode="wait">
        {!isCollapsed ? (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full flex flex-col shrink-0 overflow-hidden border-r border-border"
          >
            {/* Glass background */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/90 to-background/95 backdrop-blur-xl" />
            
            {/* Header */}
            <div className="relative h-16 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-muted/80 to-muted/20 border border-border flex items-center justify-center">
                  <Film className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground/80 tracking-wide">
                  Projects
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
                onClick={onToggle}
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            </div>

            {/* Projects List */}
            <ScrollArea className="relative flex-1">
              <div className="space-y-1 p-3">
                {projects.map((project) => {
                  const isActive = project.id === activeProjectId;
                  const config = getStatusConfig(project.status, project.progress);
                  
                  return (
                    <motion.button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      whileHover={{ x: 2 }}
                      className={cn(
                        "w-full rounded-xl transition-all duration-200 p-3 text-left",
                        "border",
                        isActive 
                          ? "bg-muted/60 border-border" 
                          : "bg-transparent border-transparent hover:bg-muted/30 hover:border-border"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status indicator */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                          config.bgClass
                        )}>
                          {config.isAnimated ? (
                            <Loader2 className={cn("w-4 h-4 animate-spin", config.textClass)} />
                          ) : (
                            <config.icon className={cn("w-4 h-4", config.textClass)} />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs font-medium truncate",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {project.title}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted-foreground/60">{config.label}</span>
                            <span className={cn(
                              "text-[10px] font-semibold tabular-nums",
                              config.textClass
                            )}>
                              {Math.round(project.progress)}%
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                            <motion.div
                              className={cn("h-full bg-gradient-to-r", config.gradient)}
                              initial={{ width: 0 }}
                              animate={{ width: `${project.progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
                
                {/* Empty state */}
                {projects.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mx-auto mb-3">
                      <Film className="w-6 h-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-xs text-muted-foreground/60">No projects in pipeline</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">Start creating to see them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="relative border-t border-border p-3">
              <Button
                variant="ghost"
                className={cn(
                  "w-full h-10 justify-start gap-3 px-3 rounded-xl",
                  "text-xs text-muted-foreground hover:text-foreground",
                  "bg-muted/20 hover:bg-muted/50",
                  "border border-transparent hover:border-border"
                )}
                onClick={() => navigate('/projects')}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>All Projects</span>
              </Button>
            </div>
          </motion.aside>
        ) : (
          /* Collapsed state - ref-safe structure for AnimatePresence compatibility */
          <motion.div
            key="toggle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col shrink-0 border-r border-border bg-background/80 backdrop-blur-xl"
          >
            <div className="h-16 flex items-center justify-center">
              <CollapsedToggleButton onToggle={onToggle} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}));

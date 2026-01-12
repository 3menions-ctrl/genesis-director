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
  Zap,
  Circle
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
      color: 'emerald',
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      iconColor: 'text-emerald-400',
      barColor: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
      pulseColor: 'bg-emerald-400'
    };
    if (status === 'failed' || status === 'stitching_failed') return { 
      label: status === 'stitching_failed' ? 'Stitch Failed' : 'Failed',
      icon: AlertTriangle,
      color: 'rose',
      gradient: 'from-rose-500/20 to-rose-500/5',
      iconColor: 'text-rose-400',
      barColor: 'bg-gradient-to-r from-rose-500 to-rose-400',
      pulseColor: 'bg-rose-400'
    };
    if (['generating', 'producing', 'stitching'].includes(status)) return { 
      label: status === 'stitching' ? 'Stitching' : status === 'producing' ? 'Rendering' : 'Generating',
      icon: Zap,
      color: 'sky',
      gradient: 'from-sky-500/20 to-sky-500/5',
      iconColor: 'text-sky-400',
      barColor: 'bg-gradient-to-r from-sky-500 to-sky-400',
      pulseColor: 'bg-sky-400',
      isAnimated: true
    };
    return { 
      label: 'Queued',
      icon: Circle,
      color: 'zinc',
      gradient: 'from-zinc-500/20 to-zinc-500/5',
      iconColor: 'text-zinc-400',
      barColor: 'bg-gradient-to-r from-zinc-500 to-zinc-400',
      pulseColor: 'bg-zinc-400'
    };
  };
  
  return (
    <TooltipProvider delayDuration={100}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 300 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "h-full flex flex-col shrink-0 relative overflow-hidden",
          "bg-gradient-to-b from-zinc-950 via-zinc-950 to-black",
          "border-r border-white/[0.04]"
        )}
      >
        {/* Ambient glow effect */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        
        {/* Header */}
        <div className={cn(
          "relative z-10 flex items-center h-[60px] border-b border-white/[0.04]",
          isCollapsed ? "justify-center px-3" : "justify-between px-4"
        )}>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/[0.02] flex items-center justify-center backdrop-blur-sm border border-white/[0.08]">
                    <Zap className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-white/90 tracking-tight leading-none">
                    Pipeline
                  </span>
                  <span className="text-[11px] text-white/35 mt-1">
                    {projects.length} active
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-8 h-8 rounded-lg",
                  "text-white/30 hover:text-white/70 hover:bg-white/[0.05]",
                  "transition-colors duration-200"
                )}
                onClick={onToggle}
              >
                {isCollapsed ? (
                  <PanelLeft className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Projects List */}
        <ScrollArea className="flex-1 relative z-10">
          <div className={cn("py-2", isCollapsed ? "px-2" : "px-2.5")}>
            <AnimatePresence mode="popLayout">
              {projects.map((project, index) => {
                const isActive = project.id === activeProjectId;
                const config = getStatusConfig(project.status, project.progress);
                const StatusIcon = config.icon;
                
                return (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          delay: index * 0.03,
                          duration: 0.2,
                          layout: { duration: 0.2 }
                        }}
                        onClick={() => handleSelectProject(project.id)}
                        className={cn(
                          "w-full mb-1 rounded-xl transition-all duration-200 group relative overflow-hidden",
                          isCollapsed ? "p-2.5" : "p-3",
                          isActive 
                            ? "bg-white/[0.08]" 
                            : "hover:bg-white/[0.04]"
                        )}
                      >
                        {/* Active state background glow */}
                        {isActive && (
                          <div className={cn(
                            "absolute inset-0 bg-gradient-to-r opacity-50",
                            config.gradient
                          )} />
                        )}
                        
                        {/* Active indicator */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div 
                              initial={{ scaleY: 0, opacity: 0 }}
                              animate={{ scaleY: 1, opacity: 1 }}
                              exit={{ scaleY: 0, opacity: 0 }}
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-full bg-white"
                            />
                          )}
                        </AnimatePresence>

                        {isCollapsed ? (
                          /* Collapsed View */
                          <div className="relative flex justify-center">
                            <div className={cn(
                              "w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center",
                              "bg-gradient-to-br from-white/[0.06] to-white/[0.01]",
                              "border border-white/[0.06]",
                              "transition-all duration-200",
                              isActive && "border-white/[0.12] shadow-lg shadow-black/30"
                            )}>
                              {project.thumbnail ? (
                                <img 
                                  src={project.thumbnail} 
                                  className="w-full h-full object-cover" 
                                  alt="" 
                                />
                              ) : (
                                <Film className="w-4 h-4 text-white/25" />
                              )}
                            </div>
                            
                            {/* Status dot */}
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full",
                              "flex items-center justify-center",
                              "ring-[2px] ring-zinc-950",
                              config.pulseColor,
                              config.isAnimated && "animate-pulse"
                            )}>
                              {config.isAnimated && (
                                <Loader2 className="w-2 h-2 text-white animate-spin" />
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Expanded View */
                          <div className="relative flex gap-3 items-center">
                            {/* Thumbnail */}
                            <div className="relative shrink-0">
                              <div className={cn(
                                "w-12 h-12 rounded-xl overflow-hidden",
                                "bg-gradient-to-br from-white/[0.06] to-white/[0.01]",
                                "border border-white/[0.06]",
                                "flex items-center justify-center",
                                "transition-all duration-200",
                                isActive && "border-white/[0.12]"
                              )}>
                                {project.thumbnail ? (
                                  <img 
                                    src={project.thumbnail} 
                                    className="w-full h-full object-cover" 
                                    alt="" 
                                  />
                                ) : (
                                  <Film className="w-5 h-5 text-white/20" />
                                )}
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-[13px] font-medium truncate leading-tight",
                                  isActive ? "text-white" : "text-white/70 group-hover:text-white/90",
                                  "transition-colors duration-200"
                                )}>
                                  {project.title}
                                </p>
                              </div>
                              
                              {/* Status */}
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md",
                                  "bg-white/[0.05] border border-white/[0.04]"
                                )}>
                                  <StatusIcon className={cn(
                                    "w-3 h-3",
                                    config.iconColor,
                                    config.isAnimated && "animate-pulse"
                                  )} />
                                  <span className={cn(
                                    "text-[10px] font-medium",
                                    config.iconColor
                                  )}>
                                    {config.label}
                                  </span>
                                </div>
                                
                                <span className="text-[10px] text-white/25 tabular-nums">
                                  {project.clipsCompleted}/{project.totalClips}
                                </span>
                              </div>
                              
                              {/* Progress bar */}
                              <div className="mt-2.5 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                                <motion.div
                                  className={cn("h-full rounded-full", config.barColor)}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(project.progress, 100)}%` }}
                                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" sideOffset={12} className="max-w-[200px]">
                        <div className="font-medium">{project.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {config.label} · {Math.round(project.progress)}%
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </AnimatePresence>
            
            {/* Empty state */}
            {projects.length === 0 && !isCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 px-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mx-auto mb-4">
                  <Film className="w-6 h-6 text-white/15" />
                </div>
                <p className="text-sm text-white/40 font-medium">No projects yet</p>
                <p className="text-xs text-white/20 mt-1.5 leading-relaxed">
                  Create your first project to start producing
                </p>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className={cn(
          "relative z-10 border-t border-white/[0.04]",
          isCollapsed ? "p-2" : "p-2.5"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full rounded-xl transition-all duration-200",
                  "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
                  isCollapsed 
                    ? "h-11 p-0 justify-center" 
                    : "h-10 justify-start gap-3 px-3"
                )}
                onClick={() => navigate('/projects')}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                {!isCollapsed && (
                  <span className="text-[13px] font-medium">All Projects</span>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" sideOffset={12}>
                All Projects
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

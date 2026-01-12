import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Film, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft, 
  FolderOpen, 
  Sparkles,
  AlertCircle,
  Clock,
  Pause
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
      color: 'success', 
      label: 'Complete',
      icon: CheckCircle2,
      bgClass: 'bg-success/10',
      textClass: 'text-success',
      dotClass: 'bg-success'
    };
    if (status === 'failed' || status === 'stitching_failed') return { 
      color: 'destructive', 
      label: status === 'stitching_failed' ? 'Stitch Failed' : 'Failed',
      icon: AlertCircle,
      bgClass: 'bg-destructive/10',
      textClass: 'text-destructive',
      dotClass: 'bg-destructive'
    };
    if (['generating', 'producing', 'stitching'].includes(status)) return { 
      color: 'info', 
      label: status === 'stitching' ? 'Stitching' : status === 'producing' ? 'Rendering' : 'Generating',
      icon: Loader2,
      bgClass: 'bg-info/10',
      textClass: 'text-info',
      dotClass: 'bg-info',
      isAnimated: true
    };
    return { 
      color: 'muted', 
      label: 'Paused',
      icon: Pause,
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground',
      dotClass: 'bg-muted-foreground'
    };
  };
  
  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 280 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="h-full flex flex-col shrink-0 relative"
        style={{
          background: 'linear-gradient(180deg, hsl(0 0% 4%) 0%, hsl(0 0% 2%) 100%)',
        }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        
        {/* Header */}
        <div className={cn(
          "relative h-16 flex items-center border-b border-white/[0.06]",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] flex items-center justify-center border border-white/[0.08] shadow-lg shadow-black/20">
                  <Sparkles className="w-4 h-4 text-white/80" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white/90 tracking-tight">Pipeline</span>
                  <p className="text-[10px] text-white/40 font-medium">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
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
                  "w-8 h-8 rounded-lg transition-all duration-200",
                  "text-white/40 hover:text-white/80 hover:bg-white/[0.06]",
                  isCollapsed && "mx-auto"
                )}
                onClick={onToggle}
              >
                <ChevronLeft className={cn(
                  "w-4 h-4 transition-transform duration-300",
                  isCollapsed && "rotate-180"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Projects List */}
        <ScrollArea className="flex-1 relative">
          <div className={cn("py-3", isCollapsed ? "px-2" : "px-3")}>
            <div className="space-y-1">
              {projects.map((project, index) => {
                const isActive = project.id === activeProjectId;
                const statusConfig = getStatusConfig(project.status, project.progress);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        onClick={() => handleSelectProject(project.id)}
                        className={cn(
                          "w-full rounded-xl transition-all duration-200 group relative",
                          isCollapsed ? "p-2 flex justify-center" : "p-3",
                          isActive 
                            ? "bg-white/[0.08]" 
                            : "hover:bg-white/[0.04]"
                        )}
                      >
                        {/* Active indicator line */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div 
                              layoutId="activePipelineIndicator"
                              initial={{ opacity: 0, scaleY: 0 }}
                              animate={{ opacity: 1, scaleY: 1 }}
                              exit={{ opacity: 0, scaleY: 0 }}
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-white"
                            />
                          )}
                        </AnimatePresence>

                        {isCollapsed ? (
                          /* Collapsed View */
                          <div className="relative">
                            <div className={cn(
                              "w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center transition-all",
                              "bg-gradient-to-br from-white/[0.08] to-transparent border border-white/[0.06]",
                              isActive && "border-white/20 shadow-lg shadow-black/20"
                            )}>
                              {project.thumbnail ? (
                                <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Film className="w-4 h-4 text-white/30" />
                              )}
                            </div>
                            
                            {/* Status indicator dot */}
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                              "ring-2 ring-[hsl(0_0%_3%)]",
                              statusConfig.bgClass
                            )}>
                              <StatusIcon className={cn(
                                "w-2.5 h-2.5",
                                statusConfig.textClass,
                                statusConfig.isAnimated && "animate-spin"
                              )} />
                            </div>
                          </div>
                        ) : (
                          /* Expanded View */
                          <div className="flex gap-3 items-start w-full">
                            {/* Thumbnail */}
                            <div className="relative shrink-0">
                              <div className={cn(
                                "w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center",
                                "bg-gradient-to-br from-white/[0.08] to-transparent border border-white/[0.06]",
                                isActive && "border-white/15"
                              )}>
                                {project.thumbnail ? (
                                  <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <Film className="w-4 h-4 text-white/25" />
                                )}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className={cn(
                                "text-[13px] font-medium truncate leading-tight transition-colors",
                                isActive ? "text-white" : "text-white/70 group-hover:text-white/90"
                              )}>
                                {project.title}
                              </p>
                              
                              {/* Status row */}
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className={cn(
                                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                                  statusConfig.bgClass
                                )}>
                                  <StatusIcon className={cn(
                                    "w-3 h-3",
                                    statusConfig.textClass,
                                    statusConfig.isAnimated && "animate-spin"
                                  )} />
                                  <span className={cn("text-[10px] font-medium", statusConfig.textClass)}>
                                    {statusConfig.label}
                                  </span>
                                </div>
                                <span className="text-[10px] text-white/30 font-medium">
                                  {project.clipsCompleted}/{project.totalClips}
                                </span>
                              </div>
                              
                              {/* Progress bar */}
                              <div className="mt-2.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <motion.div
                                  className={cn(
                                    "h-full rounded-full",
                                    project.progress >= 100 ? "bg-success" :
                                    statusConfig.color === 'destructive' ? "bg-destructive" :
                                    statusConfig.color === 'info' ? "bg-white/60" : "bg-white/30"
                                  )}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(project.progress, 100)}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="flex flex-col gap-1">
                        <span className="font-medium">{project.title}</span>
                        <span className="text-muted-foreground text-xs">{statusConfig.label} · {project.progress}%</span>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
              
              {projects.length === 0 && (
                <div className={cn(
                  "text-center py-8",
                  isCollapsed ? "px-1" : "px-4"
                )}>
                  {!isCollapsed && (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                        <Film className="w-5 h-5 text-white/20" />
                      </div>
                      <p className="text-sm text-white/40 font-medium">No projects</p>
                      <p className="text-xs text-white/25 mt-1">Create one to get started</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className={cn(
          "relative border-t border-white/[0.06]",
          isCollapsed ? "p-2" : "p-3"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full transition-all duration-200 rounded-xl",
                  "text-white/50 hover:text-white/80 hover:bg-white/[0.06]",
                  isCollapsed ? "p-2.5 justify-center" : "justify-start gap-2.5 h-10 px-3"
                )}
                onClick={() => navigate('/projects')}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="text-xs font-medium">All Projects</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">All Projects</TooltipContent>
            )}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

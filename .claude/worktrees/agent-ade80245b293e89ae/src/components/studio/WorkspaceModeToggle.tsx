/**
 * WorkspaceModeToggle - UI for switching between Quick Create and Advanced Editor
 * 
 * Features:
 * - Smooth animated toggle
 * - Mode indicator with feature hints
 * - Keyboard shortcut support (Ctrl/Cmd + Shift + A)
 */

import { memo, useEffect } from 'react';
import { Zap, Settings2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceMode, WorkspaceMode } from '@/contexts/WorkspaceModeContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface WorkspaceModeToggleProps {
  className?: string;
  variant?: 'pill' | 'button' | 'minimal';
}

const MODE_CONFIG: Record<WorkspaceMode, {
  label: string;
  icon: typeof Zap;
  description: string;
  color: string;
  bgColor: string;
}> = {
  quick: {
    label: 'Quick Create',
    icon: Zap,
    description: 'Simplified interface for fast creation',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  advanced: {
    label: 'Advanced Editor',
    icon: Settings2,
    description: 'Full control with timeline & audio mixing',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
  },
};

export const WorkspaceModeToggle = memo(function WorkspaceModeToggle({
  className,
  variant = 'pill',
}: WorkspaceModeToggleProps) {
  const { mode, toggleMode, setMode } = useWorkspaceMode();
  const config = MODE_CONFIG[mode];
  const nextConfig = MODE_CONFIG[mode === 'quick' ? 'advanced' : 'quick'];
  const Icon = config.icon;
  
  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMode]);
  
  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMode}
              className={cn(
                "h-8 w-8 p-0",
                config.color,
                className
              )}
            >
              <Icon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {config.label} <span className="text-white/50">• ⌘⇧A to switch</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMode}
        className={cn(
          "gap-2 border-white/[0.08] hover:border-white/20",
          className
        )}
      >
        <Icon className={cn("w-4 h-4", config.color)} />
        <span className="text-white/80">{config.label}</span>
        <ChevronRight className="w-3 h-3 text-white/40" />
      </Button>
    );
  }
  
  // Pill variant (default) - Uses standard button to avoid ref-forwarding issues with asChild
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleMode}
            className={cn(
              "relative flex items-center gap-1 p-1 rounded-full",
              "bg-white/[0.03] border border-white/[0.08]",
              "hover:border-white/[0.15] transition-colors",
              className
            )}
          >
            {/* Quick button */}
            <div
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                mode === 'quick' ? 'text-white' : 'text-white/40'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setMode('quick');
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick</span>
            </div>
            
            {/* Advanced button */}
            <div
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                mode === 'advanced' ? 'text-white' : 'text-white/40'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setMode('advanced');
              }}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Advanced</span>
            </div>
            
            {/* Sliding indicator - CSS transition instead of motion.div */}
            <div
              className={cn(
                "absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out",
                mode === 'quick' 
                  ? 'bg-emerald-500/30 left-1 w-[calc(50%-4px)]' 
                  : 'bg-violet-500/30 left-[50%] w-[calc(50%-4px)]'
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            Switch to {nextConfig.label}
            <span className="text-white/50 ml-2">⌘⇧A</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
export default WorkspaceModeToggle;

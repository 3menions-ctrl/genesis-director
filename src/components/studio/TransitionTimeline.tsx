import { motion } from 'framer-motion';
import { ArrowRight, AlertTriangle, CheckCircle2, XCircle, Layers, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TransitionAnalysis } from '@/types/continuity-orchestrator';

interface TransitionTimelineProps {
  transitions: TransitionAnalysis[];
  clipsToRetry?: number[];
  onRetryClip?: (clipIndex: number) => void;
  onGenerateBridge?: (fromIndex: number, toIndex: number, prompt: string) => void;
  isRetrying?: boolean;
  className?: string;
}

export function TransitionTimeline({
  transitions,
  clipsToRetry = [],
  onRetryClip,
  onGenerateBridge,
  isRetrying = false,
  className,
}: TransitionTimelineProps) {
  if (!transitions.length) return null;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("p-4 rounded-xl bg-white/[0.03] border border-white/10", className)}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Transition Timeline</h3>
          <p className="text-xs text-white/50">
            {transitions.length} transitions • {transitions.filter(t => t.needsBridge).length} need bridging
          </p>
        </div>
      </div>

      <TooltipProvider>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {transitions.map((transition, idx) => (
            <div key={`${transition.fromIndex}-${transition.toIndex}`} className="flex items-center">
              {/* Clip indicator */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border transition-all cursor-pointer",
                      clipsToRetry.includes(transition.fromIndex)
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    )}
                    onClick={() => clipsToRetry.includes(transition.fromIndex) && onRetryClip?.(transition.fromIndex)}
                  >
                    {transition.fromIndex + 1}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Clip {transition.fromIndex + 1}</p>
                  {clipsToRetry.includes(transition.fromIndex) && (
                    <p className="text-xs text-red-400">Click to retry</p>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Transition arrow with score */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex items-center px-1">
                    <div className={cn(
                      "h-1 w-8 rounded-full",
                      getScoreColor(transition.overallScore)
                    )} />
                    <ArrowRight className={cn(
                      "w-3 h-3 -ml-1",
                      getScoreTextColor(transition.overallScore)
                    )} />
                    
                    {/* Score badge */}
                    <div className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded text-[8px] font-bold",
                      getScoreBgColor(transition.overallScore),
                      getScoreTextColor(transition.overallScore)
                    )}>
                      {transition.overallScore}
                    </div>
                    
                    {/* Bridge indicator */}
                    {transition.needsBridge && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">
                      Transition {transition.fromIndex + 1} → {transition.toIndex + 1}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="text-white/50">Motion:</span>
                        <span className={cn("ml-1", getScoreTextColor(transition.motionScore))}>
                          {transition.motionScore}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Color:</span>
                        <span className={cn("ml-1", getScoreTextColor(transition.colorScore))}>
                          {transition.colorScore}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Semantic:</span>
                        <span className={cn("ml-1", getScoreTextColor(transition.semanticScore))}>
                          {transition.semanticScore}
                        </span>
                      </div>
                    </div>
                    {transition.needsBridge && transition.bridgePrompt && (
                      <div className="pt-1 border-t border-white/10">
                        <p className="text-[10px] text-amber-400">Bridge clip recommended</p>
                        {onGenerateBridge && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-amber-400 hover:text-amber-300 px-2 mt-1"
                            onClick={() => onGenerateBridge(
                              transition.fromIndex,
                              transition.toIndex,
                              transition.bridgePrompt!
                            )}
                          >
                            Generate Bridge
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Last clip indicator (only on last transition) */}
              {idx === transitions.length - 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border transition-all cursor-pointer",
                        clipsToRetry.includes(transition.toIndex)
                          ? "bg-red-500/20 border-red-500/50 text-red-400"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      )}
                      onClick={() => clipsToRetry.includes(transition.toIndex) && onRetryClip?.(transition.toIndex)}
                    >
                      {transition.toIndex + 1}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Clip {transition.toIndex + 1}</p>
                    {clipsToRetry.includes(transition.toIndex) && (
                      <p className="text-xs text-red-400">Click to retry</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-white/40">85+</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] text-white/40">70-84</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-white/40">&lt;70</span>
          </div>
          <div className="flex-1" />
          {clipsToRetry.length > 0 && onRetryClip && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-red-400 hover:text-red-300"
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Retry {clipsToRetry.length} clips
            </Button>
          )}
        </div>
      </TooltipProvider>
    </motion.div>
  );
}

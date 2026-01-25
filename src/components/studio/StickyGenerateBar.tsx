import { forwardRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Square, 
  Clock, 
  Coins, 
  Layers,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Terminal,
  Zap,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PipelineLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface StickyGenerateBarProps {
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
  progress: number;
  totalDuration: number;
  clipCount: number;
  estimatedCredits: number;
  userCredits: number;
  elapsedTime: number;
  completedClips: number;
  onGenerate: () => void;
  onCancel: () => void;
  onBuyCredits?: () => void;
  disabled?: boolean;
  currentStage?: string;
  pipelineLogs?: PipelineLog[];
  isInitializing?: boolean;
}

const STAGE_MESSAGES: Record<string, { label: string; icon: string }> = {
  'preproduction': { label: 'Preparing production...', icon: '🎬' },
  'awaiting_approval': { label: 'Script ready for review', icon: '📋' },
  'qualitygate': { label: 'Running quality checks...', icon: '🔍' },
  'assets': { label: 'Creating assets...', icon: '🎨' },
  'production': { label: 'Generating video clips...', icon: '🎥' },
  'postproduction': { label: 'Finalizing video...', icon: '✨' },
  'complete': { label: 'Complete!', icon: '✅' },
  'error': { label: 'Error occurred', icon: '❌' },
};

export const StickyGenerateBar = forwardRef<HTMLDivElement, StickyGenerateBarProps>(
  function StickyGenerateBar({
    isRunning,
    isComplete,
    isError,
    progress,
    totalDuration,
    clipCount,
    estimatedCredits,
    userCredits,
    elapsedTime,
    completedClips,
    onGenerate,
    onCancel,
    onBuyCredits,
    disabled,
    currentStage = 'idle',
    pipelineLogs = [],
    isInitializing = false,
  }, ref) {
  const [showLogs, setShowLogs] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');
  
  const hasInsufficientCredits = userCredits < estimatedCredits;
  const creditShortfall = Math.max(0, estimatedCredits - userCredits);
  
  // Animate status text based on progress
  useEffect(() => {
    if (!isRunning) return;
    
    const stageInfo = STAGE_MESSAGES[currentStage];
    if (stageInfo) {
      setStatusText(`${stageInfo.icon} ${stageInfo.label}`);
    } else if (progress < 10) {
      setStatusText('🚀 Starting pipeline...');
    } else if (progress < 20) {
      setStatusText('📝 Generating script...');
    } else if (progress < 35) {
      setStatusText('🔍 Analyzing content...');
    } else if (progress < 50) {
      setStatusText('🎨 Creating assets...');
    } else if (progress < 85) {
      setStatusText(`🎥 Rendering clips (${completedClips}/${clipCount})...`);
    } else {
      setStatusText('✨ Finalizing video...');
    }
  }, [isRunning, progress, currentStage, completedClips, clipCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Don't show if complete or error
  if (isComplete || isError) return null;

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expandable Logs Panel */}
      <AnimatePresence>
        {isRunning && showLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0a0a0a] border-t border-white/10 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
              <Terminal className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Pipeline Log</span>
              <motion.div 
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </div>
            <ScrollArea className="h-[160px] px-4 py-2">
              {pipelineLogs.length === 0 ? (
                <div className="flex items-center gap-2 text-white/30 text-xs py-4">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Waiting for pipeline updates...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {pipelineLogs.slice(-20).map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="text-white/20 font-mono shrink-0">{log.time}</span>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                        log.type === 'success' && "bg-emerald-400",
                        log.type === 'error' && "bg-red-400",
                        log.type === 'warning' && "bg-amber-400",
                        log.type === 'info' && "bg-white/30"
                      )} />
                      <span className={cn(
                        log.type === 'success' && "text-emerald-400/80",
                        log.type === 'error' && "text-red-400/80",
                        log.type === 'warning' && "text-amber-400/80",
                        log.type === 'info' && "text-white/50"
                      )}>
                        {log.message}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar */}
      <div className="bg-background/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        {/* Progress bar at top of sticky bar */}
        {isRunning && (
          <div className="h-1 bg-muted relative overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
        
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Stats & Status */}
            <div className="flex items-center gap-4">
              {/* Status indicator when running */}
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3"
                >
                  {/* Pulsing indicator */}
                  <div className="relative">
                    <motion.div
                      className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Zap className="w-5 h-5 text-primary" />
                    </motion.div>
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-primary/20"
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                  
                  {/* Status text */}
                  <div className="hidden sm:block">
                    <motion.p 
                      key={statusText}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-medium text-foreground"
                    >
                      {statusText}
                    </motion.p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{Math.round(progress)}% complete</span>
                      <span>•</span>
                      <span>{formatTime(elapsedTime)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Static stats when not running */}
              {!isRunning && (
                <>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{totalDuration}s</span>
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{clipCount} clips</span>
                  </div>

                  {/* Render time estimate */}
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-amber-600">~{Math.ceil(clipCount * 3)} min</span>
                    <span className="text-xs text-muted-foreground">(2-4 min/clip)</span>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm">
                    <Coins className="w-4 h-4" />
                    <span className="font-medium">~{estimatedCredits}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">
              {isRunning && (
                <>
                  {/* Toggle logs button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLogs(!showLogs)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Terminal className="w-4 h-4" />
                    <span className="hidden sm:inline">Logs</span>
                    {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  </Button>
                  
                  <Button
                    variant="destructive"
                    onClick={onCancel}
                    className="gap-2 h-11 px-6"
                  >
                    <Square className="w-4 h-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </>
              )}
              
              {!isRunning && (
                <div className="flex items-center gap-3">
                  {/* Insufficient credits warning */}
                  {hasInsufficientCredits && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/20"
                    >
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive font-medium">
                        Need {creditShortfall} more credits
                      </span>
                    </motion.div>
                  )}
                  
                  {/* Buy Credits button when insufficient */}
                  {hasInsufficientCredits && onBuyCredits && (
                    <Button
                      variant="outline"
                      onClick={onBuyCredits}
                      className="gap-2 h-11 px-6 border-primary text-primary hover:bg-primary/10"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Buy Credits</span>
                    </Button>
                  )}
                  
                  <Button
                    onClick={onGenerate}
                    disabled={disabled || isInitializing || hasInsufficientCredits}
                    className={cn(
                      "gap-2 h-11 px-8 font-semibold transition-all",
                      "bg-foreground hover:bg-foreground/90 text-background",
                      "shadow-lg hover:shadow-xl hover:scale-[1.02]",
                      "relative overflow-hidden group",
                      isInitializing && "cursor-wait",
                      hasInsufficientCredits && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Preparing...</span>
                      </>
                    ) : hasInsufficientCredits ? (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span>Insufficient Credits</span>
                      </>
                    ) : (
                      <>
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <Sparkles className="w-5 h-5" />
                        <span>Generate Video</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Square, 
  Clock, 
  Coins, 
  Layers,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StickyGenerateBarProps {
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
  progress: number;
  totalDuration: number;
  clipCount: number;
  estimatedCredits: number;
  elapsedTime: number;
  completedClips: number;
  onGenerate: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function StickyGenerateBar({
  isRunning,
  isComplete,
  isError,
  progress,
  totalDuration,
  clipCount,
  estimatedCredits,
  elapsedTime,
  completedClips,
  onGenerate,
  onCancel,
  disabled,
}: StickyGenerateBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Don't show if complete or error
  if (isComplete || isError) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      {/* Progress bar at top of sticky bar */}
      {isRunning && (
        <div className="h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Stats */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{totalDuration}s</span>
            </div>
            
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{clipCount} clips</span>
            </div>
            
            {!isRunning && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm">
                <Coins className="w-4 h-4" />
                <span className="font-medium">~{estimatedCredits}</span>
              </div>
            )}
            
            {isRunning && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(elapsedTime)}</span>
                </div>
                
                <Badge variant="secondary" className="hidden md:flex">
                  {completedClips}/{clipCount} clips
                </Badge>
              </>
            )}
          </div>

          {/* Right: Action Button */}
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Button
                variant="destructive"
                onClick={onCancel}
                className="gap-2 h-11 px-6"
              >
                <Square className="w-4 h-4" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            ) : (
              <Button
                onClick={onGenerate}
                disabled={disabled}
                className={cn(
                  "gap-2 h-11 px-8 font-semibold transition-all",
                  "bg-foreground hover:bg-foreground/90 text-background",
                  "shadow-lg hover:shadow-xl hover:scale-[1.02]",
                  "relative overflow-hidden group"
                )}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Sparkles className="w-5 h-5" />
                <span>Generate Video</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

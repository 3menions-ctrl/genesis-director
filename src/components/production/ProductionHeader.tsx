import { motion } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, Clock, X, RotateCcw,
  FileText, Users, Shield, Wand2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StageStatus {
  name: string;
  shortName: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ProductionHeaderProps {
  projectTitle: string;
  projectStatus: string;
  stages: StageStatus[];
  progress: number;
  elapsedTime: number;
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
  isCancelling: boolean;
  isResuming: boolean;
  hasClips: boolean;
  onCancel: () => void;
  onResume: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function MiniPipeline({ stages }: { stages: StageStatus[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {stages.map((stage, i) => {
        const isActive = stage.status === 'active';
        const isComplete = stage.status === 'complete';
        const isError = stage.status === 'error';
        
        return (
          <div key={i} className="relative group">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
              isComplete && "bg-success/20 text-success",
              isActive && "bg-primary/20 text-primary",
              !isComplete && !isActive && !isError && "bg-muted text-muted-foreground",
              isError && "bg-destructive/20 text-destructive"
            )}>
              {isActive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isError ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <stage.icon className="w-3.5 h-3.5" />
              )}
            </div>
            
            {/* Connector */}
            {i < stages.length - 1 && (
              <div className={cn(
                "absolute top-1/2 -right-1.5 w-2 h-0.5 -translate-y-1/2 rounded-full",
                isComplete ? "bg-success/50" : "bg-border"
              )} />
            )}
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border shadow-lg z-10">
              {stage.shortName}
              {stage.details && <span className="text-muted-foreground ml-1">({stage.details})</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProductionHeader({
  projectTitle,
  projectStatus,
  stages,
  progress,
  elapsedTime,
  isRunning,
  isComplete,
  isError,
  isCancelling,
  isResuming,
  hasClips,
  onCancel,
  onResume,
}: ProductionHeaderProps) {
  return (
    <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <motion.div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm",
            isComplete ? "bg-success/10 text-success" : 
            isError ? "bg-destructive/10 text-destructive" : 
            isRunning ? "bg-primary/10 text-primary" :
            "bg-muted text-muted-foreground"
          )}
        >
          {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
          {isComplete && <CheckCircle2 className="w-4 h-4" />}
          {isError && <XCircle className="w-4 h-4" />}
          {!isRunning && !isComplete && !isError && <Film className="w-4 h-4" />}
        </motion.div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-none truncate max-w-[220px]">
            {projectTitle}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {projectStatus.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <MiniPipeline stages={stages} />
        
        <div className="h-6 w-px bg-border" />
        
        {/* Cancel Button */}
        {isRunning && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive hover:bg-destructive/10"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Cancel
          </Button>
        )}
        
        {/* Resume Button */}
        {hasClips && !isComplete && !isRunning && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-warning/30 text-warning hover:bg-warning/10"
            onClick={onResume}
            disabled={isResuming}
          >
            {isResuming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
            Resume
          </Button>
        )}
        
        {isRunning && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-success"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            LIVE
          </Badge>
        )}
        
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">{formatTime(elapsedTime)}</span>
        </div>

        <span className={cn(
          "text-xl font-bold tabular-nums",
          isComplete ? "text-success" : isError ? "text-destructive" : "text-foreground"
        )}>
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
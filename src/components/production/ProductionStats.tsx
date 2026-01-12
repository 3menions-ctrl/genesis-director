import { motion } from 'framer-motion';
import { Film, Clock, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProductionStatsProps {
  completedClips: number;
  totalClips: number;
  elapsedTime: number;
  progress: number;
  auditScore: number | null;
  isComplete: boolean;
  isError: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ProductionStats({
  completedClips,
  totalClips,
  elapsedTime,
  progress,
  auditScore,
  isComplete,
  isError,
}: ProductionStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Progress */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              isComplete ? "text-success" : isError ? "text-destructive" : "text-foreground"
            )}>
              {Math.round(progress)}%
            </span>
          </div>
          <Progress 
            value={progress} 
            className={cn(
              "h-1.5",
              isComplete && "[&>div]:bg-success",
              isError && "[&>div]:bg-destructive"
            )} 
          />
        </CardContent>
      </Card>

      {/* Clips */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Film className="w-4 h-4 text-info" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Clips</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{completedClips}</span>
              <span className="text-sm text-muted-foreground">/{totalClips}</span>
            </div>
          </div>
          {completedClips === totalClips && totalClips > 0 && (
            <div className="flex items-center gap-1 mt-2 text-success">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[10px] font-medium">All clips ready</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Time</span>
            </div>
            <span className="text-lg font-bold font-mono text-foreground">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quality Score */}
      <Card className={cn(
        "glass-card",
        auditScore !== null && auditScore >= 80 && "ring-1 ring-success/30",
        auditScore !== null && auditScore >= 60 && auditScore < 80 && "ring-1 ring-warning/30",
        auditScore !== null && auditScore < 60 && "ring-1 ring-destructive/30"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                auditScore === null && "bg-muted",
                auditScore !== null && auditScore >= 80 && "bg-success/10",
                auditScore !== null && auditScore >= 60 && auditScore < 80 && "bg-warning/10",
                auditScore !== null && auditScore < 60 && "bg-destructive/10"
              )}>
                <Sparkles className={cn(
                  "w-4 h-4",
                  auditScore === null && "text-muted-foreground",
                  auditScore !== null && auditScore >= 80 && "text-success",
                  auditScore !== null && auditScore >= 60 && auditScore < 80 && "text-warning",
                  auditScore !== null && auditScore < 60 && "text-destructive"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Quality</span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              auditScore === null && "text-muted-foreground",
              auditScore !== null && auditScore >= 80 && "text-success",
              auditScore !== null && auditScore >= 60 && auditScore < 80 && "text-warning",
              auditScore !== null && auditScore < 60 && "text-destructive"
            )}>
              {auditScore !== null ? `${auditScore}%` : '—'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
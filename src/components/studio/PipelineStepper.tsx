import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle,
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles
} from 'lucide-react';

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface PipelineStepperProps {
  stages: StageStatus[];
  className?: string;
}

const stageIcons = [
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles,
];

export function PipelineStepper({ stages, className }: PipelineStepperProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: Horizontal Stepper */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute top-5 left-8 right-8 h-0.5 bg-border" />
        <div 
          className="absolute top-5 left-8 h-0.5 bg-success transition-all duration-500"
          style={{
            width: `${Math.max(0, (stages.filter(s => s.status === 'complete').length - 1) / (stages.length - 1) * 100)}%`,
            maxWidth: 'calc(100% - 64px)'
          }}
        />
        
        {stages.map((stage, index) => {
          const Icon = stageIcons[index] || FileText;
          const isActive = stage.status === 'active';
          const isComplete = stage.status === 'complete';
          const isError = stage.status === 'error';
          const isSkipped = stage.status === 'skipped';
          
          return (
            <div 
              key={stage.name}
              className={cn(
                "flex flex-col items-center gap-2 relative z-10",
                isSkipped && "opacity-40"
              )}
            >
              {/* Step Circle */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                "border-2 bg-background",
                stage.status === 'pending' && "border-border text-muted-foreground",
                isActive && "border-primary bg-primary/10 text-primary ring-4 ring-primary/20",
                isComplete && "border-success bg-success text-success-foreground",
                isError && "border-destructive bg-destructive text-destructive-foreground",
                isSkipped && "border-border bg-muted text-muted-foreground"
              )}>
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isError ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              
              {/* Label */}
              <div className="text-center">
                <p className={cn(
                  "text-xs font-medium transition-colors",
                  stage.status === 'pending' && "text-muted-foreground",
                  isActive && "text-primary",
                  isComplete && "text-success",
                  isError && "text-destructive",
                  isSkipped && "text-muted-foreground line-through"
                )}>
                  {stage.shortName}
                </p>
                {stage.details && !isSkipped && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[80px] truncate">
                    {stage.details}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Compact List */}
      <div className="md:hidden space-y-2">
        {stages.filter(s => s.status !== 'pending').map((stage, index) => {
          const Icon = stageIcons[stages.findIndex(s => s.name === stage.name)] || FileText;
          const isActive = stage.status === 'active';
          const isComplete = stage.status === 'complete';
          const isError = stage.status === 'error';
          
          return (
            <div 
              key={stage.name}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all",
                isActive && "bg-primary/5 border border-primary/20",
                isComplete && "bg-success/5",
                isError && "bg-destructive/5"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                isActive && "bg-primary/10 text-primary",
                isComplete && "bg-success/10 text-success",
                isError && "bg-destructive/10 text-destructive"
              )}>
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isError ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  isActive && "text-primary",
                  isComplete && "text-success",
                  isError && "text-destructive"
                )}>
                  {stage.name}
                </p>
                {stage.details && (
                  <p className="text-xs text-muted-foreground truncate">{stage.details}</p>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Pending indicator */}
        {stages.some(s => s.status === 'pending') && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {stages.filter(s => s.status === 'pending').length} steps remaining...
          </p>
        )}
      </div>
    </div>
  );
}

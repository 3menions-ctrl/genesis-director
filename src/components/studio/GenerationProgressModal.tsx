import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  X, Sparkles, Mic, Video, Layers, Film, 
  CheckCircle2, Zap, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerationVisualizer } from "./GenerationVisualizer";

interface GenerationProgressModalProps {
  open: boolean;
  onClose: () => void;
  step: 'idle' | 'voice' | 'video' | 'polling';
  percent: number;
  estimatedSecondsRemaining: number | null;
  currentClip?: number;
  totalClips?: number;
  onCancel: () => void;
  error?: string | null;
}

const STEPS = [
  { id: 'voice', label: 'Voice', icon: Mic, description: 'Generating narration' },
  { id: 'video', label: 'Video', icon: Video, description: 'Creating visuals' },
  { id: 'polling', label: 'Rendering', icon: Layers, description: 'Final processing' },
];

export function GenerationProgressModal({
  open,
  onClose,
  step,
  percent,
  estimatedSecondsRemaining,
  currentClip,
  totalClips,
  onCancel,
  error,
}: GenerationProgressModalProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  const getStepStatus = (index: number) => {
    if (error) return 'error';
    if (index < currentStepIndex) return 'complete';
    if (index === currentStepIndex) return 'active';
    return 'pending';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <div className="glass-card-dark p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg animate-pulse-soft">
                <Film className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  {error ? 'Generation Error' : 'Creating Your Video'}
                </h2>
                <p className="text-sm text-white/60 mt-0.5">
                  {error ? 'Something went wrong' : 'AI is crafting your masterpiece'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/40 hover:text-white hover:bg-white/10 -mt-2 -mr-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Animated Visualizer */}
          {!error && (
            <GenerationVisualizer
              step={step}
              percent={percent}
              currentClip={currentClip}
              totalClips={totalClips}
            />
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-xl bg-destructive/20 border border-destructive/30 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Generation Failed</p>
                <p className="text-sm text-white/70 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          {!error && (
            <div className="grid grid-cols-3 gap-3">
              {STEPS.map((s, index) => {
                const status = getStepStatus(index);
                const StepIcon = s.icon;
                
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300",
                      status === 'active' && "bg-white/10 border border-white/20",
                      status === 'complete' && "bg-success/10 border border-success/20",
                      status === 'pending' && "opacity-40"
                    )}
                  >
                    {/* Step Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      status === 'complete' && "bg-success shadow-lg shadow-success/25",
                      status === 'active' && "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 animate-pulse-soft",
                      status === 'pending' && "bg-white/10"
                    )}>
                      {status === 'complete' ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <StepIcon className={cn(
                          "w-6 h-6",
                          status === 'active' ? "text-white" : "text-white/50"
                        )} />
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="text-center">
                      <h3 className={cn(
                        "font-semibold text-sm",
                        status === 'complete' && "text-success",
                        status === 'active' && "text-white",
                        status === 'pending' && "text-white/50"
                      )}>
                        {s.label}
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5">{s.description}</p>
                    </div>
                    
                    {/* Active step progress */}
                    {status === 'active' && (
                      <div className="w-full space-y-1">
                        <Progress 
                          value={percent} 
                          className="h-1 bg-white/10" 
                        />
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-mono text-primary">{percent}%</span>
                          {currentClip && totalClips && step === 'video' && (
                            <span className="text-xs text-white/40">
                              • Clip {currentClip}/{totalClips}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {status === 'complete' && (
                      <span className="text-xs text-success font-medium">Complete</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-white/40">
              <Zap className="w-4 h-4" />
              <span className="text-sm">
                {error 
                  ? 'Try again or check your credits'
                  : estimatedSecondsRemaining !== null
                    ? estimatedSecondsRemaining > 60
                      ? `~${Math.ceil(estimatedSecondsRemaining / 60)} min remaining`
                      : `~${Math.ceil(estimatedSecondsRemaining)}s remaining`
                    : 'Processing...'
                }
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={error ? onClose : onCancel}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              {error ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

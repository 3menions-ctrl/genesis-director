import { useState, memo, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, RefreshCw, Wand2, ChevronDown, ChevronUp, 
  Shield, Copyright, Skull, XCircle, Loader2, Sparkles, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMounted } from '@/lib/safeAsync';
import { SafeComponent } from '@/components/ui/error-boundary';

interface FailedClip {
  index: number;
  error?: string;
  prompt?: string;
  id?: string;
}

interface FailedClipsPanelProps {
  clips: FailedClip[];
  projectId: string;
  userId: string;
  onRetry: (index: number, newPrompt?: string) => void;
  isRetrying?: boolean;
  retryingIndex?: number | null;
  className?: string;
}

// Categorize errors into types
function categorizeError(error?: string): {
  type: 'content_policy' | 'copyright' | 'violence' | 'rate_limit' | 'credits' | 'technical' | 'unknown';
  icon: React.ElementType;
  label: string;
  color: string;
  suggestion: string;
} {
  if (!error) return {
    type: 'unknown',
    icon: XCircle,
    label: 'Unknown Error',
    color: 'text-red-400',
    suggestion: 'Try retrying the clip or editing the prompt.'
  };

  const errorLower = error.toLowerCase();

  if (errorLower.includes('content') || errorLower.includes('policy') || errorLower.includes('usage guidelines') || errorLower.includes('violate')) {
    return {
      type: 'content_policy',
      icon: Shield,
      label: 'Content Policy',
      color: 'text-orange-400',
      suggestion: 'The prompt contains words that violate content guidelines. Use AI Rephrase to generate a safe alternative.'
    };
  }

  if (errorLower.includes('copyright') || errorLower.includes('trademark') || errorLower.includes('intellectual property')) {
    return {
      type: 'copyright',
      icon: Copyright,
      label: 'Copyright Issue',
      color: 'text-amber-400',
      suggestion: 'Replace copyrighted character/brand names with original alternatives.'
    };
  }

  if (errorLower.includes('violence') || errorLower.includes('weapon') || errorLower.includes('blood') || errorLower.includes('gore')) {
    return {
      type: 'violence',
      icon: Skull,
      label: 'Violence Detected',
      color: 'text-red-400',
      suggestion: 'Rephrase action scenes to avoid explicit violence. Use words like "clash" instead of "fight".'
    };
  }

  if (errorLower.includes('rate limit') || errorLower.includes('429') || errorLower.includes('too many')) {
    return {
      type: 'rate_limit',
      icon: RefreshCw,
      label: 'Rate Limited',
      color: 'text-blue-400',
      suggestion: 'Wait a moment and retry. The API is temporarily busy.'
    };
  }

  if (errorLower.includes('credit') || errorLower.includes('payment') || errorLower.includes('402')) {
    return {
      type: 'credits',
      icon: AlertTriangle,
      label: 'Insufficient Credits',
      color: 'text-yellow-400',
      suggestion: 'Add more credits to continue generating clips.'
    };
  }

  if (errorLower.includes('internal') || errorLower.includes('server') || errorLower.includes('500') || errorLower.includes('timeout')) {
    return {
      type: 'technical',
      icon: XCircle,
      label: 'Technical Error',
      color: 'text-gray-400',
      suggestion: 'A temporary server error occurred. Retry should work.'
    };
  }

  return {
    type: 'unknown',
    icon: XCircle,
    label: 'Generation Failed',
    color: 'text-red-400',
    suggestion: 'Try retrying or edit the prompt manually.'
  };
}

// Inner component
const FailedClipsPanelInner = memo(forwardRef<HTMLDivElement, FailedClipsPanelProps>(
  function FailedClipsPanelInner({
    clips,
    projectId,
    userId,
    onRetry,
    isRetrying = false,
    retryingIndex = null,
    className
  }, ref) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editedPrompts, setEditedPrompts] = useState<Record<number, string>>({});
    const [isRephrasing, setIsRephrasing] = useState<number | null>(null);
    const isMountedRef = useIsMounted();

    const failedClips = clips.filter(c => c.error || c.prompt);

    const handleAIRephrase = useCallback(async (clip: FailedClip) => {
      if (!clip.prompt) {
        toast.error('No prompt available to rephrase');
        return;
      }

      setIsRephrasing(clip.index);

      try {
        const { data, error } = await supabase.functions.invoke('script-assistant', {
          body: {
            action: 'rephrase_safe',
            prompt: clip.prompt,
            context: 'This prompt was rejected by the AI video generator content filter. Create a safe alternative that maintains the visual intent but removes any problematic content.'
          }
        });

        if (!isMountedRef.current) return;

        if (error) throw error;

        if (data?.rephrasedPrompt) {
          setEditedPrompts(prev => ({ ...prev, [clip.index]: data.rephrasedPrompt }));
          setEditingIndex(clip.index);
          toast.success('AI generated a safe alternative!');
        } else {
          throw new Error('No rephrased prompt returned');
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error('AI rephrase failed:', err);
        toast.error('AI rephrase failed. Try editing manually.');
      } finally {
        if (isMountedRef.current) {
          setIsRephrasing(null);
        }
      }
    }, [isMountedRef]);

    const handleRetryWithEdit = useCallback((clip: FailedClip) => {
      const newPrompt = editedPrompts[clip.index];
      onRetry(clip.index, newPrompt);
      setEditingIndex(null);
    }, [editedPrompts, onRetry]);

    if (failedClips.length === 0) return null;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-red-400">
                {failedClips.length} Failed Clip{failedClips.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-white/50">
                Click to see reasons and fix options
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5"
            >
              <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
                {failedClips.map((clip, idx) => {
                  const errorInfo = categorizeError(clip.error);
                  const isCurrentlyRetrying = retryingIndex === clip.index;
                  const isCurrentlyRephrasing = isRephrasing === clip.index;
                  const isEditing = editingIndex === clip.index;
                  const hasEditedPrompt = !!editedPrompts[clip.index];
                  const ErrorIcon = errorInfo.icon;

                  return (
                    <motion.div
                      key={clip.index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3"
                    >
                      {/* Error Header */}
                      <div className="flex items-start gap-3">
                        <div className={cn("p-1.5 rounded-lg bg-white/5", errorInfo.color)}>
                          <ErrorIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-white/80">
                              Clip {clip.index + 1}
                            </span>
                            <span className={cn("text-xs font-medium", errorInfo.color)}>
                              {errorInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-white/50 line-clamp-2">
                            {clip.error || 'Unknown error occurred'}
                          </p>
                        </div>
                      </div>

                      {/* Suggestion */}
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-white/60">{errorInfo.suggestion}</p>
                      </div>

                      {/* Original Prompt (if available) */}
                      {clip.prompt && !isEditing && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                            Original Prompt
                          </p>
                          <p className="text-xs text-white/50 line-clamp-3 bg-black/20 rounded p-2">
                            {clip.prompt}
                          </p>
                        </div>
                      )}

                      {/* Editing Mode */}
                      {isEditing && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                            Edited Prompt
                          </p>
                          <Textarea
                            value={editedPrompts[clip.index] || clip.prompt || ''}
                            onChange={(e) => setEditedPrompts(prev => ({ 
                              ...prev, 
                              [clip.index]: e.target.value 
                            }))}
                            rows={4}
                            className="text-xs bg-black/30 border-white/10 resize-none"
                            placeholder="Enter a safe prompt..."
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* AI Rephrase Button */}
                        {clip.prompt && (errorInfo.type === 'content_policy' || errorInfo.type === 'copyright' || errorInfo.type === 'violence') && !isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                            onClick={() => handleAIRephrase(clip)}
                            disabled={isCurrentlyRephrasing || isCurrentlyRetrying}
                          >
                            {isCurrentlyRephrasing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            AI Rephrase
                          </Button>
                        )}

                        {/* Edit Manually Button */}
                        {clip.prompt && !isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-white/20 text-white/60 hover:bg-white/5"
                            onClick={() => {
                              setEditingIndex(clip.index);
                              setEditedPrompts(prev => ({ ...prev, [clip.index]: clip.prompt || '' }));
                            }}
                            disabled={isCurrentlyRetrying}
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </Button>
                        )}

                        {/* Cancel Edit Button */}
                        {isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-white/50"
                            onClick={() => setEditingIndex(null)}
                          >
                            Cancel
                          </Button>
                        )}

                        {/* Retry Button */}
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 text-xs gap-1.5 ml-auto",
                            isEditing || hasEditedPrompt
                              ? "bg-emerald-600 hover:bg-emerald-500"
                              : "bg-white/10 hover:bg-white/15"
                          )}
                          onClick={() => isEditing ? handleRetryWithEdit(clip) : onRetry(clip.index)}
                          disabled={isCurrentlyRetrying || isCurrentlyRephrasing}
                        >
                          {isCurrentlyRetrying ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          {isEditing ? 'Retry with Edit' : 'Retry'}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
));

// Exported wrapper with SafeComponent
export function FailedClipsPanel(props: FailedClipsPanelProps) {
  if (props.clips.filter(c => c.error || c.prompt).length === 0) return null;
  
  return (
    <SafeComponent name="FailedClipsPanel" fallback={null}>
      <FailedClipsPanelInner {...props} />
    </SafeComponent>
  );
}

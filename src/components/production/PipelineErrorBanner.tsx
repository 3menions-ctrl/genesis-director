import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, AlertTriangle, XCircle, RefreshCw, 
  ChevronDown, ChevronUp, Copy, ExternalLink, X,
  Zap, Clock, CreditCard, Shield, Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PipelineError {
  code: string;
  message: string;
  stage?: string;
  timestamp?: string;
  isRetryable?: boolean;
  suggestion?: string;
}

interface DegradationFlag {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

interface PipelineErrorBannerProps {
  error?: PipelineError | string | null;
  degradationFlags?: DegradationFlag[];
  projectStatus?: string;
  failedClipCount?: number;
  totalClipCount?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  className?: string;
}

// Parse error string into structured error
function parseError(error: string | PipelineError | null | undefined): PipelineError | null {
  if (!error) return null;
  
  if (typeof error === 'object') return error;
  
  const errorLower = error.toLowerCase();
  
  // Continuity failures
  if (errorLower.includes('continuity') || errorLower.includes('frame')) {
    return {
      code: 'CONTINUITY_ERROR',
      message: error,
      isRetryable: true,
      suggestion: 'Frame extraction failed. The system will auto-recover on retry.',
    };
  }
  
  // Credit errors
  if (errorLower.includes('credit') || errorLower.includes('402') || errorLower.includes('balance')) {
    return {
      code: 'INSUFFICIENT_CREDITS',
      message: error,
      isRetryable: false,
      suggestion: 'Add more credits to continue generating clips.',
    };
  }
  
  // Rate limiting
  if (errorLower.includes('rate') || errorLower.includes('429') || errorLower.includes('too many')) {
    return {
      code: 'RATE_LIMITED',
      message: error,
      isRetryable: true,
      suggestion: 'API rate limit reached. Wait a moment and retry.',
    };
  }
  
  // Content policy
  if (errorLower.includes('content') || errorLower.includes('policy') || errorLower.includes('violate')) {
    return {
      code: 'CONTENT_POLICY',
      message: error,
      isRetryable: false,
      suggestion: 'Prompt contains restricted content. Edit the prompt and retry.',
    };
  }
  
  // Production incomplete
  if (errorLower.includes('production incomplete') || errorLower.includes('failed:')) {
    const failedMatch = error.match(/Failed:\s*([\d,\s]+)/);
    const failedClips = failedMatch ? failedMatch[1] : 'multiple';
    return {
      code: 'PRODUCTION_INCOMPLETE',
      message: error,
      isRetryable: true,
      suggestion: `Clips ${failedClips} failed to generate. Use Resume to continue production.`,
    };
  }
  
  // Model/API errors
  if (errorLower.includes('model') || errorLower.includes('deprecated') || errorLower.includes('422')) {
    return {
      code: 'MODEL_ERROR',
      message: error,
      isRetryable: true,
      suggestion: 'The AI model encountered an issue. Retry should use fallback.',
    };
  }
  
  // Timeout errors
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return {
      code: 'TIMEOUT',
      message: error,
      isRetryable: true,
      suggestion: 'Request timed out. The server is busy - retry in a moment.',
    };
  }
  
  // Default
  return {
    code: 'UNKNOWN',
    message: error,
    isRetryable: true,
    suggestion: 'An unexpected error occurred. Try resuming the pipeline.',
  };
}

// Get icon and color for error code
function getErrorStyle(code: string): { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  borderColor: string;
} {
  switch (code) {
    case 'INSUFFICIENT_CREDITS':
      return { 
        icon: CreditCard, 
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
      };
    case 'RATE_LIMITED':
      return { 
        icon: Clock, 
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
      };
    case 'CONTENT_POLICY':
      return { 
        icon: Shield, 
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
      };
    case 'CONTINUITY_ERROR':
    case 'MODEL_ERROR':
      return { 
        icon: Server, 
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
      };
    case 'TIMEOUT':
      return { 
        icon: Zap, 
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
      };
    case 'PRODUCTION_INCOMPLETE':
      return { 
        icon: AlertTriangle, 
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
      };
    default:
      return { 
        icon: XCircle, 
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
      };
  }
}

export function PipelineErrorBanner({
  error,
  degradationFlags = [],
  projectStatus,
  failedClipCount = 0,
  totalClipCount = 0,
  onRetry,
  onDismiss,
  isRetrying = false,
  className,
}: PipelineErrorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const parsedError = parseError(error);
  const hasError = parsedError !== null || projectStatus === 'failed';
  const hasDegradation = degradationFlags.length > 0;
  
  // CRITICAL FIX: Auto-hide when all clips complete successfully
  // This handles the case where 100% completion (3/3 clips) should clear PIPELINE_FAILED state
  const allClipsComplete = totalClipCount > 0 && failedClipCount === 0 && 
    (projectStatus === 'completed' || projectStatus === 'stitching');
  
  // Also detect when error is stale (all clips done but error still showing)
  const isStaleError = parsedError && totalClipCount > 0 && failedClipCount === 0 &&
    ['CONTINUITY_ERROR', 'PRODUCTION_INCOMPLETE', 'TIMEOUT'].includes(parsedError.code);
  
  // =====================================================
  // CRITICAL: Never show STRICT_CONTINUITY_FAILURE errors
  // These are internal pipeline states, NOT user-actionable
  // The pipeline will auto-recover or refund automatically
  // =====================================================
  const isNonFatalPipelineError = parsedError?.code === 'CONTINUITY_ERROR' || 
    (parsedError?.message && (
      /STRICT_CONTINUITY_FAILURE/i.test(parsedError.message) ||
      /no last frame/i.test(parsedError.message) ||
      /frame extraction/i.test(parsedError.message) ||
      /continuity.?failure/i.test(parsedError.message) ||
      /production incomplete/i.test(parsedError.message)
    ));
  
  if (isDismissed || (!hasError && !hasDegradation) || allClipsComplete || isStaleError || isNonFatalPipelineError) return null;
  
  const errorStyle = parsedError ? getErrorStyle(parsedError.code) : getErrorStyle('UNKNOWN');
  const Icon = errorStyle.icon;
  
  const handleCopyError = () => {
    const errorText = parsedError?.message || 'Unknown error';
    navigator.clipboard.writeText(errorText);
    toast.success('Error details copied to clipboard');
  };
  
  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
          "rounded-2xl overflow-hidden border",
          errorStyle.borderColor,
          errorStyle.bgColor,
          className
        )}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              errorStyle.bgColor
            )}>
              <Icon className={cn("w-5 h-5", errorStyle.color)} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold", errorStyle.color)}>
                {projectStatus === 'failed' ? 'Pipeline Failed' : 
                 parsedError?.code === 'PRODUCTION_INCOMPLETE' ? 'Production Incomplete' :
                 hasDegradation && !hasError ? 'Quality Warnings' : 'Error Occurred'}
              </p>
              <p className="text-xs text-white/50 truncate">
                {parsedError?.message || 
                 (failedClipCount > 0 ? `${failedClipCount} of ${totalClipCount} clips failed` : 
                  hasDegradation ? `${degradationFlags.length} issue${degradationFlags.length > 1 ? 's' : ''} detected` :
                  'Unknown error')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {parsedError?.isRetryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 text-xs gap-1.5",
                  errorStyle.borderColor,
                  errorStyle.color,
                  "hover:bg-white/5"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                disabled={isRetrying}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
                {isRetrying ? 'Retrying...' : 'Resume'}
              </Button>
            )}
            
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </div>
        </div>
        
        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5"
            >
              <div className="p-4 space-y-4">
                {/* Error Details */}
                {parsedError && (
                  <div className="space-y-3">
                    {/* Suggestion */}
                    {parsedError.suggestion && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <AlertCircle className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-white/80 mb-1">Suggested Action</p>
                          <p className="text-xs text-white/60">{parsedError.suggestion}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Technical Details */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-white/40 hover:text-white/70"
                        onClick={handleCopyError}
                      >
                        <Copy className="w-3 h-3" />
                        Copy Error Details
                      </Button>
                      
                      {parsedError.stage && (
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">
                          Stage: {parsedError.stage}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Degradation Flags */}
                {hasDegradation && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                      Quality Compromises
                    </p>
                    {degradationFlags.map((flag, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg",
                          flag.severity === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                          flag.severity === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                          'bg-blue-500/10 border border-blue-500/20'
                        )}
                      >
                        <AlertTriangle className={cn(
                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                          flag.severity === 'error' ? 'text-red-400' :
                          flag.severity === 'warning' ? 'text-amber-400' :
                          'text-blue-400'
                        )} />
                        <div>
                          <p className="text-xs font-medium text-white/70">{flag.type}</p>
                          <p className="text-[11px] text-white/50">{flag.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
  );
}

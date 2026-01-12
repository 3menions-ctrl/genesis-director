import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingDown, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DegradationIssue {
  type: 'color_drift' | 'character_inconsistency' | 'motion_discontinuity' | 'scene_mismatch';
  severity: 'low' | 'medium' | 'high';
  shotIndex: number;
  description: string;
  suggestion?: string;
}

interface DegradationBannerProps {
  issues?: DegradationIssue[];
  onRetry?: (shotIndex: number) => void;
  onDismiss?: () => void;
  className?: string;
}

const ISSUE_CONFIG = {
  color_drift: {
    label: 'Color Drift',
    icon: '🎨',
  },
  character_inconsistency: {
    label: 'Character Mismatch',
    icon: '👤',
  },
  motion_discontinuity: {
    label: 'Motion Break',
    icon: '🎬',
  },
  scene_mismatch: {
    label: 'Scene Mismatch',
    icon: '🖼️',
  },
};

const SEVERITY_STYLES = {
  low: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  medium: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  high: 'border-red-500/40 bg-red-500/15 text-red-400',
};

export function DegradationBanner({ 
  issues = [], 
  onRetry, 
  onDismiss,
  className 
}: DegradationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const activeIssues = issues.filter((_, i) => !dismissedIds.has(i));
  
  if (activeIssues.length === 0) return null;

  const highSeverityCount = activeIssues.filter(i => i.severity === 'high').length;
  const hasHighSeverity = highSeverityCount > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "rounded-xl border overflow-hidden",
          hasHighSeverity 
            ? "border-red-500/30 bg-red-500/5" 
            : "border-amber-500/20 bg-amber-500/5",
          className
        )}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              hasHighSeverity ? "bg-red-500/20" : "bg-amber-500/20"
            )}>
              <AlertTriangle className={cn(
                "w-4 h-4",
                hasHighSeverity ? "text-red-400" : "text-amber-400"
              )} />
            </div>
            <div>
              <p className={cn(
                "text-sm font-medium",
                hasHighSeverity ? "text-red-400" : "text-amber-400"
              )}>
                {activeIssues.length} Consistency {activeIssues.length === 1 ? 'Issue' : 'Issues'} Detected
              </p>
              <p className="text-xs text-white/50">
                {highSeverityCount > 0 && `${highSeverityCount} critical • `}
                Click to {isExpanded ? 'collapse' : 'expand'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
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
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {activeIssues.map((issue, index) => {
                  const config = ISSUE_CONFIG[issue.type];
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border",
                        SEVERITY_STYLES[issue.severity]
                      )}
                    >
                      <span className="text-lg">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{config.label}</span>
                          <span className="text-xs text-white/40">Shot {issue.shotIndex + 1}</span>
                        </div>
                        <p className="text-xs text-white/60">{issue.description}</p>
                        {issue.suggestion && (
                          <p className="text-xs text-white/40 mt-1 italic">{issue.suggestion}</p>
                        )}
                      </div>
                      {onRetry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onRetry(issue.shotIndex)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Terminal, Sparkles, Layers, Activity, ChevronDown, MapPin, 
  Lightbulb, Heart, Zap, Package, Clock, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShotContinuityManifest } from '@/types/continuity-manifest';

// ============= TYPES =============

interface PipelineLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ContinuitySummary {
  spatial?: string;
  lighting?: string;
  emotion?: string;
  action?: string;
  anchors?: string[];
}

interface ProductionInsightsPanelProps {
  logs: PipelineLog[];
  isLive: boolean;
  manifest: ShotContinuityManifest | null;
  shotIndex: number;
  isExtractingManifest?: boolean;
  onShotChange?: (index: number) => void;
  availableShots?: number[];
  consistencyScore?: number;
  bridgeClipsNeeded?: number;
}

// ============= HELPER FUNCTIONS =============

function extractSummary(manifest: ShotContinuityManifest | null): ContinuitySummary {
  if (!manifest) return {};
  
  return {
    spatial: manifest.spatial?.primaryCharacter 
      ? `${manifest.spatial.primaryCharacter.screenPosition || 'center'} • ${manifest.spatial.primaryCharacter.depth || 'mid'} • ${manifest.spatial.cameraDistance || 'medium'} shot`
      : undefined,
    lighting: manifest.lighting?.primarySource
      ? `${manifest.lighting.colorTemperature || 'neutral'} ${manifest.lighting.primarySource.type || 'natural'} from ${manifest.lighting.primarySource.direction || 'front'}`
      : undefined,
    emotion: manifest.emotional?.primaryEmotion
      ? `${manifest.emotional.intensity || 'moderate'} ${manifest.emotional.primaryEmotion}`
      : undefined,
    action: manifest.action?.movementType
      ? `${manifest.action.movementType}${manifest.action.gestureInProgress ? ` • ${manifest.action.gestureInProgress}` : ''}`
      : undefined,
    anchors: manifest.criticalAnchors?.slice(0, 4),
  };
}

// ============= SUB-COMPONENTS =============

function InsightCard({ 
  icon: Icon, 
  label, 
  value, 
  color = 'zinc',
  pulse = false,
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number | undefined;
  color?: 'zinc' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'purple';
  pulse?: boolean;
}) {
  if (!value) return null;
  
  const colorMap = {
    zinc: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <div className={cn(
        "flex items-start gap-2.5 p-2.5 rounded-lg border backdrop-blur-sm transition-all duration-200",
        "hover:bg-white/[0.02]",
        colorMap[color].split(' ').slice(1).join(' ')
      )}>
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
          colorMap[color].split(' ')[1]
        )}>
          <Icon className={cn("w-3 h-3", colorMap[color].split(' ')[0], pulse && "animate-pulse")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</p>
          <p className={cn("text-xs font-medium mt-0.5 truncate", colorMap[color].split(' ')[0])}>
            {value}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityLogCompact({ logs, isLive }: { logs: PipelineLog[]; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const recentLogs = logs.slice(-15);
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Terminal className={cn("w-3.5 h-3.5", isLive ? "text-emerald-400" : "text-zinc-500")} />
        <span className="text-[11px] font-medium text-zinc-300">Pipeline Activity</span>
        {isLive && (
          <motion.div 
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <ScrollArea ref={scrollRef} className="h-28">
        <AnimatePresence mode="popLayout">
          {recentLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="text-[9px] font-mono text-zinc-600 shrink-0 w-8">
                {log.time.split(':').slice(1).join(':')}
              </span>
              <div className={cn(
                "w-1 h-1 rounded-full mt-1.5 shrink-0",
                log.type === 'success' && "bg-emerald-400",
                log.type === 'error' && "bg-rose-400",
                log.type === 'warning' && "bg-amber-400",
                log.type === 'info' && "bg-zinc-500"
              )} />
              <span className={cn(
                "text-[10px] leading-tight",
                log.type === 'success' && "text-emerald-400/80",
                log.type === 'error' && "text-rose-400/80",
                log.type === 'warning' && "text-amber-400/80",
                log.type === 'info' && "text-zinc-500"
              )}>
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="flex items-center justify-center h-24 text-zinc-600 text-[10px]">
            Waiting for pipeline events...
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ============= MAIN COMPONENT =============

export function ProductionInsightsPanel({
  logs,
  isLive,
  manifest,
  shotIndex,
  isExtractingManifest,
  onShotChange,
  availableShots = [],
  consistencyScore,
  bridgeClipsNeeded,
}: ProductionInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const summary = extractSummary(manifest);
  const hasManifest = !!manifest;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Premium glass container */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-900/90",
        "border border-white/[0.06] backdrop-blur-xl",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      )}>
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        
        {/* Header */}
        <div 
          className="relative flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Production Insights</h3>
              <p className="text-[10px] text-zinc-500">
                {hasManifest ? `Shot ${shotIndex + 1} continuity active` : 'Pipeline monitoring'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Consistency Score Badge */}
            {consistencyScore !== undefined && (
              <div className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold",
                consistencyScore >= 0.8 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                  : consistencyScore >= 0.6 
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
              )}>
                {Math.round(consistencyScore * 100)}% consistent
              </div>
            )}
            
            {/* Bridge Clips Warning */}
            {bridgeClipsNeeded !== undefined && bridgeClipsNeeded > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                <AlertCircle className="w-3 h-3 mr-1" />
                {bridgeClipsNeeded} bridges needed
              </Badge>
            )}
            
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </motion.div>
          </div>
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="relative px-4 pb-4 space-y-4">
                {/* Shot Selector */}
                {availableShots.length > 1 && onShotChange && (
                  <div className="flex items-center gap-1.5 pb-3 border-b border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 mr-2">Shot:</span>
                    {availableShots.slice(0, 10).map((idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShotChange(idx);
                        }}
                        className={cn(
                          "w-6 h-6 rounded text-[10px] font-medium transition-all",
                          shotIndex === idx 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    {availableShots.length > 10 && (
                      <span className="text-[10px] text-zinc-600 ml-1">+{availableShots.length - 10}</span>
                    )}
                  </div>
                )}

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Continuity Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[11px] font-medium text-zinc-300">Continuity State</span>
                      {isExtractingManifest && (
                        <Sparkles className="w-3 h-3 text-primary animate-pulse ml-auto" />
                      )}
                    </div>
                    
                    {hasManifest ? (
                      <div className="grid grid-cols-2 gap-2">
                        <InsightCard 
                          icon={MapPin} 
                          label="Position" 
                          value={summary.spatial}
                          color="sky"
                        />
                        <InsightCard 
                          icon={Lightbulb} 
                          label="Lighting" 
                          value={summary.lighting}
                          color="amber"
                        />
                        <InsightCard 
                          icon={Heart} 
                          label="Emotion" 
                          value={summary.emotion}
                          color="rose"
                        />
                        <InsightCard 
                          icon={Zap} 
                          label="Action" 
                          value={summary.action}
                          color="violet"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="text-center">
                          <Eye className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                          <p className="text-[11px] text-zinc-500">Select a completed shot to view continuity</p>
                        </div>
                      </div>
                    )}

                    {/* Critical Anchors */}
                    {summary.anchors && summary.anchors.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-1 mb-2">
                          <Package className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] text-zinc-500">Critical Anchors</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {summary.anchors.map((anchor, i) => (
                            <Badge 
                              key={i} 
                              variant="outline" 
                              className="text-[9px] bg-purple-500/10 border-purple-500/20 text-purple-400"
                            >
                              {anchor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Activity Log */}
                  <div className="lg:border-l lg:border-white/[0.04] lg:pl-4">
                    <ActivityLogCompact logs={logs} isLive={isLive} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

import { memo, forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SceneDNAPanel } from './SceneDNAPanel';
import { CharacterIdentityStatus } from './CharacterIdentityStatus';
import { ConsistencyScoreCard } from './ConsistencyScoreCard';
import { DegradationBanner } from './DegradationBanner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Dna } from 'lucide-react';

interface SceneAnchor {
  dominantColors?: string[];
  lighting?: string;
  environment?: string;
  cameraStyle?: string;
  objectAnchors?: string[];
}

interface CharacterProfile {
  name: string;
  appearance?: string;
  verified?: boolean;
  consistencyScore?: number;
  lastSeen?: number;
}

interface DegradationIssue {
  type: 'color_drift' | 'character_inconsistency' | 'motion_discontinuity' | 'scene_mismatch';
  severity: 'low' | 'medium' | 'high';
  shotIndex: number;
  description: string;
  suggestion?: string;
}

interface ConsistencyDashboardProps {
  masterAnchor?: SceneAnchor | null;
  characters?: CharacterProfile[];
  identityBibleActive?: boolean;
  nonFacialAnchors?: string[];
  consistencyScore?: number;
  consistencyMetrics?: {
    color?: number;
    motion?: number;
    character?: number;
    scene?: number;
  };
  scoreTrend?: 'up' | 'down' | 'stable';
  previousScore?: number;
  degradationIssues?: DegradationIssue[];
  onRetryShot?: (shotIndex: number) => void;
  isProTier?: boolean;
  className?: string;
}

export const ConsistencyDashboard = memo(forwardRef<HTMLDivElement, ConsistencyDashboardProps>(function ConsistencyDashboard({
  masterAnchor,
  characters = [],
  identityBibleActive = false,
  nonFacialAnchors = [],
  consistencyScore = 0,
  consistencyMetrics,
  scoreTrend = 'stable',
  previousScore,
  degradationIssues = [],
  onRetryShot,
  isProTier = false,
  className,
}: ConsistencyDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Always show when on a project page - provides context even without data
  const hasData = masterAnchor || characters.length > 0 || consistencyScore > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Degradation Banner - Always visible when issues exist */}
      {degradationIssues.length > 0 && (
        <DegradationBanner 
          issues={degradationIssues}
          onRetry={onRetryShot}
        />
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <Dna className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white">Consistency Dashboard</h3>
                <p className="text-xs text-white/50">
                  Scene DNA, characters & visual coherence
                </p>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-white/40 transition-transform",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Consistency Score - Left */}
            <ConsistencyScoreCard
              score={consistencyScore}
              metrics={consistencyMetrics}
              trend={scoreTrend}
              previousScore={previousScore}
            />

            {/* Scene DNA - Center */}
            <SceneDNAPanel
              masterAnchor={masterAnchor}
              isEstablished={!!masterAnchor}
            />

            {/* Character Identity - Right */}
            <CharacterIdentityStatus
              characters={characters}
              identityBibleActive={identityBibleActive}
              nonFacialAnchors={nonFacialAnchors}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}));

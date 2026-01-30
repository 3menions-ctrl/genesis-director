import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { User, UserCheck, Users, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface CharacterProfile {
  name: string;
  appearance?: string;
  verified?: boolean;
  consistencyScore?: number;
  lastSeen?: number;
}

interface CharacterIdentityStatusProps {
  characters?: CharacterProfile[];
  identityBibleActive?: boolean;
  nonFacialAnchors?: string[];
  className?: string;
}

// Demo data to show when no real characters are available
const DEMO_CHARACTERS: CharacterProfile[] = [
  { name: 'Main Character', appearance: 'Tall with dark hair, casual attire', verified: true, consistencyScore: 0.92 },
  { name: 'Supporting Role', appearance: 'Medium build, business casual', verified: true, consistencyScore: 0.87 },
];

const DEMO_ANCHORS = ['Red jacket', 'Silver watch', 'Messenger bag'];

export const CharacterIdentityStatus = memo(forwardRef<HTMLDivElement, CharacterIdentityStatusProps>(function CharacterIdentityStatus({
  characters = [], 
  identityBibleActive = false,
  nonFacialAnchors = [],
  className 
}: CharacterIdentityStatusProps) {
  // Use demo data if no real characters are available
  const activeCharacters = characters.length > 0 ? characters : DEMO_CHARACTERS;
  const activeAnchors = nonFacialAnchors.length > 0 ? nonFacialAnchors : DEMO_ANCHORS;
  const isDemo = characters.length === 0;
  const isActiveIdentity = identityBibleActive || isDemo;

  const verifiedCount = activeCharacters.filter(c => c.verified).length;
  const avgConsistency = activeCharacters.length > 0
    ? activeCharacters.reduce((sum, c) => sum + (c.consistencyScore || 0), 0) / activeCharacters.length
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl bg-white/[0.03] border border-white/10",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
        <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isActiveIdentity 
              ? "bg-emerald-500/20" 
              : "bg-amber-500/20"
          )}>
            {isActiveIdentity ? (
              <UserCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <User className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Character Identity</h3>
            <p className="text-xs text-white/50">
              {isActiveIdentity ? 'Identity Bible active' : 'Using reference anchors'}
              {isDemo && <span className="ml-1 text-amber-400">(Demo)</span>}
            </p>
          </div>
        </div>
        
        {activeCharacters.length > 0 && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              avgConsistency >= 0.8 
                ? "border-emerald-500/30 text-emerald-400"
                : avgConsistency >= 0.5
                ? "border-amber-500/30 text-amber-400"
                : "border-red-500/30 text-red-400"
            )}
          >
            {(avgConsistency * 100).toFixed(0)}% consistent
          </Badge>
        )}
      </div>

      {/* Characters List */}
      <div className="space-y-2 mb-3">
        {activeCharacters.slice(0, 3).map((character, i) => (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {character.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{character.name}</p>
                    {character.consistencyScore !== undefined && (
                      <Progress 
                        value={character.consistencyScore * 100} 
                        className="h-1 mt-1"
                      />
                    )}
                  </div>
                  {character.verified && (
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">{character.name}</p>
                {character.appearance && (
                  <p className="text-xs text-muted-foreground max-w-xs">{character.appearance}</p>
                )}
                {character.lastSeen !== undefined && (
                  <p className="text-xs text-muted-foreground">Last seen: Shot {character.lastSeen + 1}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {activeCharacters.length > 3 && (
          <p className="text-xs text-white/40 text-center">
            +{activeCharacters.length - 3} more characters
          </p>
        )}
      </div>

      {/* Non-facial Anchors */}
      {activeAnchors.length > 0 && (
        <div className="pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/40">Visual Anchors</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeAnchors.slice(0, 4).map((anchor, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-white/5 text-xs text-white/60"
              >
                {anchor}
              </span>
            ))}
            {activeAnchors.length > 4 && (
              <span className="text-xs text-white/40">+{activeAnchors.length - 4}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}));

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

export function CharacterIdentityStatus({ 
  characters = [], 
  identityBibleActive = false,
  nonFacialAnchors = [],
  className 
}: CharacterIdentityStatusProps) {
  const verifiedCount = characters.filter(c => c.verified).length;
  const avgConsistency = characters.length > 0
    ? characters.reduce((sum, c) => sum + (c.consistencyScore || 0), 0) / characters.length
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
            identityBibleActive 
              ? "bg-emerald-500/20" 
              : "bg-amber-500/20"
          )}>
            {identityBibleActive ? (
              <UserCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <User className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Character Identity</h3>
            <p className="text-xs text-white/50">
              {identityBibleActive ? 'Identity Bible active' : 'Using reference anchors'}
            </p>
          </div>
        </div>
        
        {characters.length > 0 && (
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
      {characters.length > 0 ? (
        <div className="space-y-2 mb-3">
          {characters.slice(0, 3).map((character, i) => (
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
          {characters.length > 3 && (
            <p className="text-xs text-white/40 text-center">
              +{characters.length - 3} more characters
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] text-white/40">
          <Users className="w-4 h-4" />
          <span className="text-xs">No characters detected</span>
        </div>
      )}

      {/* Non-facial Anchors */}
      {nonFacialAnchors.length > 0 && (
        <div className="pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/40">Visual Anchors</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nonFacialAnchors.slice(0, 4).map((anchor, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-white/5 text-xs text-white/60"
              >
                {anchor}
              </span>
            ))}
            {nonFacialAnchors.length > 4 && (
              <span className="text-xs text-white/40">+{nonFacialAnchors.length - 4}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

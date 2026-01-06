import { useState } from 'react';
import { 
  Film, AlertTriangle, CheckCircle, Info, 
  ChevronDown, ChevronUp, Sparkles, Eye,
  Zap, Shield, Palette, Camera, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CinematicAuditResult, CinematicSuggestion, AuditSeverity } from '@/types/production-pipeline';

interface CinematicAuditPanelProps {
  audit: CinematicAuditResult;
  onApprove: () => void;
  onApplySuggestion?: (shotId: string, optimizedDescription: string) => void;
  onApplyAllAndReaudit?: () => Promise<void>;
  onAutoOptimize?: () => Promise<void>;
  isApproved: boolean;
  isReauditing?: boolean;
  optimizationProgress?: { iteration: number; score: number; message: string } | null;
  className?: string;
}

const SEVERITY_CONFIG: Record<AuditSeverity, { icon: React.ReactNode; color: string; bg: string }> = {
  critical: { 
    icon: <AlertTriangle className="w-4 h-4" />, 
    color: 'text-destructive', 
    bg: 'bg-destructive/10 border-destructive/30' 
  },
  warning: { 
    icon: <Info className="w-4 h-4" />, 
    color: 'text-yellow-500', 
    bg: 'bg-yellow-500/10 border-yellow-500/30' 
  },
  suggestion: { 
    icon: <Sparkles className="w-4 h-4" />, 
    color: 'text-primary', 
    bg: 'bg-primary/10 border-primary/30' 
  },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  technique: <Camera className="w-3 h-3" />,
  physics: <Zap className="w-3 h-3" />,
  continuity: <Eye className="w-3 h-3" />,
  identity: <Shield className="w-3 h-3" />,
};

export function CinematicAuditPanel({ 
  audit, 
  onApprove,
  onApplySuggestion,
  onApplyAllAndReaudit,
  onAutoOptimize,
  isApproved,
  isReauditing,
  optimizationProgress,
  className 
}: CinematicAuditPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['suggestions']);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const handleApplySuggestion = (shotId: string, optimizedDescription: string) => {
    onApplySuggestion?.(shotId, optimizedDescription);
    setAppliedSuggestions(prev => new Set(prev).add(shotId));
  };

  const suggestionsWithRewrites = audit.suggestions?.filter(s => s.rewrittenPrompt) || [];
  const unappliedCount = suggestionsWithRewrites.filter(s => !appliedSuggestions.has(s.shotId)).length;
  const needsOptimization = audit.overallScore < 80 || audit.criticalIssues > 0;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const scoreColor = audit.overallScore >= 80 
    ? 'text-green-500' 
    : audit.overallScore >= 60 
      ? 'text-yellow-500' 
      : 'text-destructive';

  const scoreLabel = audit.overallScore >= 80 
    ? 'Production Ready' 
    : audit.overallScore >= 60 
      ? 'Review Suggested' 
      : 'Issues Detected';

  return (
    <Card className={cn("p-4", className)}>
      {/* Header with Score */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Film className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Director's Audit</h3>
            <p className="text-xs text-muted-foreground">AI-powered script analysis</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={cn("text-2xl font-bold", scoreColor)}>
            {audit.overallScore}%
          </div>
          <Badge 
            variant={audit.overallScore >= 80 ? 'default' : 'secondary'}
            className="text-xs"
          >
            {scoreLabel}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-muted">
          <div className="text-lg font-bold text-foreground">{audit.totalSuggestions}</div>
          <div className="text-xs text-muted-foreground">Suggestions</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-destructive/10">
          <div className="text-lg font-bold text-destructive">{audit.criticalIssues}</div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-500/10">
          <div className="text-lg font-bold text-green-500">
            {audit.optimizedShots?.filter(s => s.approved).length || 0}
          </div>
          <div className="text-xs text-muted-foreground">Optimized</div>
        </div>
      </div>

      {/* Auto-Optimize Button - Show when score < 80% */}
      {needsOptimization && onAutoOptimize && !isApproved && (
        <div className="mb-4">
          {optimizationProgress ? (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm font-medium text-primary">
                  {optimizationProgress.message.includes('Validating') 
                    ? 'Validating fixes...' 
                    : 'Auto-Optimizing...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{optimizationProgress.message}</p>
              <div className="flex items-center gap-2">
                <Progress value={optimizationProgress.score} className="flex-1 h-2" />
                <span className="text-xs font-mono text-foreground">{optimizationProgress.score}%</span>
              </div>
              {optimizationProgress.message.includes('Validated') && (
                <p className="text-xs text-green-500 mt-1">
                  ✓ Only accepting fixes that measurably improve score
                </p>
              )}
            </div>
          ) : (
            <Button
              variant="default"
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
              onClick={onAutoOptimize}
              disabled={isReauditing}
            >
              <Zap className="w-4 h-4" />
              Auto-Optimize to 80%+ (Validated)
            </Button>
          )}
          <p className="text-xs text-center text-muted-foreground mt-2">
            Tests each fix and only keeps changes that measurably improve the score
          </p>
        </div>
      )}

      <ScrollArea className="h-[300px] pr-2">
        {/* Suggestions Section */}
        {audit.suggestions && audit.suggestions.length > 0 && (
          <Collapsible 
            open={expandedSections.includes('suggestions')}
            onOpenChange={() => toggleSection('suggestions')}
            className="mb-3"
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Improvement Suggestions ({audit.suggestions.length})
                </span>
                {expandedSections.includes('suggestions') 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />
                }
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {/* Apply All Button */}
              {suggestionsWithRewrites.length > 0 && onApplyAllAndReaudit && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full mb-3 gap-2"
                  onClick={onApplyAllAndReaudit}
                  disabled={isReauditing}
                >
                  {isReauditing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Re-auditing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Apply All Fixes & Re-audit ({suggestionsWithRewrites.length})
                    </>
                  )}
                </Button>
              )}
              
              {audit.suggestions.map((suggestion, idx) => (
                <SuggestionCard 
                  key={idx} 
                  suggestion={suggestion}
                  onApply={handleApplySuggestion}
                  isApplied={appliedSuggestions.has(suggestion.shotId)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Film Techniques Section */}
        {audit.techniqueAnalysis && (
          <Collapsible 
            open={expandedSections.includes('techniques')}
            onOpenChange={() => toggleSection('techniques')}
            className="mb-3"
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="w-4 h-4 text-primary" />
                  Film Techniques
                </span>
                {expandedSections.includes('techniques') 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />
                }
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/50">
              {audit.techniqueAnalysis.identifiedTechniques?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">Identified:</p>
                  <div className="flex flex-wrap gap-1">
                    {audit.techniqueAnalysis.identifiedTechniques.map((tech, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{tech}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {audit.techniqueAnalysis.recommendedTechniques?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">Recommended:</p>
                  <div className="flex flex-wrap gap-1">
                    {audit.techniqueAnalysis.recommendedTechniques.map((tech, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{tech}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {audit.techniqueAnalysis.narrativeFlow && (
                <p className="text-xs text-foreground mt-2">{audit.techniqueAnalysis.narrativeFlow}</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Physics Check Section */}
        {audit.physicsCheck && (
          <Collapsible 
            open={expandedSections.includes('physics')}
            onOpenChange={() => toggleSection('physics')}
            className="mb-3"
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Physics Plausibility
                </span>
                {expandedSections.includes('physics') 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />
                }
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/50 space-y-2 text-xs">
              {audit.physicsCheck.gravityViolations?.length > 0 && (
                <div>
                  <p className="text-destructive font-medium">Gravity Issues:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {audit.physicsCheck.gravityViolations.map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                </div>
              )}
              {audit.physicsCheck.morphingRisks?.length > 0 && (
                <div>
                  <p className="text-yellow-500 font-medium">Morphing Risks:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {audit.physicsCheck.morphingRisks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {!audit.physicsCheck.gravityViolations?.length && 
               !audit.physicsCheck.morphingRisks?.length && (
                <p className="text-green-500">✓ No physics issues detected</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Identity Check Section */}
        {audit.identityCheck && (
          <Collapsible 
            open={expandedSections.includes('identity')}
            onOpenChange={() => toggleSection('identity')}
            className="mb-3"
          >
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4 text-primary" />
                  Identity Consistency
                </span>
                {expandedSections.includes('identity') 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />
                }
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/50 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                {audit.identityCheck.characterConsistency 
                  ? <CheckCircle className="w-3 h-3 text-green-500" />
                  : <AlertTriangle className="w-3 h-3 text-destructive" />
                }
                <span>Character Consistency</span>
              </div>
              <div className="flex items-center gap-2">
                {audit.identityCheck.environmentConsistency 
                  ? <CheckCircle className="w-3 h-3 text-green-500" />
                  : <AlertTriangle className="w-3 h-3 text-destructive" />
                }
                <span>Environment Consistency</span>
              </div>
              <div className="flex items-center gap-2">
                {audit.identityCheck.lightingConsistency 
                  ? <CheckCircle className="w-3 h-3 text-green-500" />
                  : <AlertTriangle className="w-3 h-3 text-yellow-500" />
                }
                <span>Lighting Consistency</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </ScrollArea>

      {/* Approve Button */}
      <div className="mt-4 pt-4 border-t space-y-2">
        {isApproved ? (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Audit Approved - Ready for Production!</span>
          </div>
        ) : audit.criticalIssues > 0 ? (
          <>
            <Button 
              variant="outline"
              className="w-full gap-2 border-destructive text-destructive"
              disabled
            >
              <AlertTriangle className="w-4 h-4" />
              {audit.criticalIssues} Critical Issue(s) Must Be Fixed
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Use "Auto-Optimize" above to fix critical issues automatically
            </p>
          </>
        ) : (
          <>
            <Button 
              onClick={onApprove}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Begin Production
              <ArrowRight className="w-4 h-4" />
            </Button>
            {audit.overallScore < 80 && (
              <p className="text-xs text-center text-muted-foreground">
                Score is {audit.overallScore}% (below 80% target, but no critical issues)
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function SuggestionCard({ 
  suggestion,
  onApply,
  isApplied
}: { 
  suggestion: CinematicSuggestion;
  onApply?: (shotId: string, optimizedDescription: string) => void;
  isApplied?: boolean;
}) {
  const config = SEVERITY_CONFIG[suggestion.severity];
  const categoryIcon = CATEGORY_ICONS[suggestion.category];

  return (
    <div className={cn("p-3 rounded-lg border", config.bg)}>
      <div className="flex items-start gap-2 mb-2">
        <span className={config.color}>{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs gap-1">
              {categoryIcon}
              {suggestion.category}
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono">
              {suggestion.shotId}
            </Badge>
          </div>
          <p className="text-sm text-foreground">{suggestion.suggestion}</p>
          {suggestion.filmTechnique && (
            <p className="text-xs text-muted-foreground mt-1">
              💡 Technique: {suggestion.filmTechnique}
            </p>
          )}
          {suggestion.physicsViolation && (
            <p className="text-xs text-destructive mt-1">
              ⚠️ Physics: {suggestion.physicsViolation}
            </p>
          )}
        </div>
      </div>
      
      {suggestion.rewrittenPrompt && onApply && (
        <Button
          variant={isApplied ? "secondary" : "outline"}
          size="sm"
          className="w-full mt-2 text-xs"
          onClick={() => onApply(suggestion.shotId, suggestion.rewrittenPrompt!)}
          disabled={isApplied}
        >
          {isApplied ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Applied
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Apply Optimized Prompt
            </>
          )}
        </Button>
      )}
    </div>
  );
}

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, CheckCircle, XCircle, RefreshCw, AlertTriangle,
  Shield, Zap, Loader2, TrendingUp
} from 'lucide-react';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { cn } from '@/lib/utils';
import { TIER_CREDIT_COSTS } from '@/hooks/useCreditBilling';

export function VisualDebuggerPanel() {
  const { state, isGenerating } = useProductionPipeline();
  const { production, qualityTier, qualityInsuranceLedger } = state;
  
  const isProfessional = qualityTier === 'professional';
  
  // Calculate stats
  const shotsWithDebugResults = production.shots.filter(
    s => s.visualDebugResults && s.visualDebugResults.length > 0
  );
  
  const totalDebugRuns = qualityInsuranceLedger.filter(
    c => c.operation === 'visual_debug'
  ).length;
  
  const totalRetries = qualityInsuranceLedger.filter(
    c => c.operation === 'retry_generation'
  ).length;
  
  const passedShots = shotsWithDebugResults.filter(
    s => s.visualDebugResults?.some(r => r.passed)
  ).length;
  
  const failedDebugShots = shotsWithDebugResults.filter(
    s => s.visualDebugResults?.every(r => !r.passed)
  ).length;
  
  const averageScore = shotsWithDebugResults.length > 0
    ? Math.round(
        shotsWithDebugResults.reduce((sum, s) => {
          const latestScore = s.visualDebugResults?.[s.visualDebugResults.length - 1]?.score || 0;
          return sum + latestScore;
        }, 0) / shotsWithDebugResults.length
      )
    : 0;
  
  // Calculate Quality Insurance savings
  const qiCostsCents = qualityInsuranceLedger.reduce((sum, c) => sum + c.realCostCents, 0);
  
  if (!isProfessional) {
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Visual Debugger</h4>
            <p className="text-sm">Upgrade to Professional tier for AI quality analysis</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                Visual Debugger
                <Badge className="bg-amber-500/20 text-amber-600 border-0 text-xs">
                  Professional
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                AI-powered quality analysis with auto-retry
              </p>
            </div>
          </div>
          
          {isGenerating && totalDebugRuns > 0 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Analyzing...</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard
          icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          label="Passed"
          value={passedShots}
          subtext={`of ${shotsWithDebugResults.length} analyzed`}
        />
        <StatCard
          icon={<RefreshCw className="w-4 h-4 text-amber-500" />}
          label="Auto-Retries"
          value={totalRetries}
          subtext="corrections applied"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
          label="Avg Score"
          value={`${averageScore}%`}
          subtext="quality rating"
        />
        <StatCard
          icon={<Shield className="w-4 h-4 text-purple-500" />}
          label="QI Savings"
          value={`$${(qiCostsCents / 100).toFixed(2)}`}
          subtext="covered by insurance"
        />
      </div>
      
      {/* Shot Analysis List */}
      {shotsWithDebugResults.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 bg-muted/30">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Analysis Results
            </h5>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="p-2 space-y-1">
              {production.shots.map((shot) => {
                const debugResults = shot.visualDebugResults || [];
                if (debugResults.length === 0) return null;
                
                const latestResult = debugResults[debugResults.length - 1];
                const retryCount = shot.retryCount || 0;
                
                return (
                  <div
                    key={shot.id}
                    className={cn(
                      "p-2 rounded-lg text-sm flex items-center justify-between",
                      latestResult.passed 
                        ? "bg-green-500/10" 
                        : "bg-amber-500/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {latestResult.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {shot.id}
                      </span>
                      <span className="font-medium text-foreground">
                        {shot.title}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {retryCount > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {retryCount}
                        </Badge>
                      )}
                      <Badge
                        variant={latestResult.passed ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          latestResult.passed 
                            ? "bg-green-500/20 text-green-600" 
                            : "bg-amber-500/20 text-amber-600"
                        )}
                      >
                        {latestResult.score}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Empty State */}
      {shotsWithDebugResults.length === 0 && (
        <div className="p-6 text-center">
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {isGenerating 
              ? "Visual analysis will appear as shots complete"
              : "Start production to see quality analysis"
            }
          </p>
        </div>
      )}
      
      {/* Quality Insurance Footer */}
      <div className="p-3 bg-muted/30 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            <span>Quality Insurance Active</span>
          </div>
          <span className="text-muted-foreground">
            {TIER_CREDIT_COSTS.professional.QUALITY_INSURANCE} credits/shot coverage
          </span>
        </div>
      </div>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

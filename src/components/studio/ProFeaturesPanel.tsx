import { motion } from 'framer-motion';
import { 
  Shield, 
  Music, 
  Palette, 
  Volume2, 
  Eye, 
  Users, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProFeatureStatus {
  enabled: boolean;
  score?: number;
  details?: string;
  count?: number;
}

interface ProFeaturesData {
  musicSync?: ProFeatureStatus;
  colorGrading?: ProFeatureStatus;
  sfx?: ProFeatureStatus;
  visualDebugger?: ProFeatureStatus & { retriesUsed?: number; avgScore?: number };
  multiCharacterBible?: ProFeatureStatus;
  depthConsistency?: ProFeatureStatus;
}

interface ProFeaturesPanelProps {
  qualityTier: 'standard' | 'professional';
  proFeaturesData?: ProFeaturesData;
  isRunning?: boolean;
  className?: string;
}

const PRO_FEATURES = [
  {
    id: 'musicSync',
    icon: Music,
    label: 'Music Sync',
    description: 'Emotional beats & dynamic tempo',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'colorGrading',
    icon: Palette,
    label: 'Color Grading',
    description: 'Hollywood color science',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'sfx',
    icon: Volume2,
    label: 'SFX Engine',
    description: 'Ambient & foley sounds',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
  },
  {
    id: 'visualDebugger',
    icon: Eye,
    label: 'Visual Debugger',
    description: 'Auto-retry for quality',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'multiCharacterBible',
    icon: Users,
    label: 'Character Bible',
    description: 'Multi-character consistency',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
  },
  {
    id: 'depthConsistency',
    icon: Zap,
    label: 'Depth Analysis',
    description: '3D consistency checks',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
];

export function ProFeaturesPanel({
  qualityTier,
  proFeaturesData = {},
  isRunning = false,
  className
}: ProFeaturesPanelProps) {
  const isPro = qualityTier === 'professional';
  
  if (!isPro) {
    return null;
  }

  const getFeatureStatus = (featureId: string): ProFeatureStatus => {
    return proFeaturesData[featureId as keyof ProFeaturesData] || { enabled: false };
  };

  const enabledCount = Object.values(proFeaturesData).filter(f => f?.enabled).length;
  const avgScore = Object.values(proFeaturesData)
    .filter(f => f?.score != null)
    .reduce((sum, f, _, arr) => sum + (f.score || 0) / arr.length, 0);

  return (
    <Card className={cn("border-success/30 bg-success/5", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-success" />
            <CardTitle className="text-sm font-medium">Pro Features</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">
            {enabledCount} / {PRO_FEATURES.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-4">
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRO_FEATURES.map((feature, index) => {
              const status = getFeatureStatus(feature.id);
              const Icon = feature.icon;
              
              return (
                <Tooltip key={feature.id}>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "relative p-3 rounded-lg border transition-all cursor-default",
                        status.enabled 
                          ? `${feature.bgColor} border-current/20` 
                          : "bg-muted/30 border-border/50 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          status.enabled ? feature.bgColor : "bg-muted"
                        )}>
                          {isRunning && !status.enabled ? (
                            <Loader2 className={cn("w-4 h-4 animate-spin", feature.color)} />
                          ) : status.enabled ? (
                            <Icon className={cn("w-4 h-4", feature.color)} />
                          ) : (
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs font-medium truncate",
                            status.enabled ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {feature.label}
                          </p>
                          {status.score != null && (
                            <p className="text-[10px] text-muted-foreground">
                              {status.score}%
                            </p>
                          )}
                          {status.count != null && (
                            <p className="text-[10px] text-muted-foreground">
                              {status.count} items
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="absolute top-1.5 right-1.5">
                        {status.enabled ? (
                          <CheckCircle2 className="w-3 h-3 text-success" />
                        ) : isRunning ? (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-muted-foreground/30" />
                        )}
                      </div>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{feature.label}</p>
                    <p className="text-muted-foreground">{feature.description}</p>
                    {status.details && (
                      <p className="mt-1 text-success">{status.details}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Quality Score Summary */}
        {avgScore > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Overall Quality Score</span>
              <span className="font-medium text-success">{Math.round(avgScore)}%</span>
            </div>
            <Progress value={avgScore} className="h-1.5" />
          </div>
        )}

        {/* Visual Debugger Stats */}
        {proFeaturesData.visualDebugger?.enabled && (
          <div className="mt-3 p-2 rounded-lg bg-muted/30 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Visual Debugger</span>
              <div className="flex items-center gap-3">
                {proFeaturesData.visualDebugger.avgScore != null && (
                  <span>Avg: <span className="text-success font-medium">{Math.round(proFeaturesData.visualDebugger.avgScore)}%</span></span>
                )}
                {proFeaturesData.visualDebugger.retriesUsed != null && (
                  <span>Retries: <span className="font-medium">{proFeaturesData.visualDebugger.retriesUsed}</span></span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

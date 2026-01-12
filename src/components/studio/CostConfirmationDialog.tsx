import { useState, useEffect, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Coins, 
  Film, 
  Mic, 
  Music, 
  Shield, 
  Sparkles, 
  Clock,
  Zap,
  AlertCircle,
  Pencil,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

interface CostBreakdown {
  preProduction: number;
  production: number;
  qualityInsurance: number;
  total: number;
  creditsPerShot: number;
}

interface CostConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectName: string) => void;
  mode: 'ai' | 'manual';
  clipCount: number;
  totalDuration: number;
  includeVoice: boolean;
  includeMusic: boolean;
  qualityTier: 'standard' | 'professional';
  userCredits?: number;
  defaultProjectName?: string;
}

// Use proper tier-based credit calculation (matches backend)
function calculateCosts(
  clipCount: number,
  qualityTier: 'standard' | 'professional'
): CostBreakdown {
  // Standard: 25 credits per shot (5 pre-prod + 20 production)
  // Professional: 50 credits per shot (5 pre-prod + 20 production + 25 quality insurance)
  const isProTier = qualityTier === 'professional';
  
  const preProduction = clipCount * 5;
  const production = clipCount * 20;
  const qualityInsurance = isProTier ? clipCount * 25 : 0;
  
  const creditsPerShot = isProTier ? 50 : 25;
  const total = clipCount * creditsPerShot;
  
  return { preProduction, production, qualityInsurance, total, creditsPerShot };
}

export const CostConfirmationDialog = forwardRef<HTMLDivElement, CostConfirmationDialogProps>(
  function CostConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    mode,
    clipCount,
    totalDuration,
    includeVoice,
    includeMusic,
    qualityTier,
    userCredits = 0,
    defaultProjectName = '',
  }, ref) {
    const [projectName, setProjectName] = useState(defaultProjectName);
    const [showBuyCredits, setShowBuyCredits] = useState(false);
    const costs = calculateCosts(clipCount, qualityTier);
    const hasEnoughCredits = userCredits >= costs.total;
    const hasValidName = projectName.trim().length > 0;

  // Reset project name when dialog opens
  useEffect(() => {
    if (open) {
      setProjectName(defaultProjectName);
    }
  }, [open, defaultProjectName]);

  const handleConfirm = () => {
    if (hasValidName && hasEnoughCredits) {
      onConfirm(projectName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-foreground text-background">
              <Sparkles className="w-4 h-4" />
            </div>
            Confirm Generation
          </DialogTitle>
          <DialogDescription>
            Name your project and review the cost
          </DialogDescription>
        </DialogHeader>

        {/* Project Name Input */}
        <div className="space-y-2">
          <Label htmlFor="project-name" className="text-sm font-medium flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" />
            Project Name
          </Label>
          <Input
            id="project-name"
            placeholder="My Awesome Video"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-11"
            autoFocus
          />
          {!hasValidName && projectName !== '' && (
            <p className="text-xs text-destructive">Please enter a project name</p>
          )}
        </div>

        {/* Video Summary */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
          <div className="p-3 rounded-xl bg-foreground/5">
            <Film className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {mode === 'ai' ? 'AI Hollywood Mode' : 'Manual Mode'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {totalDuration}s video
              </span>
              <span>{clipCount} clips</span>
            </div>
          </div>
          {qualityTier === 'professional' && (
            <Badge variant="secondary" className="bg-success/10 text-success border-0">
              <Shield className="w-3 h-3 mr-1" />
              Pro
            </Badge>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cost Breakdown ({costs.creditsPerShot} credits/shot)
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4" />
                Pre-Production ({clipCount} shots × 5)
              </span>
              <span className="font-medium">{costs.preProduction}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Film className="w-4 h-4" />
                Production ({clipCount} shots × 20)
              </span>
              <span className="font-medium">{costs.production}</span>
            </div>
            
            {costs.qualityInsurance > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4 text-success" />
                  Quality Insurance ({clipCount} shots × 25)
                </span>
                <span className="font-medium text-success">{costs.qualityInsurance}</span>
              </div>
            )}

            {/* Included features */}
            <div className="pt-2 flex flex-wrap gap-2">
              {includeVoice && (
                <Badge variant="secondary" className="text-xs">
                  <Mic className="w-3 h-3 mr-1" />
                  Voice
                </Badge>
              )}
              {includeMusic && (
                <Badge variant="secondary" className="text-xs">
                  <Music className="w-3 h-3 mr-1" />
                  Music
                </Badge>
              )}
              {qualityTier === 'professional' && (
                <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                  <Shield className="w-3 h-3 mr-1" />
                  Pro Features
                </Badge>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total Cost</span>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-muted-foreground" />
              <span className="text-lg font-bold">{costs.total} credits</span>
            </div>
          </div>
        </div>

        {/* Credits Balance - Always show */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border",
          hasEnoughCredits 
            ? "bg-muted/30 border-border" 
            : "bg-destructive/10 border-destructive/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              hasEnoughCredits ? "bg-foreground/5" : "bg-destructive/20"
            )}>
              <Coins className={cn(
                "w-5 h-5",
                hasEnoughCredits ? "text-muted-foreground" : "text-destructive"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium">Your Balance</p>
              <p className={cn(
                "text-lg font-bold",
                hasEnoughCredits ? "text-foreground" : "text-destructive"
              )}>
                {userCredits} credits
              </p>
            </div>
          </div>
          {hasEnoughCredits ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">After generation</p>
              <p className="text-sm font-medium text-success">
                {userCredits - costs.total} credits remaining
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-destructive/80">Need {costs.total - userCredits} more</p>
              <Badge variant="destructive" className="mt-1">
                <AlertCircle className="w-3 h-3 mr-1" />
                Insufficient
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!hasEnoughCredits ? (
            <Button 
              onClick={() => setShowBuyCredits(true)}
              className="gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Buy Credits
            </Button>
          ) : (
            <Button 
              onClick={handleConfirm} 
              disabled={!hasValidName}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Video
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyCredits} 
        onOpenChange={setShowBuyCredits} 
      />
    </Dialog>
  );
});

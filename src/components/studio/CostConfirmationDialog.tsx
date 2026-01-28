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
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { 
  CREDIT_SYSTEM, 
  getCreditBreakdown 
} from '@/lib/creditSystem';

interface CostBreakdown {
  baseClipCount: number;
  extendedClipCount: number;
  baseCredits: number;
  extendedCredits: number;
  totalCredits: number;
  creditsPerClipBase: number;
  creditsPerClipExtended: number;
  isExtended: boolean;
}

interface CostConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectName: string) => void;
  mode: 'ai' | 'manual';
  clipCount: number;
  clipDuration: number;
  totalDuration: number;
  includeVoice: boolean;
  includeMusic: boolean;
  qualityTier: 'standard' | 'professional';
  userCredits?: number;
  defaultProjectName?: string;
}

export const CostConfirmationDialog = forwardRef<HTMLDivElement, CostConfirmationDialogProps>(
  function CostConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    mode,
    clipCount,
    clipDuration,
    totalDuration,
    includeVoice,
    includeMusic,
    qualityTier,
    userCredits = 0,
    defaultProjectName = '',
  }, ref) {
    const [projectName, setProjectName] = useState(defaultProjectName);
    const [showBuyCredits, setShowBuyCredits] = useState(false);
    const costs = getCreditBreakdown(clipCount, clipDuration);
    const hasEnoughCredits = userCredits >= costs.totalCredits;
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
            Cost Breakdown
          </p>
          
          <div className="space-y-2">
            {/* Base rate clips */}
            {costs.baseClipCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  Base Rate ({costs.baseClipCount} clip{costs.baseClipCount > 1 ? 's' : ''} × {CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP})
                </span>
                <span className="font-medium">{costs.baseCredits}</span>
              </div>
            )}
            
            {/* Extended rate clips */}
            {costs.extendedClipCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  Extended Rate ({costs.extendedClipCount} clip{costs.extendedClipCount > 1 ? 's' : ''} × {CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP})
                </span>
                <span className="font-medium text-warning">{costs.extendedCredits}</span>
              </div>
            )}
            
            {/* Extended pricing explanation */}
            {costs.isExtended && (
              <p className="text-xs text-muted-foreground/70 pl-6">
                Extended rate applies to clips 7+ or clips longer than 6 seconds
              </p>
            )}
            
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4 text-success" />
                Quality Assurance
              </span>
              <span className="font-medium text-success">Included</span>
            </div>

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
              <span className="text-lg font-bold">{costs.totalCredits} credits</span>
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
                {userCredits - costs.totalCredits} credits remaining
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-destructive/80">Need {costs.totalCredits - userCredits} more</p>
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

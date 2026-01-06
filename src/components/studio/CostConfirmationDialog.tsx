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
import { 
  Coins, 
  Film, 
  Mic, 
  Music, 
  Shield, 
  Sparkles, 
  Clock,
  Zap,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostBreakdown {
  baseClips: number;
  voice: number;
  music: number;
  proQA: number;
  total: number;
}

interface CostConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  mode: 'ai' | 'manual';
  clipCount: number;
  totalDuration: number;
  includeVoice: boolean;
  includeMusic: boolean;
  qualityTier: 'standard' | 'professional';
  userCredits?: number;
}

function calculateCosts(
  mode: 'ai' | 'manual',
  clipCount: number,
  includeVoice: boolean,
  includeMusic: boolean,
  qualityTier: 'standard' | 'professional'
): CostBreakdown {
  // Base cost per clip
  const basePerClip = mode === 'ai' ? 40 : 35;
  const baseClips = clipCount * basePerClip;
  
  // Audio costs
  const voice = includeVoice ? 30 : 0;
  const music = includeMusic ? 20 : 0;
  
  // Pro QA cost
  const proQA = qualityTier === 'professional' ? 50 : 0;
  
  const total = baseClips + voice + music + proQA;
  
  return { baseClips, voice, music, proQA, total };
}

export function CostConfirmationDialog({
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
}: CostConfirmationDialogProps) {
  const costs = calculateCosts(mode, clipCount, includeVoice, includeMusic, qualityTier);
  const hasEnoughCredits = userCredits >= costs.total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-foreground text-background">
              <Sparkles className="w-4 h-4" />
            </div>
            Confirm Generation
          </DialogTitle>
          <DialogDescription>
            Review the estimated cost before starting your video
          </DialogDescription>
        </DialogHeader>

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
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4" />
                Video Generation ({clipCount} clips)
              </span>
              <span className="font-medium">{costs.baseClips}</span>
            </div>
            
            {costs.voice > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Mic className="w-4 h-4" />
                  AI Voice Narration
                </span>
                <span className="font-medium">{costs.voice}</span>
              </div>
            )}
            
            {costs.music > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Music className="w-4 h-4" />
                  Background Music
                </span>
                <span className="font-medium">{costs.music}</span>
              </div>
            )}
            
            {costs.proQA > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  Pro Quality Assurance
                </span>
                <span className="font-medium">{costs.proQA}</span>
              </div>
            )}
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

        {/* Credits Warning */}
        {!hasEnoughCredits && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Insufficient Credits</p>
              <p className="text-destructive/80 mt-0.5">
                You have {userCredits} credits. Please purchase more to continue.
              </p>
            </div>
          </div>
        )}

        {/* Your Balance */}
        {hasEnoughCredits && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
            <span className="text-muted-foreground">Your Balance</span>
            <span className="font-medium">
              {userCredits} → {userCredits - costs.total} credits
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!hasEnoughCredits}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

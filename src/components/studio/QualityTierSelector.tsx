import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, Zap, Shield, Eye, RefreshCw, Sparkles } from 'lucide-react';
import { QualityTier, QUALITY_TIERS } from '@/types/quality-tiers';
import { cn } from '@/lib/utils';

interface QualityTierSelectorProps {
  selectedTier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  shotCount: number;
  disabled?: boolean;
}

export function QualityTierSelector({
  selectedTier,
  onTierChange,
  shotCount,
  disabled = false,
}: QualityTierSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Select Quality Tier</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUALITY_TIERS.map((tier) => {
          const isSelected = selectedTier === tier.id;
          const totalCost = tier.credits * shotCount;
          const isProfessional = tier.id === 'professional';
          
          return (
            <Card
              key={tier.id}
              className={cn(
                'relative cursor-pointer transition-all duration-200 border-2',
                isSelected 
                  ? 'border-primary bg-primary/5 shadow-lg' 
                  : 'border-border hover:border-primary/50',
                disabled && 'opacity-50 cursor-not-allowed',
                isProfessional && 'ring-2 ring-amber-500/20'
              )}
              onClick={() => !disabled && onTierChange(tier.id)}
            >
              {isProfessional && (
                <div className="absolute -top-3 left-4">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                    <Crown className="h-3 w-3 mr-1" />
                    Recommended
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {isProfessional ? (
                      <Shield className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Zap className="h-5 w-5 text-blue-500" />
                    )}
                    {tier.name}
                  </CardTitle>
                  
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{tier.credits}</span>
                  <span className="text-muted-foreground">credits/shot</span>
                </div>
                
                {/* Total cost */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total for {shotCount} shots:
                    </span>
                    <span className="font-semibold text-lg">{totalCost} credits</span>
                  </div>
                </div>
                
                {/* Features */}
                <ul className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Professional tier extras */}
                {isProfessional && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <Eye className="h-4 w-4" />
                      <span>Visual Debugger AI analysis</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <RefreshCw className="h-4 w-4" />
                      <span>Up to {tier.maxRetries} auto-retries per shot</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Quality Insurance explanation for Professional */}
      {selectedTier === 'professional' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Quality Insurance Included
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                The extra 15 credits per shot cover Director Audit, Visual Debugger analysis, 
                and up to 2 autonomous retry attempts. If a shot fails quality checks, the system 
                will automatically regenerate it with corrective prompts—at no extra cost to you.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

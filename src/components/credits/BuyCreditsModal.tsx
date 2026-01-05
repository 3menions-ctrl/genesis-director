import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Coins, Sparkles, Check, Star, Loader2, Zap, Film, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS } from '@/hooks/useCreditBilling';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_popular: boolean;
}

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
}

// Premium tier colors
const TIER_STYLES = {
  Starter: {
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
  },
  Growth: {
    gradient: 'from-primary to-accent',
    bg: 'bg-primary/10',
    border: 'border-primary/50',
  },
  Agency: {
    gradient: 'from-amber-400 to-orange-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
} as const;

export function BuyCreditsModal({ open, onOpenChange, onPurchaseComplete }: BuyCreditsModalProps) {
  const { user } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPackages();
    }
  }, [open]);

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('credits', { ascending: true });

    if (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load credit packages');
    } else {
      setPackages(data || []);
    }
    setLoading(false);
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user) {
      toast.error('Please sign in to purchase credits');
      return;
    }

    setPurchasing(pkg.id);
    
    // Stripe integration placeholder
    toast.info('Stripe checkout coming soon! Contact support to purchase credits.');
    
    setPurchasing(null);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getPricePerCredit = (pkg: CreditPackage) => {
    return ((pkg.price_cents / 100) / pkg.credits).toFixed(3);
  };

  const getSavingsPercent = (pkg: CreditPackage, packages: CreditPackage[]) => {
    if (packages.length === 0) return 0;
    const basePrice = packages[0].price_cents / packages[0].credits;
    const pkgPrice = pkg.price_cents / pkg.credits;
    return Math.round(((basePrice - pkgPrice) / basePrice) * 100);
  };

  const getIronCladVideos = (credits: number) => {
    return Math.floor(credits / CREDIT_COSTS.TOTAL_PER_SHOT);
  };

  const getTierStyle = (name: string) => {
    return TIER_STYLES[name as keyof typeof TIER_STYLES] || TIER_STYLES.Starter;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-gradient-to-b from-background to-muted/30 border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-display">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            Iron-Clad Production Credits
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Premium credits for seamless, synchronized cinematic production
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Pricing explanation */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">How Credits Work</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Each Iron-Clad shot costs <span className="text-foreground font-semibold">25 credits</span> total: 
                5 credits for pre-production (script & image) + 20 credits for production (video & voice).
                Failed generations are automatically refunded.
              </p>
            </div>

            {/* Package cards */}
            <div className="grid gap-4">
              {packages.map((pkg) => {
                const tierStyle = getTierStyle(pkg.name);
                const savings = getSavingsPercent(pkg, packages);
                const videos = getIronCladVideos(pkg.credits);
                
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      "relative p-5 rounded-2xl border-2 transition-all hover:shadow-lg",
                      pkg.is_popular 
                        ? `border-primary ${tierStyle.bg}` 
                        : `${tierStyle.border} bg-card`
                    )}
                  >
                    {pkg.is_popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Best Value
                      </div>
                    )}

                    {savings > 0 && !pkg.is_popular && (
                      <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/30">
                        Save {savings}%
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br",
                          tierStyle.gradient
                        )}>
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-lg text-foreground">
                            {pkg.name}
                          </h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-primary">
                              {pkg.credits.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground text-sm">credits</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            ${getPricePerCredit(pkg)} per credit
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Button
                          onClick={() => handlePurchase(pkg)}
                          disabled={purchasing === pkg.id}
                          size="lg"
                          className={cn(
                            "h-12 px-6 font-medium text-lg",
                            pkg.is_popular
                              ? "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                              : "bg-foreground text-background hover:bg-foreground/90"
                          )}
                        >
                          {purchasing === pkg.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            formatPrice(pkg.price_cents)
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* What you can create */}
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <p className="text-xs text-muted-foreground mb-2">What you can create:</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1.5">
                          <Film className="w-3 h-3" />
                          {videos} Iron-Clad videos
                        </span>
                        <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5">
                          <Mic className="w-3 h-3" />
                          {videos} voice tracks
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Benefits */}
            <div className="mt-4 p-4 rounded-xl bg-muted/50">
              <p className="text-sm font-medium text-foreground mb-3">All packages include:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Iron-Clad Frame Chaining',
                  'AI Script Analysis',
                  'Premium Voice Synthesis',
                  'Automatic Refunds on Failure',
                  'HD Video Export',
                  'Audio-Video Sync',
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-500" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

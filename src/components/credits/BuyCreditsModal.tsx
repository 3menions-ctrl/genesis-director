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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Coins, Sparkles, Check, Star, Loader2, Zap, Film, Mic, Shield, Clock, RefreshCw } from 'lucide-react';
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
    icon: Zap,
  },
  Growth: {
    gradient: 'from-primary to-accent',
    bg: 'bg-primary/10',
    border: 'border-primary/50',
    icon: Sparkles,
  },
  Agency: {
    gradient: 'from-amber-400 to-orange-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: Star,
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
    setLoading(true);
    // Use the public view that excludes sensitive Stripe price IDs
    const { data, error } = await supabase
      .from('credit_packages_public')
      .select('*')
      .order('credits', { ascending: true });

    if (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load credit packages');
    } else {
      setPackages(data || []);
    }
    setLoading(false);
  };

  // Map package names to checkout IDs
  const getCheckoutId = (packageName: string): string => {
    const name = packageName.toLowerCase();
    if (name.includes('growth')) return 'growth';
    if (name.includes('agency')) return 'agency';
    return 'starter';
  };

  // Removed checkoutUrl state - now using direct redirect
  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user) {
      toast.error('Please sign in to purchase credits');
      return;
    }

    const checkoutId = getCheckoutId(pkg.name);
    setPurchasing(pkg.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
        body: { packageId: checkoutId },
      });

      if (error) throw error;

      if (data?.url) {
        // Store URL and close modal, then redirect
        onOpenChange(false);
        // Small delay to let modal close, then redirect to Stripe
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setPurchasing(null);
    }
  };

  // Removed handleDirectCheckout - now using direct redirect in handlePurchase

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getPricePerCredit = (pkg: CreditPackage) => {
    return (pkg.price_cents / 100 / pkg.credits).toFixed(2);
  };

  const getSavingsPercent = (pkg: CreditPackage, packages: CreditPackage[]) => {
    if (packages.length === 0) return 0;
    const basePrice = packages[0].price_cents / packages[0].credits;
    const pkgPrice = pkg.price_cents / pkg.credits;
    return Math.round(((basePrice - pkgPrice) / basePrice) * 100);
  };

  // Calculate based on 10 credits per clip (CREDIT_COSTS.TOTAL_PER_SHOT)
  const getClipsCount = (credits: number) => Math.floor(credits / CREDIT_COSTS.TOTAL_PER_SHOT);
  
  // Calculate videos based on different durations
  // 1-minute video (Pro tier) = 10 clips = 100 credits
  const getOneMinuteVideos = (credits: number) => Math.floor(credits / 100);
  const getTwoMinuteVideos = (credits: number) => Math.floor(credits / 200);
  const getThreeMinuteVideos = (credits: number) => Math.floor(credits / 300);

  const getTierStyle = (name: string) => {
    return TIER_STYLES[name as keyof typeof TIER_STYLES] || TIER_STYLES.Starter;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-gradient-to-b from-background to-muted/30 border-border/50 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3 text-2xl font-display">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Coins className="w-5 h-5 text-white" />
            </div>
            Buy Production Credits
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Power your AI video productions with flexible credit packages
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 pt-4 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>

                {/* Pricing breakdown */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Credit Breakdown by Video Length</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">Per clip (~6 sec)</span>
                      <span className="font-semibold text-foreground">{CREDIT_COSTS.TOTAL_PER_SHOT} credits</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">~30 sec video</span>
                      <span className="font-semibold text-foreground">50 credits</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">~1 min video</span>
                      <span className="font-semibold text-primary">100 credits</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">~3 min video</span>
                      <span className="font-semibold text-amber-500">300 credits</span>
                    </div>
                  </div>
                </div>

                {/* Package cards */}
                <div className="space-y-4">
                  {packages.map((pkg) => {
                    const tierStyle = getTierStyle(pkg.name);
                    const savings = getSavingsPercent(pkg, packages);
                    const oneMinVideos = getOneMinuteVideos(pkg.credits);
                    const clips = getClipsCount(pkg.credits);
                    const TierIcon = tierStyle.icon;
                    
                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          "relative p-5 rounded-2xl border-2 transition-all hover:shadow-lg hover:scale-[1.01]",
                          pkg.is_popular 
                            ? `border-primary/60 ${tierStyle.bg} ring-2 ring-primary/20` 
                            : `${tierStyle.border} bg-card/50 hover:bg-card`
                        )}
                      >
                        {pkg.is_popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                            <Star className="w-3 h-3" />
                            Most Popular
                          </div>
                        )}

                        {savings > 0 && !pkg.is_popular && (
                          <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                            Save {savings}%
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg",
                              tierStyle.gradient
                            )}>
                              <TierIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-lg text-foreground">
                                {pkg.name}
                              </h3>
                              <div className="flex items-baseline gap-2 mt-0.5">
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

                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground">One-time</span>
                            <Button
                              onClick={() => handlePurchase(pkg)}
                              disabled={purchasing === pkg.id}
                              size="lg"
                              className={cn(
                                "h-12 px-6 font-bold text-lg shadow-md",
                                pkg.is_popular
                                  ? "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-primary/20"
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

                        {/* What you get */}
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <p className="text-xs text-muted-foreground mb-2 font-medium">What you get:</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1.5">
                              <Film className="w-3.5 h-3.5" />
                              {oneMinVideos}+ one-minute videos
                            </span>
                            <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5" />
                              {clips} total clips
                            </span>
                            <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              Never expires
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Features included */}
                <div className="p-5 rounded-xl bg-muted/40 border border-border/50">
                  <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    All packages include:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Iron-Clad Frame Chaining', desc: 'Seamless clip transitions' },
                      { label: 'AI Script Analysis', desc: 'Smart scene optimization' },
                      { label: 'Premium Voice Synthesis', desc: 'Natural AI narration' },
                      { label: 'Automatic Failure Refunds', desc: 'Credits back if generation fails' },
                      { label: 'HD Video Export', desc: '1080p quality output' },
                      { label: 'Priority Processing', desc: 'Fast generation queue' },
                    ].map((benefit) => (
                      <div key={benefit.label} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-foreground font-medium">{benefit.label}</p>
                          <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund policy */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <RefreshCw className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Zero-Waste Guarantee</p>
                    <p className="text-xs text-muted-foreground">
                      If a clip generation fails, your credits are automatically refunded. You only pay for successful generations.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

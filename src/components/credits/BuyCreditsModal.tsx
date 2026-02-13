import { useState, useEffect, memo, forwardRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Coins, Sparkles, Check, Crown, Loader2, Zap, Building2, Shield, Clock, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMounted } from '@/lib/safeAsync';
import { SafeComponent } from '@/components/ui/error-boundary';

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

// Premium tier configuration matching pricing page
const TIER_CONFIG = {
  Mini: {
    icon: Sparkles,
    description: 'Quick top-up to get started',
    gradient: 'from-slate-400 to-slate-500',
    features: ['HD export', 'AI scripts', '~9 clips'],
  },
  Starter: {
    icon: Zap,
    description: 'Perfect for trying out the platform',
    gradient: 'from-slate-500 to-slate-600',
    features: ['HD export', 'AI scripts', 'Standard support'],
  },
  Growth: {
    icon: Crown,
    description: 'For serious creators and small teams',
    gradient: 'from-white to-slate-100',
    features: ['4K export', 'Priority processing', 'Priority support'],
  },
  Agency: {
    icon: Building2,
    description: 'For studios and production teams',
    gradient: 'from-amber-400 to-orange-500',
    features: ['4K HDR', 'API access', 'Dedicated support'],
  },
} as const;

// Inner component with all the logic
const BuyCreditsModalInner = memo(forwardRef<HTMLDivElement, BuyCreditsModalProps>(
  function BuyCreditsModalInner({ open, onOpenChange, onPurchaseComplete }, ref) {
    const { user } = useAuth();
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const isMountedRef = useIsMounted();

    const fetchPackages = useCallback(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('credit_packages_public')
          .select('*')
          .order('credits', { ascending: true });

        if (!isMountedRef.current) return;

        if (error) {
          console.error('Error fetching packages:', error);
          toast.error('Failed to load credit packages');
        } else {
          setPackages(data || []);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Error:', err);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }, [isMountedRef]);

    useEffect(() => {
      if (open) {
        fetchPackages();
      }
    }, [open, fetchPackages]);

    const getCheckoutId = (packageName: string): string => {
      const nameMap: Record<string, string> = {
        'mini': 'mini',
        'starter': 'starter',
        'growth': 'growth',
        'agency': 'agency',
      };
      const key = packageName.toLowerCase().trim();
      const checkoutId = nameMap[key] || 'starter';
      console.log('[BuyCredits] getCheckoutId:', { packageName, key, checkoutId });
      return checkoutId;
    };

    const handlePurchase = useCallback(async (pkg: CreditPackage) => {
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

        if (!isMountedRef.current) return;

        if (error) throw error;

        if (data?.url) {
          onOpenChange(false);
          setTimeout(() => {
            window.location.href = data.url;
          }, 100);
        } else {
          throw new Error('No checkout URL received');
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('Checkout error:', error);
        toast.error('Failed to start checkout. Please try again.');
        setPurchasing(null);
      }
    }, [user, isMountedRef, onOpenChange]);

    const getTierConfig = (name: string) => {
      return TIER_CONFIG[name as keyof typeof TIER_CONFIG] || TIER_CONFIG.Starter;
    };

    const getClipsEstimate = (credits: number) => `~${Math.floor(credits / 10)} clips`;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform w-[92vw] max-w-4xl max-h-[85vh] p-0 bg-[#000] border-white/[0.08] overflow-hidden flex flex-col"
          hideCloseButton
        >
          {/* Accessible description for screen readers */}
          <DialogDescription className="sr-only">
            Purchase credits for video generation
          </DialogDescription>
          
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-50 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>

          {/* Ambient glow effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-violet-500/[0.08] rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-fuchsia-500/[0.06] rounded-full blur-[100px]" />
            <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-purple-600/[0.07] rounded-full blur-[80px]" />
          </div>

          <ScrollArea className="flex-1 min-h-0 relative z-10">
            <div className="p-6 md:p-10">
              {/* Header */}
              <div className="text-center mb-10">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6"
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-white/60">Production Credits</span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3"
                >
                  Power your creativity
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white/40"
                >
                  1 credit = $0.10 • ~10 credits per clip
                </motion.p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                </div>
              ) : (
                <>
                  {/* Pricing Cards */}
                  <div className="grid md:grid-cols-4 gap-4 mb-10">
                    <AnimatePresence mode="wait">
                      {packages.map((pkg, index) => {
                        const tierConfig = getTierConfig(pkg.name);
                        const TierIcon = tierConfig.icon;
                        const isPopular = pkg.is_popular;

                        return (
                          <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            className={cn(
                              "relative group rounded-3xl",
                              isPopular ? "md:-mt-2 md:mb-2" : ""
                            )}
                          >
                            {/* Glow for popular */}
                            {isPopular && (
                              <div className="absolute -inset-[1px] rounded-3xl blur-xl opacity-40 bg-white" />
                            )}

                            {/* Card */}
                            <div
                              className={cn(
                                "relative h-full rounded-3xl p-6 transition-all duration-500 overflow-hidden",
                                isPopular
                                  ? "bg-white text-black"
                                  : "bg-transparent border border-white/[0.08] hover:border-white/[0.15]"
                              )}
                            >
                              {/* Popular badge */}
                              {isPopular && (
                                <div className="absolute top-0 right-0 px-3 py-1 bg-black text-white text-xs font-medium rounded-bl-xl rounded-tr-3xl">
                                  Popular
                                </div>
                              )}

                              {/* Icon */}
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                                  isPopular
                                    ? "bg-black text-white"
                                    : "bg-white/[0.05] text-white"
                                )}
                              >
                                <TierIcon className="w-5 h-5" />
                              </div>

                              {/* Tier info */}
                              <h3 className={cn("text-xl font-bold mb-1", isPopular ? "text-black" : "text-white")}>
                                {pkg.name}
                              </h3>
                              <p className={cn("text-xs mb-4", isPopular ? "text-black/50" : "text-white/30")}>
                                {tierConfig.description}
                              </p>

                              {/* Price */}
                              <div className="mb-4">
                                <div className="flex items-baseline gap-1">
                                  <span className={cn("text-3xl font-bold tracking-tight", isPopular ? "text-black" : "text-white")}>
                                    ${(pkg.price_cents / 100).toFixed(0)}
                                  </span>
                                  <span className={cn("text-xs", isPopular ? "text-black/40" : "text-white/30")}>
                                    one-time
                                  </span>
                                </div>
                                <div className={cn(
                                  "mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
                                  isPopular ? "bg-black/5 text-black/70" : "bg-white/[0.05] text-white/60"
                                )}>
                                  <span className="font-medium">{pkg.credits.toLocaleString()} credits</span>
                                  <span className="opacity-50">•</span>
                                  <span>{getClipsEstimate(pkg.credits)}</span>
                                </div>
                              </div>

                              {/* Features */}
                              <ul className="space-y-2 mb-6">
                                {tierConfig.features.map((feature, i) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <Check className={cn("w-4 h-4 shrink-0", isPopular ? "text-black" : "text-white/50")} />
                                    <span className={cn("text-xs", isPopular ? "text-black/70" : "text-white/50")}>
                                      {feature}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {/* CTA */}
                              <Button
                                onClick={() => handlePurchase(pkg)}
                                disabled={purchasing === pkg.id}
                                className={cn(
                                  "w-full h-10 rounded-full font-medium text-sm transition-all duration-300",
                                  isPopular
                                    ? "bg-black hover:bg-black/90 text-white"
                                    : "bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.1]"
                                )}
                              >
                                {purchasing === pkg.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    Get {pkg.credits.toLocaleString()}
                                    <ArrowRight className="w-4 h-4 ml-1.5" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Trust Points */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap items-center justify-center gap-6 text-white/30"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span className="text-xs">Secure via Stripe</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">Credits never expire</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs">Zero-waste guarantee</span>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }
));

// Exported wrapper with SafeComponent for crash isolation
export function BuyCreditsModal(props: BuyCreditsModalProps) {
  return (
    <SafeComponent name="BuyCreditsModal" fallback={null}>
      <BuyCreditsModalInner {...props} />
    </SafeComponent>
  );
}

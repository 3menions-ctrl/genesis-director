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
import { Coins, Sparkles, Check, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    
    // For now, simulate a purchase (Stripe will be connected later)
    // This is a placeholder that will be replaced with actual Stripe checkout
    toast.info('Stripe integration coming soon! For now, contact support to purchase credits.');
    
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-background to-muted/30 border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-display">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            Buy Credits
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={cn(
                  "relative p-5 rounded-2xl border-2 transition-all hover:border-primary/50",
                  pkg.is_popular 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card"
                )}
              >
                {pkg.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      pkg.is_popular 
                        ? "bg-gradient-to-br from-primary to-accent" 
                        : "bg-muted"
                    )}>
                      <Sparkles className={cn(
                        "w-7 h-7",
                        pkg.is_popular ? "text-white" : "text-primary"
                      )} />
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

                  <Button
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasing === pkg.id}
                    className={cn(
                      "h-12 px-6 font-medium",
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

                {/* What you can create */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">With {pkg.credits} credits you can create:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {Math.floor(pkg.credits / 1000)} × 8-sec clips
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {Math.floor(pkg.credits / 3500)} × 30-sec clips
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {Math.floor(pkg.credits / 7000)} × 1-min clips
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Benefits */}
            <div className="mt-4 p-4 rounded-xl bg-muted/50">
              <p className="text-sm font-medium text-foreground mb-3">All packages include:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'HD Video Generation',
                  'AI Script Writing',
                  'Voice Narration',
                  'Unlimited Downloads'
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

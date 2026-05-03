import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { Crown, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface SubRow {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const PRICE_LABEL: Record<string, string> = {
  pro_monthly: 'Pro · Monthly',
  pro_yearly: 'Pro · Yearly',
  growth_monthly: 'Growth · Monthly',
  growth_yearly: 'Growth · Yearly',
};

export function PersonalSubscriptionCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status, price_id, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .is('organization_id', null)
        .eq('environment', getStripeEnvironment())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setSub(data as SubRow | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('No portal URL returned');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('[portal]', e);
      toast.error('Could not open billing portal');
    } finally {
      setOpening(false);
    }
  };

  if (loading) return null;

  const isActive =
    !!sub &&
    ['active', 'trialing', 'past_due'].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#0A84FF]/[0.06] to-white/[0.01] p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/40 to-transparent" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/[0.10] border border-[#0A84FF]/30 flex items-center justify-center">
            {isActive ? <Crown className="w-5 h-5 text-[#9DCBFF]" /> : <Sparkles className="w-5 h-5 text-white/55" />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Plan</p>
            <p className="text-xl font-display font-light text-white">
              {isActive ? (PRICE_LABEL[sub!.price_id] ?? sub!.price_id) : 'Free · Pay-as-you-go'}
            </p>
            {isActive && sub?.current_period_end && (
              <p className="text-[12px] text-white/45 mt-1">
                {sub.cancel_at_period_end ? 'Ends' : 'Renews'}{' '}
                {new Date(sub.current_period_end).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isActive ? (
            <Button onClick={openPortal} disabled={opening} variant="outline"
              className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white">
              {opening ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Manage subscription
            </Button>
          ) : (
            <Button onClick={() => navigate('/pricing')} className="bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white">
              <Sparkles className="w-4 h-4 mr-2" /> Upgrade to Pro
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
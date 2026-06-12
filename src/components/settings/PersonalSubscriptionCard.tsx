/**
 * PersonalSubscriptionCard — beta-free version.
 *
 * Subscriptions are not for sale yet. We surface "Free during beta" + a
 * pointer to Credits where the user can request a top-up.
 */
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function PersonalSubscriptionCard() {
  const navigate = useNavigate();

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#0A84FF]/[0.06] to-white/[0.01] p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/40 to-transparent" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/[0.10] border border-[#0A84FF]/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#9DCBFF]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Plan</p>
            <p className="text-xl font-display font-light text-white">Beta · Free</p>
            <p className="text-[12px] text-white/45 mt-1">
              Small Bridges is free during beta. Request more credits anytime.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/credits')}
            className="bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Manage credits{' '}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

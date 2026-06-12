/**
 * BuyCreditsModal — beta-free version.
 *
 * Surfaces a "Request more credits" form. Writes to support_messages so an
 * operator can grant the top-up manually while Small Bridges is in beta. Keeps the
 * same export name + props shape so existing call sites (BillingSettings,
 * CostConfirmationDialog, CreationHub) continue to work unchanged.
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
}

export function BuyCreditsModal({ open, onOpenChange, onPurchaseComplete }: BuyCreditsModalProps) {
  const { user, profile } = useAuth();
  const [amount, setAmount] = useState('200');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    onOpenChange(false);
    // Reset for next open after exit animation
    setTimeout(() => {
      setSent(false);
      setReason('');
      setAmount('200');
    }, 250);
  };

  const submit = async () => {
    if (!user || !profile) {
      toast.error('Sign in to request more credits');
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 50 || n > 5000) {
      toast.error('Pick an amount between 50 and 5,000 credits');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({
      user_id: user.id,
      name: profile.display_name ?? profile.email?.split('@')[0] ?? 'Small Bridges user',
      email: profile.email ?? user.email ?? '',
      source: 'credits_request',
      subject: `Beta credit top-up — ${n} credits`,
      message:
        `User requesting ${n} additional credits while Small Bridges is in beta.\n` +
        `Current balance: ${profile.credits_balance ?? 0}\n` +
        `Lifetime used: ${profile.total_credits_used ?? 0}\n\n` +
        `Reason:\n${reason || '(none provided)'}`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? 'Could not send request');
      return;
    }
    setSent(true);
    toast.success("Request sent — we'll reply within one business day");
    onPurchaseComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[hsl(220,14%,3.5%)] border-white/[0.08] text-white">
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/[0.06] text-emerald-300 text-[9px] font-mono font-bold tracking-[0.32em] uppercase">
            BETA · FREE
          </span>
        </div>
        <DialogTitle className="text-white text-[22px] font-display font-light">
          Request more credits
        </DialogTitle>
        <DialogDescription className="text-white/55 text-[13px]">
          Small Bridges is free while we&rsquo;re in beta. We hand-allocate credit top-ups by request.
        </DialogDescription>

        {sent ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.04] p-5 flex items-start gap-3">
            <BadgeCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
            <div>
              <div className="text-white text-[14px] mb-1">Request received</div>
              <p className="text-white/65 text-[12px] leading-relaxed">
                We&rsquo;ll review and reply within one business day. You&rsquo;ll see the additional credits in your ledger once granted.
              </p>
              <Button onClick={close} className="mt-4 bg-glass-hover border border-white/[0.08] hover:bg-glass-active">Close</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">Credits requested</span>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="ds-input mt-1 font-mono text-[14px]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">What are you building? (optional)</span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="A short product video for a launch on Friday…"
                  className="ds-input mt-1 resize-none"
                />
              </label>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button onClick={close} variant="ghost" className="text-white/55 hover:text-white">Cancel</Button>
              <PrimaryCTA onClick={submit} loading={busy} icon={Send}>
                Send request
              </PrimaryCTA>
            </div>
            <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.22em] text-white/30 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              No payment processor. No card stored. Free during beta.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

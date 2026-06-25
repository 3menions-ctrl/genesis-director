/**
 * CreatorEarnings — drop-in card showing pending USD payout, total
 * lifetime earnings, and a "Cash out" button.
 *
 * Sit-anywhere component for Profile / WorkspaceCredits / Settings.
 */
import { useEffect, useState } from "react";
import { Banknote, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

interface PayoutAccount {
  stripe_account_id: string;
  onboarding_complete: boolean;
  payouts_enabled: boolean;
}

export function CreatorEarnings({ className }: { className?: string }) {
  const [pendingCents, setPendingCents] = useState<number>(0);
  const [lifetimeCents, setLifetimeCents] = useState<number>(0);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"onboard" | "payout" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: { user } }, pendingRes, lifetimeRes, acctRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("creator_pending_payout_cents"),
        // Server-side SUM over the FULL ledger — PREVIOUSLY a .limit(1000)
        // client slice undercounted lifetime earnings past 1,000 rows.
        supabase.rpc("creator_lifetime_earnings_cents" as never),
        supabase
          .from("creator_payout_accounts")
          .select("stripe_account_id, onboarding_complete, payouts_enabled")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (!user) { setLoading(false); return; }
      setPendingCents(typeof pendingRes.data === "number" ? pendingRes.data : 0);
      setLifetimeCents(typeof lifetimeRes.data === "number" ? lifetimeRes.data : 0);
      setAccount(acctRes.data as PayoutAccount | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const startOnboarding = async () => {
    setBusy("onboard");
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { returnUrl: `${window.location.origin}/workspace/credits?connect=done` },
      });
      if (error || !data?.url) {
        toast.error("Couldn't start Stripe onboarding — try again.");
        return;
      }
      window.location.href = data.url as string;
    } finally {
      setBusy(null);
    }
  };

  const cashOut = async () => {
    setBusy("payout");
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-payout", {
        body: {},
      });
      if (error) {
        toast.error(safeErrorMessage(error, "Couldn't initiate the payout."));
        return;
      }
      const cents = (data as { amount_cents?: number })?.amount_cents ?? 0;
      toast.success(`Payout of $${(cents / 100).toFixed(2)} is in transit.`);
      setPendingCents(0);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className={"rounded-2xl border border-glass bg-glass p-6 " + (className ?? "")}>
        <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  const onboarded = !!account?.onboarding_complete && !!account?.payouts_enabled;
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className={"rounded-2xl border border-glass bg-glass p-6 space-y-5 " + (className ?? "")}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground/70">
            Creator earnings
          </h3>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">Available</div>
          <div className="text-3xl font-semibold tabular-nums mt-1">
            <AnimatedCounter value={pendingCents} format={usd} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">Lifetime</div>
          <div className="text-3xl font-semibold tabular-nums mt-1 text-foreground/85">
            <AnimatedCounter value={lifetimeCents} format={usd} />
          </div>
        </div>
      </div>

      {onboarded ? (
        <Button
          type="button"
          onClick={cashOut}
          disabled={busy !== null || pendingCents < 2000}
          className="w-full"
        >
          {busy === "payout"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : pendingCents < 2000
            ? "Minimum payout is $20"
            : `Cash out ${usd(pendingCents)}`}
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={startOnboarding} disabled={busy !== null} className="w-full">
          {busy === "onboard"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : (<>Connect with Stripe <ExternalLink className="w-3.5 h-3.5 ml-2" /></>)}
        </Button>
      )}

      <p className="text-xs text-foreground/55">
        Stripe Connect handles the bank transfer. 10 credits = $1.00. Minimum payout $20.
      </p>
    </div>
  );
}

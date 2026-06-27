// ─────────────────────────────────────────────────────────────────────────
// LiveBuyAlert — an "epic" celebratory notification that fires in real time
// whenever ANY user buys credits. Subscribes to INSERTs on credit_transactions
// (transaction_type=purchase) via Supabase Realtime postgres-changes. RLS
// ("Admins can view all credit transactions" — is_admin) ensures ONLY admins
// receive these events, so there's no cross-user PII leak. Mounted globally in
// AdminLayout, so it fires on any admin page.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { DollarSign, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_PACKAGES } from "@/lib/payments/creditPackages";

const PRICE: Record<string, number> = Object.fromEntries(CREDIT_PACKAGES.map((p) => [p.id, p.price]));
const PRICE_BY_CREDITS: Record<number, number> = Object.fromEntries(CREDIT_PACKAGES.map((p) => [p.credits, p.price]));
const usd = (pkg: string | null, credits: number) => (pkg && PRICE[pkg]) || PRICE_BY_CREDITS[credits] || 0;

interface Buy { id: string; name: string; credits: number; pkg: string | null; usd: number }

// A short, bright two-note chime via WebAudio (no asset dependency).
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch { /* audio not available — silent */ }
}

function burstConfetti() {
  const opts = { spread: 80, ticks: 220, gravity: 0.9, scalar: 1.1, zIndex: 9999 };
  const colors = ["#10d39e", "#36d6f5", "#a78bfa", "#fbbf24"];
  confetti({ ...opts, particleCount: 90, origin: { x: 0.5, y: 0.35 }, colors });
  setTimeout(() => confetti({ ...opts, particleCount: 60, angle: 60, origin: { x: 0, y: 0.6 }, colors }), 150);
  setTimeout(() => confetti({ ...opts, particleCount: 60, angle: 120, origin: { x: 1, y: 0.6 }, colors }), 150);
}

export function LiveBuyAlert() {
  const [queue, setQueue] = useState<Buy[]>([]);
  const current = queue[0] ?? null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-live-buys")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "credit_transactions", filter: "transaction_type=eq.purchase" },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string; amount: number; description: string | null; stripe_payment_id: string | null };
          // Only celebrate REAL Polar purchases. Synthetic/seed/admin-grant rows
          // (no polar_ order id) must not trigger the alert.
          if (!row.stripe_payment_id?.startsWith("polar_")) return;
          const pkg = row.description?.match(/\(([a-z+]+) via/i)?.[1] ?? null;
          let name = "A customer";
          try {
            const { data } = await supabase.from("profiles").select("display_name, username").eq("id", row.user_id).maybeSingle();
            name = (data as { display_name?: string; username?: string } | null)?.display_name
              || (data as { username?: string } | null)?.username || "A customer";
          } catch { /* name lookup optional */ }
          setQueue((q) => [...q, { id: row.id, name, credits: row.amount, pkg, usd: usd(pkg, row.amount) }]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  // Celebrate + auto-dismiss whenever a new alert reaches the front.
  useEffect(() => {
    if (!current) return;
    burstConfetti();
    playChime();
    timer.current = setTimeout(dismiss, 7000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [current, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[9998] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -40, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="pointer-events-auto relative flex items-center gap-4 overflow-hidden rounded-2xl px-6 py-4"
            style={{
              background: "linear-gradient(135deg, rgba(16,211,158,0.16), rgba(54,214,245,0.10))",
              border: "1px solid rgba(16,211,158,0.35)",
              boxShadow: "0 24px 80px -20px rgba(16,211,158,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
              backdropFilter: "blur(20px)",
            }}
          >
            <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full" style={{ background: "#10d39e", filter: "blur(54px)", opacity: 0.4 }} />
            <motion.span
              className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full"
              style={{ background: "linear-gradient(135deg,#10d39e,#36d6f5)" }}
              initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12 }}
            >
              <DollarSign className="h-6 w-6 text-[#06251c]" strokeWidth={2.5} />
            </motion.span>
            <div className="relative flex flex-col">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">
                <Sparkles className="h-3 w-3" /> New purchase
              </span>
              <span className="font-display text-[16px] font-semibold text-white">
                {current.name} bought {current.credits.toLocaleString()} credits
              </span>
            </div>
            <span className="relative ml-2 font-display text-[26px] font-bold tabular-nums" style={{ color: "#10d39e", textShadow: "0 0 24px rgba(16,211,158,0.6)" }}>
              {current.usd ? `$${current.usd.toLocaleString()}` : `${current.credits.toLocaleString()}cr`}
            </span>
            <button onClick={dismiss} className="pointer-events-auto relative ml-3 grid h-7 w-7 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

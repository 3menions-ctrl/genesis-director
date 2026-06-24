/**
 * PatronHubPage — /c/:id/patron  (also reachable via /c/@handle/patron)
 *
 * Full-page version of the Patron Hub. Replaces the modal so the layout
 * has room to breathe and centering actually works on every viewport.
 *
 * Two tabs:
 *   "Choose a tier" — TierCard stack
 *   "Your pledges"  — your active patron subscriptions, cancel inline
 *
 * Pulls everything from profile_overview RPC + patron_subscriptions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowLeft, Crown, Check, Sparkles, Loader2, Settings, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/shell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { CenterLine } from "@/components/ui/CenterLine";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Same TYPE_META as the rest of the app (Mono caps with tight tracking).
const TYPE_META = "text-[10.5px] font-mono uppercase tracking-[0.24em]";
const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

interface PatronTier {
  id: string;
  position: number;
  name: string;
  monthly_credits: number;
  perks: string;
  accent_hsl: string | null;
}
interface PatronGoal {
  id: string;
  label: string;
  target_credits: number;
  current_credits: number;
}
interface CreatorMeta {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string | null;
}
interface ActivePledge {
  id: string;
  creator_id: string;
  monthly_credits: number;
  renewal_due_at: string;
  creator: {
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
    tagline: string | null;
  } | null;
}

export default function PatronHubPage() {
  const { id: routeParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [creator, setCreator] = useState<CreatorMeta | null>(null);
  const [tiers, setTiers] = useState<PatronTier[]>([]);
  const [goal, setGoal] = useState<PatronGoal | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tiers" | "yours">("tiers");
  const [busyTierId, setBusyTierId] = useState<string | null>(null);
  const [pledges, setPledges] = useState<ActivePledge[] | null>(null);
  const [loadingPledges, setLoadingPledges] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);

  // Resolve route param (UUID or @handle) → creator UUID.
  useEffect(() => {
    if (!routeParam) { setCreatorId(null); return; }
    if (/^[0-9a-f-]{36}$/i.test(routeParam)) { setCreatorId(routeParam); return; }
    const handle = routeParam.replace(/^@/, "").toLowerCase();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("resolve_username" as never, { p_username: handle } as never);
      if (!cancelled) setCreatorId((data as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [routeParam]);

  // Load creator + tiers + goal.
  const load = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    try {
      const [profRes, ovRes] = await Promise.all([
        supabase
          .from("profiles_public" as never)
          .select("id, display_name, username, avatar_url, cover_url, tagline")
          .eq("id", creatorId)
          .maybeSingle(),
        supabase.rpc("profile_overview" as never, { p_user_id: creatorId } as never),
      ]);
      setCreator((profRes.data as CreatorMeta | null) ?? null);
      const ov = (ovRes.data ?? {}) as any;
      setTiers(((ov.patron_tiers ?? []) as any[]).map((t) => ({
        id: t.id, position: t.position, name: t.name,
        monthly_credits: t.monthly_credits, perks: t.perks ?? "",
        accent_hsl: t.accent_hsl ?? null,
      })));
      const g = ov.patron_goal ?? null;
      setGoal(g ? {
        id: g.id, label: g.label,
        target_credits: Number(g.target_credits ?? 0),
        current_credits: Number(g.current_credits ?? 0),
      } : null);
      setIsOwner(Boolean(ov.is_owner));
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => { void load(); }, [load]);

  // Load "Your pledges" lazily on tab switch.
  useEffect(() => {
    if (tab !== "yours") return;
    if (pledges !== null) return;
    let cancelled = false;
    setLoadingPledges(true);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setPledges([]); setLoadingPledges(false); } return; }
        const { data: rows } = await supabase
          .from("patron_subscriptions")
          .select("id, creator_id, monthly_credits, renewal_due_at, cancelled_at")
          .eq("patron_id", user.id)
          .is("cancelled_at", null)
          .order("started_at", { ascending: false });
        const subs = ((rows ?? []) as Array<{
          id: string; creator_id: string; monthly_credits: number; renewal_due_at: string; cancelled_at: string | null;
        }>);
        if (subs.length === 0) { if (!cancelled) { setPledges([]); setLoadingPledges(false); } return; }
        const ids = subs.map((s) => s.creator_id);
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, avatar_url, username, tagline")
          .in("id", ids);
        const byId = new Map<string, ActivePledge["creator"]>(
          ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null; tagline: string | null }>)
            .map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url, username: p.username, tagline: p.tagline }]),
        );
        if (cancelled) return;
        setPledges(subs.map((s) => ({
          id: s.id, creator_id: s.creator_id,
          monthly_credits: s.monthly_credits, renewal_due_at: s.renewal_due_at,
          creator: byId.get(s.creator_id) ?? null,
        })));
      } catch {
        if (!cancelled) setPledges([]);
      } finally {
        if (!cancelled) setLoadingPledges(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, pledges]);

  const creatorName = creator?.display_name ?? "this creator";
  const handleSlug = useMemo(
    () => (creator?.username ? `@${creator.username}` : creatorId ?? ""),
    [creator?.username, creatorId],
  );
  const goalPct = goal ? Math.min(100, Math.round((goal.current_credits / goal.target_credits) * 100)) : 0;
  const popularIdx = tiers.length >= 3 ? Math.floor(tiers.length / 2) : -1;

  usePageMeta({
    title: creator?.display_name ? `Support ${creator.display_name} — Small Bridges` : "Patron — Small Bridges",
    description: goal?.label ?? creator?.tagline ?? "Pledge monthly credits. 90% goes straight to the creator.",
    ogImage: creator?.cover_url ?? creator?.avatar_url ?? undefined,
    ogType: "profile",
  });

  const pledge = async (tier: PatronTier, originEvent?: React.MouseEvent<HTMLButtonElement>) => {
    if (!creatorId) return;
    setBusyTierId(tier.id);
    const rect = originEvent?.currentTarget.getBoundingClientRect();
    try {
      const { data, error } = await supabase.rpc(
        "pledge_patron_tier" as never,
        { p_creator_id: creatorId, p_tier_id: tier.id } as never,
      );
      if (error) throw error;
      const ok = (data as any)?.success === true;
      if (!ok) {
        const reason = (data as any)?.reason ?? "unknown_error";
        toast.error(humaniseError(String(reason)));
      } else {
        toast.success(`Pledged ${tier.monthly_credits} cr/mo to ${creatorName}.`);
        if (rect && !reducedMotion) {
          setBurst({ key: Date.now(), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        setPledges(null);
        window.setTimeout(() => setTab("yours"), 900);
      }
    } catch (e) {
      toast.error(humaniseError(e instanceof Error ? e.message : "Pledge failed"));
    } finally {
      setBusyTierId(null);
    }
  };

  const cancelPledge = async (sub: ActivePledge) => {
    setCancellingId(sub.id);
    setPledges((prev) => (prev ?? []).filter((p) => p.id !== sub.id));
    try {
      const { error } = await supabase.rpc("cancel_patron" as never, { p_creator_id: sub.creator_id } as never);
      if (error) throw error;
      toast.success(`Cancelled pledge to ${sub.creator?.display_name ?? "creator"}.`);
    } catch (e) {
      setPledges((prev) => prev ? [sub, ...prev] : [sub]);
      toast.error(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col isolate overflow-hidden">
      {/* Cinematic page backdrop — replaces what was the modal backdrop */}
      <PatronPageBackdrop reducedMotion={reducedMotion ?? false} />

      <PageShell width="full" pad>
        {/* Header strip */}
        <header className="pt-2 mb-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(handleSlug ? `/c/${handleSlug}` : -1 as any)}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to profile
          </button>
          {/* Owner-only — direct link to the tier + goal + payouts editor.
              Lives in Settings → Creator but routing here lets the owner
              jump straight from their public patron page to authoring. */}
          {isOwner && !loading && (
            <Link
              to="/account?tab=settings&m=creator"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-amber-200/85 hover:text-amber-100 transition-colors"
            >
              <Settings className="h-3 w-3" /> Manage tiers
            </Link>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground/65">
            <Spinner size="md" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading patron…</span>
          </div>
        ) : (
          <>
            {/* Centered hero */}
            <section className="text-center max-w-2xl mx-auto">
              <div className={cn(TYPE_META, "text-amber-300/90 tracking-[0.36em] inline-flex items-center justify-center gap-2 mb-3")}>
                <Crown className="h-3.5 w-3.5" strokeWidth={1.8} />◆ Patron
              </div>
              <h1
                className="font-display italic text-[clamp(2rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.01em] text-foreground"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 350 }}
              >
                <span className="bg-gradient-to-b from-white via-white/95 to-white/65 bg-clip-text text-transparent">
                  Support {creatorName.replace(/\.$/, "")}.
                </span>
              </h1>
              <p className="mt-4 text-[14px] text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
                {goal?.label ?? "Pledge monthly credits. 90% goes straight to the creator. Cancel anytime."}
              </p>

              {/* Goal meter — owner-only. Visitors see the goal headline
                  above but not the live progress total. */}
              {goal && isOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mt-8 max-w-xl mx-auto"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="inline-flex items-baseline gap-2">
                      <span
                        className="font-light tabular-nums text-amber-200"
                        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: "clamp(1.6rem,2.4vw,2.2rem)" }}
                      >
                        <AnimatedCounter value={goal.current_credits} />
                      </span>
                      <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em]")}>
                        / {goal.target_credits.toLocaleString()} CR · MONTH
                      </span>
                    </div>
                    <span className={cn(TYPE_META, "text-amber-200/90 tracking-[0.22em] tabular-nums inline-flex items-baseline gap-1")}>
                      <AnimatedCounter value={goalPct} />%<span className="text-muted-foreground/55">FUNDED</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${goalPct}%` }}
                      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                      className="absolute inset-y-0 left-0"
                      style={{
                        background: "linear-gradient(90deg, hsl(38 80% 50%) 0%, hsl(45 95% 65%) 60%, hsl(45 100% 75%) 100%)",
                        boxShadow: "0 0 28px hsla(45 95% 60% / 0.55), inset 0 1px 0 hsla(0 0% 100% / 0.25)",
                      }}
                    />
                    {!reducedMotion && goalPct > 0 && (
                      <motion.div
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[30%] pointer-events-none"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, hsla(0 0% 100% / 0.45) 50%, transparent 100%)",
                          mixBlendMode: "overlay",
                        }}
                        animate={{ x: ["-30%", "330%"] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </section>

            {/* Tabs */}
            <nav className="mt-12 mb-8 flex items-center justify-center gap-2">
              <PageTab id="tiers" label="Choose a tier" active={tab === "tiers"} onClick={() => setTab("tiers")} />
              <PageTab id="yours" label="Your pledges" active={tab === "yours"} onClick={() => setTab("yours")} />
            </nav>

            {/* Body — tiers use the full page; pledges stays readable. */}
            <section
              className={cn(
                "pb-24",
                tab === "tiers"
                  ? "w-full"
                  : "max-w-2xl mx-auto",
              )}
            >
              <AnimatePresence mode="wait">
                {tab === "tiers" ? (
                  <motion.div
                    key="tiers"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="w-full"
                  >
                    {tiers.length === 0 ? (
                      isOwner ? (
                        // Owner empty-state — actionable. Sends them
                        // straight to the editor where they can author
                        // their first tier.
                        <div className="py-12 max-w-md mx-auto text-center">
                          <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-amber-400/[0.08] flex items-center justify-center">
                            <Crown className="h-5 w-5 text-amber-200/85" strokeWidth={1.6} />
                          </div>
                          <h2
                            className="font-display italic text-[clamp(1.4rem,2.4vw,1.9rem)] leading-tight text-foreground/95"
                            style={{ fontFamily: "'Fraunces', serif", fontWeight: 350 }}
                          >
                            Set up your patron tiers.
                          </h2>
                          <p className="mt-3 text-[13.5px] text-muted-foreground/75 leading-relaxed">
                            Create monthly tiers — name them, set credit thresholds, and list the perks. Patrons pick a tier and pledge from this page.
                          </p>
                          <Link
                            to="/account?tab=settings&m=creator"
                            className="mt-6 inline-flex items-center gap-2 px-5 h-10 rounded-full bg-gradient-to-br from-amber-400/[0.18] to-amber-400/[0.04] text-[13px] text-amber-100 hover:from-amber-400/[0.32] hover:to-amber-400/[0.10] transition-all"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                            Create your first tier
                          </Link>
                          <p className={cn(TYPE_META, "mt-4 text-muted-foreground/45 tracking-[0.22em]")}>
                            Opens Settings → Creator
                          </p>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-muted-foreground/65 text-[13px]">
                          This creator hasn&rsquo;t set up patron tiers yet.
                        </div>
                      )
                    ) : (
                      <div
                        className="grid gap-6 items-stretch w-full"
                        style={{
                          // Auto-fill ensures every card is the same width: the
                          // browser packs as many minmax(320px, 1fr) columns as
                          // fit, and they all share the row's leftover space
                          // equally — so a 3-tier or 5-tier row are all
                          // identically-sized cells.
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
                        }}
                      >
                        {tiers.map((t, i) => (
                          <PatronTierCard
                            key={t.id}
                            tier={t}
                            index={i}
                            isPopular={i === popularIdx}
                            busy={busyTierId === t.id}
                            onPledge={(e) => pledge(t, e)}
                            reducedMotion={reducedMotion ?? false}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="yours"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                  >
                    <YoursPledgesPanel
                      pledges={pledges}
                      loading={loadingPledges}
                      cancellingId={cancellingId}
                      onCancel={cancelPledge}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Trust band footer */}
            <footer className="pb-24 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <TrustChip label="Cancel anytime" />
              <span className="text-muted-foreground/30">·</span>
              <TrustChip label="90% to creator" />
              <span className="text-muted-foreground/30">·</span>
              <TrustChip label="Secure ledger" />
            </footer>
          </>
        )}
      </PageShell>

      <ConfettiBurst burst={burst} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-level cinematic backdrop
// ─────────────────────────────────────────────────────────────────────────────
function PatronPageBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[hsl(220_30%_5%)]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 18% 12%, hsla(38 90% 50% / 0.25) 0%, transparent 60%)," +
            "radial-gradient(70% 50% at 82% 20%, hsla(295 80% 55% / 0.22) 0%, transparent 62%)," +
            "radial-gradient(70% 60% at 50% 95%, hsla(195 90% 50% / 0.18) 0%, transparent 65%)",
        }}
      />
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute"
            style={{
              top: "5%", left: "2%", width: 420, height: 420, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(45 95% 60% / 0.30), transparent 70%)",
              filter: "blur(80px)",
            }}
            animate={{ x: [0, 60, -20, 0], y: [0, -40, 30, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute"
            style={{
              top: "15%", right: "3%", width: 380, height: 380, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(290 75% 55% / 0.30), transparent 70%)",
              filter: "blur(90px)",
            }}
            animate={{ x: [0, -50, 30, 0], y: [0, 40, -25, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            className="absolute"
            style={{
              bottom: "-15%", left: "30%", width: 540, height: 540, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(195 80% 55% / 0.22), transparent 70%)",
              filter: "blur(100px)",
            }}
            animate={{ x: [0, 30, -50, 0], y: [0, -20, 15, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
        </>
      )}
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: GRAIN_URL }} />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 100% at 50% 50%, transparent 35%, hsla(220 30% 4% / 0.65) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab + tier card components
// ─────────────────────────────────────────────────────────────────────────────
function PageTab({
  id, label, active, onClick,
}: { id: string; label: string; active: boolean; onClick: () => void }) {
  void id;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "relative inline-flex items-center h-11 px-5 text-[11px] font-mono uppercase tracking-[0.24em] transition-colors",
        active ? "text-white" : "text-muted-foreground/60 hover:text-foreground",
      )}
    >
      {label}
      {active && <CenterLine />}
    </button>
  );
}

function PatronTierCard({
  tier, index, isPopular, busy, onPledge, reducedMotion,
}: {
  tier: PatronTier;
  index: number;
  isPopular: boolean;
  busy: boolean;
  onPledge: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  reducedMotion: boolean;
}) {
  const accent = tier.accent_hsl ?? "38 80% 60%";
  const perksLines = (tier.perks ?? "")
    .split(/\r?\n|[·•]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const mvX = useMotionValue(0.5);
  const mvY = useMotionValue(0.5);
  const rotX = useTransform(mvY, [0, 1], reducedMotion ? [0, 0] : [4, -4]);
  const rotY = useTransform(mvX, [0, 1], reducedMotion ? [0, 0] : [-5, 5]);
  const glareX = useTransform(mvX, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(mvY, [0, 1], ["0%", "100%"]);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mvX.set((e.clientX - r.left) / r.width);
    mvY.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { mvX.set(0.5); mvY.set(0.5); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(index, 4) * 0.07 }}
      style={{ perspective: 1200 }}
      className="group/tier h-full"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className={cn(
          "relative rounded-3xl overflow-hidden h-full flex flex-col",
          "bg-[linear-gradient(180deg,hsla(0_0%_100%_/_0.04)_0%,hsla(0_0%_100%_/_0.01)_100%)]",
          "backdrop-blur-2xl transition-shadow duration-500",
          isPopular
            ? "shadow-[0_30px_80px_-20px_hsla(45_95%_55%/0.5)]"
            : "shadow-[0_20px_60px_-30px_hsla(0_0%_0%/0.7)] group-hover/tier:shadow-[0_28px_70px_-25px_hsla(0_0%_0%/0.85)]",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 opacity-95 pointer-events-none"
          style={{ background: `radial-gradient(110% 100% at 50% 0%, hsla(${accent} / 0.32) 0%, hsla(${accent} / 0.10) 35%, transparent 70%)` }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-60 pointer-events-none mix-blend-overlay"
          style={{ background: `radial-gradient(220px 220px at ${glareX} ${glareY}, hsla(0 0% 100% / 0.28), transparent 60%)` }}
        />
        <div aria-hidden className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none" style={{ backgroundImage: GRAIN_URL }} />

        {isPopular && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              className="relative inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.20em] text-black overflow-hidden"
              style={{ background: "linear-gradient(180deg, hsl(45 100% 75%) 0%, hsl(38 95% 55%) 100%)" }}
              animate={reducedMotion ? undefined : { y: [0, -1.5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              <span className="relative">Most popular</span>
              {!reducedMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(120deg, transparent 30%, hsla(0 0% 100% / 0.55) 50%, transparent 70%)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.6 }}
                />
              )}
            </motion.div>
          </div>
        )}

        <div className="relative px-7 pt-7 text-center flex-1" style={{ transform: "translateZ(20px)" }}>
          <motion.div
            className="inline-flex items-center justify-center h-14 w-14 rounded-full font-display italic text-[22px] text-black relative overflow-hidden"
            style={{
              background: `radial-gradient(80% 80% at 30% 30%, hsla(${accent} / 0.98) 0%, hsla(${accent} / 0.75) 70%, hsla(${accent} / 0.55) 100%)`,
              fontFamily: "'Fraunces', serif",
              boxShadow: `inset 0 1px 0 hsla(0 0% 100% / 0.45), 0 8px 28px -8px hsla(${accent} / 0.65)`,
            }}
            animate={reducedMotion ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 4 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="relative">{tier.position + 1}</span>
            {!reducedMotion && (
              <motion.span
                aria-hidden
                className="absolute -inset-1 rounded-full pointer-events-none"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, hsla(${accent} / 0.55) 20%, transparent 50%, transparent 100%)`,
                  mask: "radial-gradient(circle, transparent 56%, black 60%)",
                  WebkitMask: "radial-gradient(circle, transparent 56%, black 60%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6 + index, repeat: Infinity, ease: "linear" }}
              />
            )}
          </motion.div>
          <h3
            className="mt-4 font-display italic text-[26px] leading-tight tracking-[-0.015em] text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {tier.name}
          </h3>
          <div className="mt-4 inline-flex items-baseline justify-center gap-2">
            <span
              className="font-display italic font-light tabular-nums leading-none"
              style={{
                color: `hsl(${accent})`,
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(2.6rem, 3.4vw, 3.4rem)",
                textShadow: `0 4px 32px hsla(${accent} / 0.40)`,
              }}
            >
              <AnimatedCounter value={tier.monthly_credits} duration={1.0 + index * 0.15} />
            </span>
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em] pb-2")}>CR / MONTH</span>
          </div>

          {perksLines.length > 0 && (
            <>
              <div aria-hidden className="mt-6 mx-auto h-px w-24" style={{ background: `linear-gradient(90deg, transparent, hsla(${accent} / 0.45), transparent)` }} />
              <ul className="mt-5 space-y-3 max-w-sm mx-auto text-left">
                {perksLines.map((line, j) => (
                  <motion.li
                    key={j}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + j * 0.06 }}
                    className="flex items-start gap-3 text-[13.5px] text-foreground/90 leading-snug"
                  >
                    <span
                      className="mt-0.5 inline-flex items-center justify-center h-5 w-5 rounded-full shrink-0"
                      style={{ background: `hsla(${accent} / 0.18)`, boxShadow: `inset 0 0 0 1px hsla(${accent} / 0.50)` }}
                    >
                      <Check className="h-3 w-3" strokeWidth={2.6} style={{ color: `hsl(${accent})` }} />
                    </span>
                    <span>{line}</span>
                  </motion.li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="relative px-7 pb-7 pt-6 mt-auto" style={{ transform: "translateZ(15px)" }}>
          <button
            type="button"
            onClick={(e) => onPledge(e)}
            disabled={busy}
            className="group/cta relative w-full inline-flex items-center justify-center gap-2 h-12 rounded-full overflow-hidden text-[12px] font-mono uppercase tracking-[0.26em] text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(180deg, hsl(${accent}) 0%, hsl(${accent}) 55%, hsla(${accent} / 0.85) 100%)`,
              boxShadow: `0 14px 40px -10px hsla(${accent} / 0.55), inset 0 1px 0 hsla(0 0% 100% / 0.35)`,
            }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(120deg, transparent 30%, hsla(0 0% 100% / 0.40) 50%, transparent 70%)" }}
              animate={reducedMotion ? undefined : { x: ["-100%", "200%"] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
            />
            <span className="relative inline-flex items-center gap-2.5">
              <Crown className="h-3.5 w-3.5" strokeWidth={2} />
              {busy ? "Pledging…" : `Pledge ${tier.monthly_credits} cr / month`}
            </span>
          </button>
          <div className={cn(TYPE_META, "mt-3 text-center text-muted-foreground/50 tracking-[0.22em]")}>
            Cancel anytime
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Your-pledges panel (page version)
// ─────────────────────────────────────────────────────────────────────────────
function YoursPledgesPanel({
  pledges, loading, cancellingId, onCancel,
}: {
  pledges: ActivePledge[] | null;
  loading: boolean;
  cancellingId: string | null;
  onCancel: (sub: ActivePledge) => Promise<void> | void;
}) {
  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-3 text-muted-foreground/65">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading your pledges…</span>
      </div>
    );
  }
  if (!pledges || pledges.length === 0) {
    return (
      <div className="py-16 text-center">
        <Crown className="h-7 w-7 mx-auto text-muted-foreground/55" strokeWidth={1.4} />
        <div className="mt-5 font-display italic text-[20px] text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
          No active pledges yet.
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground/70">
          Choose a tier above to start supporting this creator.
        </p>
      </div>
    );
  }
  const total = pledges.reduce((s, x) => s + x.monthly_credits, 0);
  return (
    <div>
      <div className="mb-5 text-[12.5px] text-muted-foreground/75 text-center">
        Active pledges to <span className="text-amber-200 font-mono tabular-nums">{pledges.length}</span>{" "}
        {pledges.length === 1 ? "creator" : "creators"} · <span className="text-amber-200 font-mono tabular-nums">{total.toLocaleString()}</span>{" "}
        cr / month total.
      </div>
      <ul className="space-y-1">
        {pledges.map((p) => {
          const slug = p.creator?.username ? `@${p.creator.username}` : p.creator_id;
          const renew = new Date(p.renewal_due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <li key={p.id} className="rounded-2xl px-3 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
              <Link to={`/c/${slug}`} className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-glass-hover">
                {p.creator?.avatar_url ? (
                  <img src={p.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground/70 text-[12px] font-mono">
                    {(p.creator?.display_name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/c/${slug}`} className="block text-[14px] text-foreground font-light truncate hover:text-accent transition-colors">
                  {p.creator?.display_name ?? "Anonymous"}
                </Link>
                {p.creator?.tagline && (
                  <div className="text-[11.5px] text-muted-foreground/60 italic truncate" style={{ fontFamily: "'Fraunces', serif" }}>
                    {p.creator.tagline}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-right min-w-[110px]">
                <div className="text-[15px] text-amber-200 font-light tabular-nums" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                  {p.monthly_credits.toLocaleString()} cr
                </div>
                <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em]")}>
                  Renews {renew}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onCancel(p)}
                disabled={cancellingId === p.id}
                className="shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.22em] text-rose-200/75 hover:text-rose-100 bg-rose-500/[0.06] hover:bg-rose-500/15 transition-colors disabled:opacity-50"
              >
                {cancellingId === p.id ? "Cancelling…" : "Cancel"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────────────────
function TrustChip({ label }: { label: string }) {
  return (
    <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em] inline-flex items-center gap-1.5")}>
      <Check className="h-3 w-3 text-emerald-300/80" strokeWidth={2.2} />
      {label}
    </span>
  );
}
function AnimatedCounter({ value, duration = 1.4 }: { value: number; duration?: number }) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reducedMotion]);
  return <>{display.toLocaleString()}</>;
}
function ConfettiBurst({ burst }: { burst: { key: number; x: number; y: number } | null }) {
  if (!burst) return null;
  const N = 18;
  const colors = ["hsl(45 95% 65%)", "hsl(38 95% 60%)", "hsl(290 80% 65%)", "hsl(195 80% 60%)", "hsl(0 0% 100%)"];
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" aria-hidden>
      {Array.from({ length: N }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / N + (i % 3) * 0.1;
        const distance = 110 + (i % 5) * 16;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const color = colors[i % colors.length];
        return (
          <motion.span
            key={`${burst.key}-${i}`}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ left: burst.x, top: burst.y, background: color, boxShadow: `0 0 12px ${color}` }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: dx, y: dy, scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.85 + (i % 4) * 0.08, ease: [0.16, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}
function humaniseError(msg: string): string {
  return msg
    .replace(/auth[_ ]required/i, "Sign in to pledge.")
    .replace(/insufficient_credits/i, "Not enough credits. Buy a top-up first.")
    .replace(/cannot_pledge_self/i, "You can't pledge to yourself.")
    .replace(/creator_not_found/i, "That creator no longer exists.")
    .replace(/tier_not_found/i, "That tier no longer exists.")
    .replace(/invalid_credits/i, "Pledge must be 1–10,000 credits.")
    .replace(/_/g, " ");
}

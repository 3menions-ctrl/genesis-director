/**
 * Help — /help
 *
 * The new help surface. Linear × A24: dark canvas, Fraunces italic display,
 * a perpetually-focused Cmd-K-style search bar, four quick-action tiles,
 * a real-time status panel, a search-filterable FAQ accordion, a direct
 * line to the admins (ticket form with screenshot upload), the user's
 * recent tickets thread, and a documentation rail.
 *
 * Architecture:
 *   1. AbstractBackground       — same aurora backdrop the Pricing page uses
 *   2. Hero band                — "How can we help?" + the search bar
 *   3. Quick actions strip      — 4 large tiles (bug · feature · question · admin)
 *   4. StatusPanel              — system_status_overview RPC, polled every 60s
 *   5. FAQ accordion            — 12 hand-written entries, search-filterable
 *   6. AdminWindow              — ticket form, writes to support_tickets,
 *                                 screenshot lands in storage://support-screenshots
 *   7. RecentTickets            — auth-only, user's own tickets with status
 *   8. DocumentationRail        — 4 deep links to manual / pipeline / market /
 *                                 api routes (stubs mounted in App.tsx)
 *
 * Search:
 *   The hero search bar is global. It filters the FAQ accordion live and
 *   surfaces deep-link matches (quick actions, status, tickets). ⌘K refocuses
 *   it from anywhere on the page; Esc clears the query.
 *
 * Status:
 *   Polls `system_status_overview` RPC (added in the support_tickets
 *   migration). Green dot when healthy; red list of incidents when not.
 *
 * Admin window:
 *   Inline success state on submit (no toast-only). Screenshot upload uses
 *   the public `support-screenshots` bucket scoped per-user. Trigger writes
 *   a notification to every admin so the ticket lands in the admin pipeline
 *   immediately.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ImageIcon,
  X,
  ArrowUpRight,
  BookOpen,
  Cpu,
  ShoppingBag,
  Code2,
  Sparkles,
  Clock,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GradientBackdrop } from "@/components/foundation/GradientBackdrop";
import { GlassButton, GlassPanel } from "@/components/foundation/Floating";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";

// Heavy aurora backdrop — same atmospheric layer the Pricing page wraps in,
// Help shares the violet GradientBackdrop with the Avatars page.

// ─────────────────────────────────────────────────────────────────────────────
// Static content — FAQs + docs links
// ─────────────────────────────────────────────────────────────────────────────
interface FaqEntry {
  q: string;
  a: string;
  category: "render" | "credits" | "publish" | "editor" | "account" | "billing";
}

const FAQS: FaqEntry[] = [
  {
    category: "render",
    q: "Why did my render fail?",
    a: "Most failures are one of three things: (1) the provider rate-limited us during a traffic spike — we auto-retry once and refund credits if it still won't land; (2) the prompt violated the safety classifier (we'll show the reason in your project's status panel); or (3) a transient codec hiccup. Open the project in /studio and look at the per-shot status badges. If you see a blocker, file a ticket below and attach the project URL — we triage failures within an hour.",
  },
  {
    category: "credits",
    q: "How do credits work?",
    a: "One credit ≈ one second of generated cinematic video at standard quality. 4K HDR renders cost ~2x. Credits never expire on pay-as-you-go packs; subscription credits roll over one month. Tips and patron pledges debit your wallet at full transparency — every line item is on /account?tab=credits. Pricing breakdown lives on /pricing.",
  },
  {
    category: "publish",
    q: "How do I publish to the Lobby?",
    a: "Open the project, click Export → Publish to Lobby in the top-right of /editor. You'll pick a world (Noir, Sci-Fi, Comedy…), a synopsis, and an optional poster frame. Once you confirm, your reel goes into the public feed and shows up in /lobby's Trending section. You can unpublish anytime from /library.",
  },
  {
    category: "editor",
    q: "How do I add captions?",
    a: "In /editor, open the right inspector for any clip and switch to the Captions tab. We auto-transcribe via Whisper on demand (free), then let you style + reposition. Burn-in lives in Export; soft-subs export as a sidecar .vtt. Multi-language: pick the source language in the inspector header and we'll generate translations on confirm.",
  },
  {
    category: "render",
    q: "Why is my render in 16:9 when I selected 9:16?",
    a: "This was a real bug in the pipeline that landed last sprint — the aspect ratio was being clobbered by the stitch worker when scenes had mixed source ratios. It's fixed. If you still see it, your project may have been queued before the fix shipped — re-render any affected shot and the new pipeline will honor your aspect.",
  },
  {
    category: "billing",
    q: "How do I cancel my subscription?",
    a: "Account → Billing → Manage subscription. The cancel button takes you to the Stripe portal where you confirm. You keep all unused credits and continue accessing pro features until your billing period ends. We never auto-renew without warning you 7 days out.",
  },
  {
    category: "render",
    q: "Why is the render queue showing 'waiting'?",
    a: "We batch renders to keep cost down. Standard queue = 1-3 min wait, priority queue (Growth+) = under 30s, dedicated lane (Agency+) = instant. The queue status badge at the top-right of /studio shows your current position. If you've been waiting more than 10 minutes, that's an incident — file a ticket.",
  },
  {
    category: "editor",
    q: "Can I download the project file (not just the export)?",
    a: "Yes. /editor → File menu → Download .gdproj. That's the canonical project file — scenes, takes, timeline edits, and asset references. You can re-upload it on any account to continue the project. We're working on a native desktop helper that auto-syncs .gdproj files; ETA Q3.",
  },
  {
    category: "credits",
    q: "What happens if my render runs out of credits halfway?",
    a: "We never charge you for a partial render. If your wallet hits zero mid-shot, that shot pauses (you'll see a yellow badge), the queue holds your slot for 24 hours, and we email you. Top up and click Resume — no lost progress.",
  },
  {
    category: "publish",
    q: "How does the marketplace 90/10 split work?",
    a: "Creators keep 90% of every tip, atom listing, and template sale. Patron pledges follow the same split. The 10% covers payment processing + infrastructure. Payouts land in your Stripe Connect account daily; see /account?tab=credits for the ledger.",
  },
  {
    category: "account",
    q: "How do I delete my account?",
    a: "Account → Settings → Delete account. Hard-delete is irreversible — your projects, reels, comments, and patron history are wiped within 24 hours. Published reels with active patron pledges have a 7-day grace period so patrons get notified. GDPR export is one click in the same panel.",
  },
  {
    category: "account",
    q: "I can't sign in / my session expired.",
    a: "First — try a hard refresh (Cmd-Shift-R). If that doesn't work, /forgot-password sends a magic link to your email. We also publish session status to /admin/sessions; if you're a workspace admin, a global session-invalidation event will boot every device. If neither works, message us via the form below.",
  },
  {
    category: "editor",
    q: "The Studio prompt is producing the wrong scene — how do I steer it?",
    a: "Two surfaces: (1) the Environments picker in /studio's left drawer — choose the scene first, then describe the subject IN that scene. The generator places the subject INSIDE the environment instead of treating the scene as a backdrop. (2) Inline prompt tokens: @character / @world / @style snap the generator to known entities. /help/editor-manual has the full vocabulary.",
  },
];

const DOCS_LINKS = [
  {
    title: "Editor manual",
    description: "Every shortcut, panel, and timeline gesture.",
    to: "/help/editor-manual",
    Icon: BookOpen,
  },
  {
    title: "Render pipeline",
    description: "How shots are queued, fanned out, and stitched.",
    to: "/help/render-pipeline",
    Icon: Cpu,
  },
  {
    title: "Marketplace policies",
    description: "Listings, payouts, refunds, takedowns.",
    to: "/help/marketplace-policies",
    Icon: ShoppingBag,
  },
  {
    title: "API reference",
    description: "Public endpoints, webhooks, rate limits.",
    to: "/help/api-reference",
    Icon: Code2,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types — DB rows we touch
// ─────────────────────────────────────────────────────────────────────────────
interface SupportTicketRow {
  id: string;
  subject: string;
  kind: "bug" | "feature" | "question" | "contact";
  severity: "low" | "medium" | "high" | "blocker";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

interface StatusPayload {
  open_tickets: number;
  blocker_open: number;
  failed_24h: number;
  completed_24h: number;
  healthy: boolean;
  checked_at: string;
}

type QuickActionKind = "bug" | "feature" | "question" | "contact";

// ─────────────────────────────────────────────────────────────────────────────
// Help — the surface
// ─────────────────────────────────────────────────────────────────────────────
export default function Help() {
  usePageMeta({
    title: "Help — Small Bridges",
    description:
      "How can we help? Search FAQs, check system status, file a ticket, or talk to the team.",
  });
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();

  // Search — global focus + live filter.
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Pre-selected ticket kind so the four quick-action tiles deep-link
  // into the admin window with the right form mode set.
  const [ticketKind, setTicketKind] = useState<QuickActionKind>("contact");
  const adminWindowRef = useRef<HTMLDivElement | null>(null);

  // ⌘K / / shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scrollToAdminWindow = (kind: QuickActionKind) => {
    setTicketKind(kind);
    adminWindowRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const scrollToFaq = () => {
    setTicketKind("question");
    setTimeout(() => {
      searchRef.current?.focus();
    }, 60);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GradientBackdrop tone="violet" />

      <main className="relative z-10 mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12 pt-16 pb-32">
        <Hero
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          faqCount={FAQS.length}
          reducedMotion={reducedMotion ?? false}
        />

        <QuickActions
          onPick={(k) => {
            if (k === "question") scrollToFaq();
            else scrollToAdminWindow(k);
          }}
          reducedMotion={reducedMotion ?? false}
        />

        <StatusPanel reducedMotion={reducedMotion ?? false} />

        <FaqSection query={query} setQuery={setQuery} />

        <div ref={adminWindowRef}>
          <AdminWindow user={user} initialKind={ticketKind} />
        </div>

        {user && <RecentTickets userId={user.id} />}

        <DocumentationRail reducedMotion={reducedMotion ?? false} />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero — "How can we help?" + perpetually focused search bar
// ─────────────────────────────────────────────────────────────────────────────
function Hero({
  query,
  setQuery,
  searchRef,
  faqCount,
  reducedMotion,
}: {
  query: string;
  setQuery: (s: string) => void;
  searchRef: React.MutableRefObject<HTMLInputElement | null>;
  faqCount: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.header
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_PREMIUM }}
      className="relative mb-16"
    >
      {/* Live "ROOM" badge — top right */}
      <div className="absolute top-0 right-0 hidden sm:flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-accent/65 animate-ping opacity-65" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span
          className={cn(
            TYPE_META,
            "text-foreground/70 tabular-nums tracking-[0.32em]",
          )}
        >
          HELP · {faqCount} ARTICLES · LIVE
        </span>
      </div>

      {/* Eyebrow */}
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
        <span className="h-px w-8 bg-accent/40" />
        <span>A direct line</span>
      </div>

      {/* Headline — Fraunces italic */}
      <h1
        className="mt-6 font-display leading-[0.95] tracking-[-0.025em] text-[44px] md:text-[68px] xl:text-[84px]"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
      >
        <span className="italic font-light bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
          How can we help?
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-[15px] font-light leading-relaxed text-muted-foreground/75">
        This is the window to the admins. Search the FAQ, check the
        pipeline's heartbeat, or file a ticket and we'll be in your inbox
        the same day.
      </p>

      {/* Search bar — perpetually focused, command-center-style */}
      <div className="mt-10 max-w-3xl">
        <div className="group/search relative">
          {/* Outer glow that lights up on focus-within */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -m-px rounded-2xl bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.15),transparent_70%)] opacity-0 group-focus-within/search:opacity-100 transition-opacity duration-500"
          />
          <div
            className={cn(
              "relative flex items-center gap-4",
              "rounded-2xl bg-[hsl(220_30%_6%/0.55)] backdrop-blur-2xl",
              "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07),0_30px_80px_-30px_hsl(0_0%_0%/0.6)]",
              "transition-colors duration-300",
              "px-5 sm:px-7 h-16 sm:h-[72px]",
            )}
          >
            <Search
              className="h-5 w-5 shrink-0 text-muted-foreground/55 group-focus-within/search:text-accent transition-colors"
              strokeWidth={1.5}
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs, docs, ticket status…"
              className={cn(
                "flex-1 bg-transparent outline-none border-0",
                "text-[16px] sm:text-[17px] font-light tracking-[-0.005em]",
                "text-foreground placeholder:text-muted-foreground/45",
              )}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search help"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={1.7} />
              </button>
            ) : (
              <kbd
                className={cn(
                  TYPE_META,
                  "shrink-0 hidden sm:inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-foreground/55",
                )}
              >
                ⌘K
              </kbd>
            )}
          </div>
        </div>
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/45 tracking-[0.28em]")}>
          ESC TO CLEAR · ENTER TO JUMP TO FIRST RESULT
        </p>
      </div>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickActions — 4 oversized tiles
// ─────────────────────────────────────────────────────────────────────────────
function QuickActions({
  onPick,
  reducedMotion,
}: {
  onPick: (k: QuickActionKind) => void;
  reducedMotion: boolean;
}) {
  const tiles = [
    {
      kind: "bug" as QuickActionKind,
      title: "Report a bug",
      hint: "Something broke",
      Icon: Bug,
      accent: "hsl(0 80% 60%)",
    },
    {
      kind: "feature" as QuickActionKind,
      title: "Request a feature",
      hint: "Steer the roadmap",
      Icon: Lightbulb,
      accent: "hsl(38 90% 60%)",
    },
    {
      kind: "question" as QuickActionKind,
      title: "Ask a question",
      hint: "Search the FAQ",
      Icon: HelpCircle,
      accent: "hsl(215 100% 60%)",
    },
    {
      kind: "contact" as QuickActionKind,
      title: "Talk to the team",
      hint: "Direct message admins",
      Icon: MessageCircle,
      accent: "hsl(280 70% 65%)",
    },
  ] as const;

  return (
    <section className="mb-16">
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t, i) => {
          const Icon = t.Icon;
          return (
            <motion.button
              key={t.kind}
              type="button"
              onClick={() => onPick(t.kind)}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_PREMIUM, delay: 0.05 + i * 0.06 }}
              whileHover={reducedMotion ? undefined : { y: -2 }}
              className={cn(
                "group/tile relative text-left",
                "rounded-[20px] p-6 sm:p-7",
                "transition-all duration-300",
                "overflow-hidden",
              )}
              style={{
                ["--tile-accent" as string]: t.accent,
              }}
            >
              {/* Gradient wash on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 group-hover/tile:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at 0% 0%, ${t.accent}1f, transparent 65%)`,
                }}
              />
              <div className="relative">
                <div
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl mb-5"
                  style={{
                    backgroundColor: `${t.accent}1a`,
                    boxShadow: `inset 0 0 0 1px ${t.accent}33`,
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: t.accent }}
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="text-[18px] sm:text-[20px] font-light tracking-[-0.01em] text-foreground">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-[13px] text-muted-foreground/70 font-light">
                  {t.hint}
                </p>
                <div className="mt-6 flex items-center gap-1.5 text-accent/80 group-hover/tile:text-accent transition-colors">
                  <span className={cn(TYPE_META, "tracking-[0.32em]")}>OPEN</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusPanel — polls system_status_overview every 60s
// ─────────────────────────────────────────────────────────────────────────────
function StatusPanel({ reducedMotion }: { reducedMotion: boolean }) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase.rpc(
          "system_status_overview" as never,
        );
        if (cancelled) return;
        if (error) throw error;
        setStatus(data as unknown as StatusPayload);
      } catch {
        // Failure is itself a signal — paint an "unknown" state.
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    fetchStatus();
    const t = window.setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const healthy = status?.healthy ?? true;
  const checkedAt = status?.checked_at;

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      className="mb-16"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
            <span className="h-px w-8 bg-accent/40" />
            <span>System status</span>
          </div>
          <h2
            className="mt-3 font-display italic leading-tight text-[28px] md:text-[34px]"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
          >
            <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
              The pipeline, right now.
            </span>
          </h2>
        </div>
        <Link
          to="/admin/status"
          className={cn(
            TYPE_META,
            "hidden sm:inline-flex items-center gap-1.5 text-muted-foreground/55 hover:text-foreground transition-colors tracking-[0.28em]",
          )}
        >
          FULL STATUS
          <ArrowUpRight className="h-3 w-3" strokeWidth={1.8} />
        </Link>
      </div>

      <GlassPanel className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Big dot + label */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {!loaded ? (
                <span className="absolute inset-0 rounded-full bg-muted-foreground/40 animate-pulse" />
              ) : healthy ? (
                <>
                  <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_hsl(150_80%_55%/0.6)]" />
                </>
              ) : (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-400/60 animate-ping opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-400 shadow-[0_0_18px_hsl(0_80%_55%/0.6)]" />
                </>
              )}
            </span>
            <div>
              <div className="text-[15px] font-light tracking-[-0.005em] text-foreground">
                {!loaded
                  ? "Checking the wires…"
                  : healthy
                    ? "All systems operational"
                    : "Active incidents"}
              </div>
              <div className={cn(TYPE_META, "text-muted-foreground/50 mt-1 tracking-[0.28em]")}>
                {checkedAt
                  ? `LAST CHECK · ${formatTimecode(checkedAt)}`
                  : "AUTO-REFRESH 60S"}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="ml-auto grid grid-cols-3 gap-6 sm:gap-10">
            <StatusKpi label="OPEN" value={status?.open_tickets ?? 0} loaded={loaded} />
            <StatusKpi
              label="FAILED 24H"
              value={status?.failed_24h ?? 0}
              loaded={loaded}
              tone={status && status.failed_24h > 5 ? "warn" : "neutral"}
            />
            <StatusKpi
              label="RENDERED 24H"
              value={status?.completed_24h ?? 0}
              loaded={loaded}
              tone="ok"
            />
          </div>
        </div>

        {/* Incident strip (only when unhealthy) */}
        {loaded && !healthy && status && (
          <div className="mt-5 pt-5 space-y-2 [border-top:1px_solid] [border-image:linear-gradient(90deg,transparent,hsl(0_0%_100%/0.1),transparent)_1]">
            {status.blocker_open > 0 && (
              <IncidentRow
                Icon={AlertTriangle}
                tone="red"
                title={`${status.blocker_open} blocker ticket${status.blocker_open === 1 ? "" : "s"} open`}
                meta="Admin queue is on it. Watch this badge — it'll go green when resolved."
              />
            )}
            {status.failed_24h > 5 && (
              <IncidentRow
                Icon={Activity}
                tone="amber"
                title={`Elevated render failures · ${status.failed_24h} in the last 24h`}
                meta="We auto-retry every failure once and refund credits on persistent fail."
              />
            )}
          </div>
        )}
      </GlassPanel>
    </motion.section>
  );
}

function StatusKpi({
  label,
  value,
  loaded,
  tone = "neutral",
}: {
  label: string;
  value: number;
  loaded: boolean;
  tone?: "neutral" | "ok" | "warn";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-300/95"
      : tone === "warn"
        ? "text-amber-300/95"
        : "text-foreground";
  return (
    <div>
      <div className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.32em]")}>{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-[22px] tabular-nums leading-none",
          color,
          !loaded && "text-muted-foreground/35",
        )}
      >
        {loaded ? value.toLocaleString() : "—"}
      </div>
    </div>
  );
}

function IncidentRow({
  Icon,
  tone,
  title,
  meta,
}: {
  Icon: typeof AlertTriangle;
  tone: "red" | "amber";
  title: string;
  meta: string;
}) {
  const color = tone === "red" ? "text-red-300" : "text-amber-300";
  return (
    <div className="flex items-start gap-3">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} strokeWidth={1.7} />
      <div className="flex-1">
        <div className="text-[14px] font-light tracking-[-0.005em] text-foreground/90">
          {title}
        </div>
        <div className="text-[12.5px] text-muted-foreground/65 mt-0.5 font-light">
          {meta}
        </div>
      </div>
    </div>
  );
}

function formatTimecode(iso: string): string {
  try {
    const d = new Date(iso);
    return d
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      .replace(/\s/g, "");
  } catch {
    return "—";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FaqSection — search-filterable accordion
// ─────────────────────────────────────────────────────────────────────────────
function FaqSection({ query, setQuery }: { query: string; setQuery: (s: string) => void }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }, [query]);

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="mb-16">
      <div className="mb-5 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
            <span className="h-px w-8 bg-accent/40" />
            <span>FAQ</span>
          </div>
          <h2
            className="mt-3 font-display italic leading-tight text-[28px] md:text-[34px]"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
          >
            <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
              The questions we keep getting.
            </span>
          </h2>
        </div>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className={cn(
              TYPE_META,
              "text-muted-foreground/65 hover:text-foreground transition-colors tracking-[0.28em]",
            )}
          >
            {filtered.length} MATCH{filtered.length === 1 ? "" : "ES"} · CLEAR
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="mt-4 text-foreground/85 font-light">
            No FAQ matches "{query}".
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground/65">
            File a ticket below — we'll add a real answer.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {filtered.map((entry, i) => {
            const open = openIdx === i;
            return (
              <li key={entry.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className={cn(
                    "group/row w-full flex items-center gap-4 px-6 py-5 text-left",
                    "hover:bg-white/[0.02] transition-colors",
                  )}
                >
                  <span
                    className={cn(
                      TYPE_META,
                      "shrink-0 text-muted-foreground/45 tabular-nums tracking-[0.28em]",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[15px] sm:text-[16px] font-light tracking-[-0.005em] text-foreground/95">
                    {entry.q}
                  </span>
                  <span
                    className={cn(
                      TYPE_META,
                      "shrink-0 hidden sm:inline text-muted-foreground/45 uppercase tracking-[0.32em]",
                    )}
                  >
                    {entry.category}
                  </span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: EASE_PREMIUM }}
                    className="shrink-0 text-muted-foreground/55 group-hover/row:text-foreground/75 transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={1.7} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="ans"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_PREMIUM }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pl-[78px] pr-12">
                        <p className="text-[14px] leading-[1.65] font-light text-muted-foreground/85">
                          {entry.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminWindow — ticket form, screenshot upload, inline success
// ─────────────────────────────────────────────────────────────────────────────
function AdminWindow({
  user,
  initialKind,
}: {
  user: ReturnType<typeof useAuth>["user"];
  initialKind: QuickActionKind;
}) {
  const [kind, setKind] = useState<QuickActionKind>(initialKind);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "blocker">(
    "medium",
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync external kind picks (quick-action tiles).
  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  const reset = () => {
    setSubject("");
    setMessage("");
    setSeverity("medium");
    setFile(null);
    setSubmittedId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to file a ticket — we tie it to your account so we can reply.");
      return;
    }
    if (subject.trim().length === 0 || message.trim().length === 0) {
      toast.error("Subject and message are required.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload screenshot first (if present), then write the row.
      let screenshotUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("support-screenshots")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        // support-screenshots is a PRIVATE bucket — sign a long-lived URL
        // (1yr) so the ticket's stored screenshot link keeps resolving in
        // the admin queue without exposing the bucket publicly.
        const { data: signed } = await supabase.storage
          .from("support-screenshots")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        screenshotUrl = signed?.signedUrl ?? null;
      }

      const meta = {
        route: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        app_version: "v2.0",
        at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("support_tickets" as never)
        .insert({
          user_id: user.id,
          subject: subject.trim().slice(0, 200),
          message: message.trim().slice(0, 8000),
          kind,
          severity,
          screenshot_url: screenshotUrl,
          meta,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const row = data as unknown as { id: string } | null;
      setSubmittedId(row?.id ?? "submitted");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't file the ticket. Try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const kindCopy: Record<QuickActionKind, { title: string; cta: string }> = {
    bug: { title: "Report a bug", cta: "Send to triage" },
    feature: { title: "Request a feature", cta: "Send to roadmap" },
    question: { title: "Ask a question", cta: "Send to support" },
    contact: { title: "Talk to the team", cta: "Send to admins" },
  };

  const sevs: Array<{ key: typeof severity; label: string; tone: string }> = [
    { key: "low", label: "Low", tone: "hsl(160 60% 50%)" },
    { key: "medium", label: "Medium", tone: "hsl(215 100% 60%)" },
    { key: "high", label: "High", tone: "hsl(38 90% 60%)" },
    { key: "blocker", label: "Blocker", tone: "hsl(0 80% 60%)" },
  ];

  return (
    <section className="mb-16">
      <div className="mb-5">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
          <span className="h-px w-8 bg-accent/40" />
          <span>Admin window</span>
        </div>
        <h2
          className="mt-3 font-display italic leading-tight text-[28px] md:text-[34px]"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
        >
          <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
            A direct line.
          </span>
        </h2>
        <p className="mt-3 max-w-xl text-[14px] font-light text-muted-foreground/70">
          Your ticket lands in the admin pipeline the moment you submit.
          High and blocker tickets ping the team's inbox immediately.
        </p>
      </div>

      <GlassPanel className="rounded-[24px] overflow-hidden">
        {/* Chrome strip — kind tabs */}
        <div className="flex items-center gap-1 px-3 py-3 [border-bottom:1px_solid] [border-image:linear-gradient(90deg,transparent,hsl(0_0%_100%/0.08),transparent)_1] overflow-x-auto scrollbar-hide">
          {(Object.keys(kindCopy) as QuickActionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "shrink-0 px-4 h-9 rounded-full text-[12.5px] font-light tracking-[-0.005em] transition-all",
                kind === k
                  ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.10)]"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.03]",
              )}
            >
              {kindCopy[k].title}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {submittedId ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE_PREMIUM }}
              className="px-7 py-12 text-center"
            >
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30">
                <CheckCircle2 className="h-6 w-6 text-emerald-300" strokeWidth={1.7} />
              </div>
              <h3
                className="mt-6 font-display italic text-[28px] leading-tight"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
              >
                <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                  We got it.
                </span>
              </h3>
              <p className="mt-3 max-w-md mx-auto text-[14px] font-light text-muted-foreground/75 leading-relaxed">
                Ticket{" "}
                <span className="font-mono text-foreground/80">
                  #{submittedId.slice(0, 8)}
                </span>{" "}
                is in the admin queue. You'll see updates in your inbox at{" "}
                <Link to="/inbox" className="text-accent hover:underline">
                  /inbox
                </Link>{" "}
                and on this page below.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <GlassButton type="button" onClick={reset}>
                  File another
                </GlassButton>
                <GlassButton to="/inbox" tone="solid">
                  Open inbox <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </GlassButton>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={submit}
              className="p-6 sm:p-7 space-y-5"
            >
              <Field label="Subject">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="One line — what's the headline?"
                  className={cn(
                    "w-full bg-transparent outline-none border-0",
                    "text-[15px] font-light tracking-[-0.005em] text-foreground placeholder:text-muted-foreground/45",
                    "border-b border-white/[0.07] focus:border-accent/40 pb-2.5 transition-colors",
                  )}
                />
              </Field>

              <Field label="Message">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  maxLength={8000}
                  placeholder="What happened? What did you expect? Steps to reproduce help us most."
                  className={cn(
                    "w-full bg-transparent outline-none border-0",
                    "text-[14.5px] font-light leading-[1.6] tracking-[-0.005em] text-foreground placeholder:text-muted-foreground/45 resize-none",
                    "border-b border-white/[0.07] focus:border-accent/40 pb-2.5 transition-colors",
                  )}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-6">
                <Field label="Severity">
                  <div className="flex flex-wrap gap-2">
                    {sevs.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSeverity(s.key)}
                        className={cn(
                          "px-3 h-8 rounded-full text-[12.5px] tracking-[-0.005em] font-light transition-all",
                          severity === s.key
                            ? "text-foreground"
                            : "text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.04]",
                        )}
                        style={
                          severity === s.key
                            ? {
                                backgroundColor: `${s.tone}1f`,
                                boxShadow: `inset 0 0 0 1px ${s.tone}55`,
                              }
                            : undefined
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Screenshot (optional)">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 h-9 rounded-full",
                        "bg-white/[0.05] hover:bg-white/[0.09] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]",
                        "text-[12.5px] font-light text-foreground/85 transition-all",
                      )}
                    >
                      <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.7} />
                      {file ? "Replace" : "Attach"}
                    </button>
                    {file && (
                      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground/70 truncate">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          aria-label="Remove screenshot"
                          className="rounded-full p-1 hover:bg-white/[0.05]"
                        >
                          <X className="h-3 w-3" strokeWidth={1.8} />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size > 10 * 1024 * 1024) {
                          toast.error("Screenshot must be under 10 MB.");
                          e.target.value = "";
                          return;
                        }
                        setFile(f ?? null);
                      }}
                      className="hidden"
                    />
                  </div>
                </Field>
              </div>

              {!user && (
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3 text-[13px] text-amber-200/85 font-light">
                  Sign in so we can reply.{" "}
                  <Link to="/auth" className="underline underline-offset-4 hover:text-amber-100">
                    Sign in
                  </Link>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-4">
                <p className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.28em]")}>
                  ENCRYPTED AT REST · ADMIN ONLY
                </p>
                <GlassButton
                  type="submit"
                  tone="solid"
                  disabled={submitting || !user}
                  className="px-6 text-[13px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.8} />
                      Sending…
                    </>
                  ) : (
                    <>
                      {kindCopy[kind].cta}
                      <ArrowUpRight className="ml-1.5 h-4 w-4" strokeWidth={1.8} />
                    </>
                  )}
                </GlassButton>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </GlassPanel>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className={cn(
          TYPE_META,
          "block mb-3 text-muted-foreground/55 tracking-[0.32em]",
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentTickets — the user's own ticket log
// ─────────────────────────────────────────────────────────────────────────────
function RecentTickets({ userId }: { userId: string }) {
  const [rows, setRows] = useState<SupportTicketRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("support_tickets" as never)
          .select("id, subject, kind, severity, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (cancelled) return;
        if (error) throw error;
        setRows((data as unknown as SupportTicketRow[]) ?? []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (rows === null) {
    // Skeleton — never a bare spinner over 200ms.
    return (
      <section className="mb-16">
        <SectionHeading eyebrow="Your tickets" title="Open threads." />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-white/[0.03] animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="mb-16">
      <SectionHeading eyebrow="Your tickets" title="Open threads." />
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to="/inbox"
              className="flex items-center gap-4 px-1 py-4 hover:bg-white/[0.02] transition-colors sm:px-2"
            >
              <StatusDot status={r.status} />
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-light tracking-[-0.005em] text-foreground/95 truncate">
                  {r.subject}
                </div>
                <div className={cn(TYPE_META, "mt-1 text-muted-foreground/55 tracking-[0.28em]")}>
                  #{r.id.slice(0, 8)} · {r.kind.toUpperCase()} · {r.severity.toUpperCase()}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-muted-foreground/50">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span className={cn(TYPE_META, "tracking-[0.28em]")}>
                  {formatAgo(r.created_at)}
                </span>
              </div>
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground/55 group-hover:text-foreground transition-colors"
                strokeWidth={1.7}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusDot({ status }: { status: SupportTicketRow["status"] }) {
  const palette: Record<SupportTicketRow["status"], { color: string; label: string }> = {
    open: { color: "hsl(38 90% 60%)", label: "OPEN" },
    in_progress: { color: "hsl(215 100% 60%)", label: "IN PROGRESS" },
    resolved: { color: "hsl(150 60% 50%)", label: "RESOLVED" },
    closed: { color: "hsl(0 0% 50%)", label: "CLOSED" },
  };
  const p = palette[status];
  return (
    <div className="flex items-center gap-2.5 shrink-0 w-32">
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: p.color,
          boxShadow: `0 0 10px ${p.color}66`,
        }}
      />
      <span className={cn(TYPE_META, "text-foreground/75 tracking-[0.28em]")}>
        {p.label}
      </span>
    </div>
  );
}

function formatAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "JUST NOW";
    if (m < 60) return `${m}M AGO`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}H AGO`;
    const d = Math.floor(h / 24);
    return `${d}D AGO`;
  } catch {
    return "—";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentationRail — 4 deep links
// ─────────────────────────────────────────────────────────────────────────────
function DocumentationRail({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section className="mb-4">
      <SectionHeading eyebrow="Documentation" title="Deeper in the weeds." />
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {DOCS_LINKS.map((d, i) => {
          const Icon = d.Icon;
          return (
            <motion.div
              key={d.to}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_PREMIUM, delay: 0.05 + i * 0.05 }}
            >
              <Link
                to={d.to}
                className={cn(
                  "group/doc relative block rounded-[20px] p-6",
                  "hover:bg-white/[0.02]",
                  "transition-all duration-300",
                  "overflow-hidden",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center shrink-0">
                    <Icon
                      className="h-4 w-4 text-foreground/80 group-hover/doc:text-accent transition-colors"
                      strokeWidth={1.6}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-light tracking-[-0.01em] text-foreground">
                      {d.title}
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground/65 font-light">
                      {d.description}
                    </div>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 text-muted-foreground/55 group-hover/doc:text-accent transition-colors"
                    strokeWidth={1.7}
                  />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeading — shared eyebrow + Fraunces italic
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
        <span className="h-px w-8 bg-accent/40" />
        <span>{eyebrow}</span>
      </div>
      <h2
        className="mt-3 font-display italic leading-tight text-[28px] md:text-[34px]"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
      >
        <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
          {title}
        </span>
      </h2>
    </div>
  );
}

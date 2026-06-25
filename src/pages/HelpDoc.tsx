/**
 * HelpDoc — /help/:slug
 *
 * Stub documentation pages for the four deep-link routes the Help page
 * surfaces: editor-manual, render-pipeline, marketplace-policies,
 * api-reference. Each slug renders the same aesthetic shell with
 * curated content so the navigation lands somewhere real instead of a
 * 404. Real prose lives in the per-slug content registry below; swap
 * for markdown loaders later without touching the route table.
 */
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Cpu, ShoppingBag, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { usePageMeta } from "@/hooks/usePageMeta";

const AbstractBackground = lazy(() => import("@/components/landing/AbstractBackground"));

interface DocEntry {
  title: string;
  eyebrow: string;
  intro: string;
  Icon: typeof BookOpen;
  sections: Array<{ heading: string; body: string }>;
}

const DOCS: Record<string, DocEntry> = {
  "editor-manual": {
    title: "Editor manual",
    eyebrow: "Documentation · editor",
    Icon: BookOpen,
    intro:
      "Every panel, every shortcut, every timeline gesture in the Small Bridges editor — written for both keyboard-first power users and first-time directors. The editor is built on a non-destructive scene graph: shots, takes, and edits are all reversible.",
    sections: [
      {
        heading: "The four-pane layout",
        body:
          "Top status bar (project name + queue), left scenes (drag-to-reorder), center preview (the seamless stitch), right inspector (per-shot dials). Drag any border to resize; the layout persists per-project.",
      },
      {
        heading: "Keyboard shortcuts",
        body:
          "Space — play/pause. J/K/L — shuttle. I/O — mark in/out. Cmd+G — generate take. Cmd+/ — open palette. ⌘+S autosaves but every edit autosaves to your wallet anyway.",
      },
      {
        heading: "Scenes, shots, takes",
        body:
          "A scene is a beat. A shot is a camera. A take is a version. You can promote any take to the published shot; old takes stay in the takes drawer so you never lose a swing.",
      },
      {
        heading: "Captions",
        body:
          "Right inspector → Captions tab. Auto-transcribe via Whisper on demand. Style + reposition inline; burn-in at export, or export a sidecar .vtt for soft-subs.",
      },
    ],
  },
  "render-pipeline": {
    title: "Render pipeline",
    eyebrow: "Documentation · pipeline",
    Icon: Cpu,
    intro:
      "How a shot becomes a frame. The pipeline is a queue + fan-out + stitch + finalize loop with retry semantics and per-credit refunds on persistent failure.",
    sections: [
      {
        heading: "Lifecycle",
        body:
          "Queued → Generating → Stitching → Finalizing → Ready. Failures auto-retry once; persistent failures refund the credits and surface a reason in the project's status panel.",
      },
      {
        heading: "Quality tiers",
        body:
          "Standard (1080p, ~1 credit/sec), HD (1080p HDR, ~1.5x), Ultra (4K, ~2x), ProRes (4K HDR with ProRes 422, ~2.5x). Pick in Export, or set a project default in the studio header.",
      },
      {
        heading: "Aspect ratios",
        body:
          "9:16, 1:1, 4:5, 16:9, 21:9. The stitch worker honors the project-level aspect; mixed-source aspects are letter-/pillar-boxed at finalize.",
      },
      {
        heading: "Queue lanes",
        body:
          "Standard, priority (Growth+), dedicated (Agency+). Lane assignment is automatic from your plan; you can boost individual shots from the per-shot menu.",
      },
    ],
  },
  "marketplace-policies": {
    title: "Marketplace policies",
    eyebrow: "Documentation · market",
    Icon: ShoppingBag,
    intro:
      "Rules of the Marketplace. Creators keep 90% of every tip, atom listing, and template sale. The 10% covers Stripe + infrastructure. Refunds and takedowns are handled here.",
    sections: [
      {
        heading: "Listing rules",
        body:
          "Atoms and templates must be your original work or properly licensed. Each listing requires a preview, a price, and a license tier (personal, commercial, brand-safe).",
      },
      {
        heading: "Payouts",
        body:
          "Daily into your Stripe Connect account. Minimum payout is $10; balances under the minimum roll forward. See /account?tab=credits for the ledger.",
      },
      {
        heading: "Refunds",
        body:
          "Buyers can request a refund within 7 days. Refunded sales reverse the 90/10 split. Disputes go through Stripe and may take up to 14 days.",
      },
      {
        heading: "Takedowns",
        body:
          "DMCA notices, IP violations, or community-guideline breaches result in removal. Repeat offenders lose creator status. Appeals via the /help admin window.",
      },
    ],
  },
  "api-reference": {
    title: "API reference",
    eyebrow: "Documentation · api",
    Icon: Code2,
    intro:
      "The public Small Bridges API. REST + webhooks. Auth is per-user API key (generate in /account?tab=developers). Rate limits are tier-based.",
    sections: [
      {
        heading: "Auth",
        body:
          "Authorization: Bearer <api_key>. Keys are scoped to a single user and can be revoked at any time. Workspace keys (multi-user) are coming.",
      },
      {
        heading: "Endpoints",
        body:
          "POST /v1/projects — create. GET /v1/projects/:id — fetch state. POST /v1/projects/:id/render — enqueue a render. GET /v1/projects/:id/exports — list exports.",
      },
      {
        heading: "Webhooks",
        body:
          "Subscribe to project.created, render.started, render.completed, render.failed, payout.settled. Payloads are signed with HMAC-SHA256; verify the X-Signature header.",
      },
      {
        heading: "Rate limits",
        body:
          "Free: 60 req/min. Pro: 300 req/min. Business: 1500 req/min. Enterprise: custom. Exceeded requests get a 429 with a Retry-After header.",
      },
    ],
  },
};

export default function HelpDoc() {
  const { slug = "" } = useParams<{ slug: string }>();
  const doc = DOCS[slug];

  usePageMeta({
    title: doc ? `${doc.title} — Small Bridges` : "Documentation — Small Bridges",
    description: doc?.intro?.slice(0, 160) ?? "Small Bridges documentation.",
  });

  if (!doc) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <Suspense fallback={null}>
          <AbstractBackground />
        </Suspense>
        <main className="relative z-10 mx-auto max-w-2xl px-6 pt-24 pb-24 text-center">
          <h1
            className="font-display italic text-[44px] leading-tight"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
          >
            <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
              Document not found.
            </span>
          </h1>
          <p className="mt-4 text-muted-foreground/75">
            We don't have a doc at /help/{slug} yet.
          </p>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 mt-6 text-accent hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Help
          </Link>
        </main>
      </div>
    );
  }

  const Icon = doc.Icon;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <AbstractBackground />
      </Suspense>
      <main className="relative z-10 mx-auto w-full max-w-[860px] px-5 sm:px-8 lg:px-10 pt-14 pb-32">
        <Link
          to="/help"
          className={cn(
            TYPE_META,
            "inline-flex items-center gap-2 text-muted-foreground/55 hover:text-foreground transition-colors tracking-[0.28em]",
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
          BACK TO HELP
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM }}
          className="mt-8 mb-12"
        >
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
            <span className="h-px w-8 bg-accent/40" />
            <span>{doc.eyebrow}</span>
          </div>
          <div className="mt-6 flex items-start gap-5">
            <div className="hidden sm:inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.07] shrink-0 mt-2">
              <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.6} />
            </div>
            <h1
              className="font-display italic leading-[0.95] tracking-[-0.025em] text-[40px] md:text-[56px]"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
            >
              <span className="bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
                {doc.title}
              </span>
            </h1>
          </div>
          <p className="mt-6 max-w-2xl text-[15px] font-light leading-relaxed text-muted-foreground/75">
            {doc.intro}
          </p>
        </motion.header>

        <div className="space-y-3">
          {doc.sections.map((s, i) => (
            <motion.section
              key={s.heading}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_PREMIUM, delay: 0.05 + i * 0.05 }}
              className={cn(
                "rounded-[20px] p-6 sm:p-7",
                "bg-[hsl(220_30%_6%/0.4)] backdrop-blur-2xl",
                "border border-white/[0.05]",
                "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(TYPE_META, "text-muted-foreground/50 tabular-nums tracking-[0.32em]")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-[18px] font-light tracking-[-0.005em] text-foreground">
                  {s.heading}
                </h2>
              </div>
              <p className="mt-4 text-[14.5px] leading-[1.65] font-light text-muted-foreground/85">
                {s.body}
              </p>
            </motion.section>
          ))}
        </div>

        <div className="mt-16 rounded-[20px] border border-white/[0.05] bg-[hsl(220_30%_6%/0.35)] backdrop-blur-2xl p-7 text-center">
          <p className="text-[14px] text-muted-foreground/75 font-light">
            Still missing something?
          </p>
          <Link
            to="/help#faq"
            className="mt-3 inline-flex items-center gap-2 text-accent hover:underline text-[14px]"
          >
            Back to Help, search the FAQ, or file a ticket
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

/**
 * StudioLibrary — the curated effects + templates panel.
 *
 * Twelve cinematic looks and eight project templates, every one
 * earned by being the answer to "what do real cinematographers
 * reach for." No clutter. No "Glitch FX 47 Bundle." Just the
 * looks that defined a decade of cinema and the templates that
 * map to the kind of film an indie director actually makes.
 *
 * Surface: Shift+L opens. Two tabs (Effects · Templates). Click any
 * effect to grade the selected clip(s) — or every V1 clip when
 * nothing's selected. Click any template to recipe the whole film
 * (grade, transitions, pace) in one labelled version that's instantly
 * undoable from the Versions panel.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Sparkles, Film, Wand2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import {
  PREMIUM_EFFECTS,
  NEUTRAL_EFFECT,
  PROJECT_TEMPLATES,
  type CinematicEffect,
  type EffectCategory,
  type ProjectTemplate,
} from "@/lib/editor/library";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "effects" | "templates";

const CATEGORY_LABEL: Record<EffectCategory, string> = {
  color: "Color grades",
  film: "Film texture",
  atmosphere: "Atmosphere",
};

const CATEGORY_ORDER: EffectCategory[] = ["color", "film", "atmosphere"];

export function StudioLibrary({ open, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<Tab>("effects");
  const { selectedClipIds, applyEffectToClips, applyProjectTemplate } = useEditor();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const applyEffect = (effect: CinematicEffect) => {
    const targetIds = selectedClipIds.length > 0 ? selectedClipIds : undefined;
    const ok = applyEffectToClips(effect.cssFilter, targetIds);
    if (ok) {
      toast.message(`${effect.name} applied`, {
        description:
          selectedClipIds.length > 0
            ? `${selectedClipIds.length} ${selectedClipIds.length === 1 ? "clip" : "clips"} graded`
            : "Graded across every V1 clip",
      });
    } else {
      toast.message("No clips to grade");
    }
  };

  const applyTemplate = (template: ProjectTemplate) => {
    const effect = template.effectId
      ? PREMIUM_EFFECTS.find((e) => e.id === template.effectId)
      : undefined;
    const result = applyProjectTemplate({
      filter: effect?.cssFilter,
      fadeInSec: template.clipFades.fadeInSec,
      fadeOutSec: template.clipFades.fadeOutSec,
      transitionKind: template.transition.kind,
      transitionDurationSec: template.transition.durationSec,
      playbackSpeed: template.playbackSpeed,
    });
    toast.message(`${template.name} applied`, {
      description: `${result.clipsTouched} clips · ${result.boundariesTouched} transitions · ${template.playbackSpeed}× playback`,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.65)] backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-labelledby="library-title"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.34, ease: EASE_PREMIUM }}
            className={cn(
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
              "w-[min(1100px,94vw)] max-h-[88vh] overflow-hidden flex flex-col",
              "rounded-3xl border border-white/[0.08]",
              "bg-[hsl(220_30%_4%/0.94)] backdrop-blur-2xl",
              "shadow-[0_60px_180px_-30px_hsl(0_0%_0%/0.9)]",
            )}
          >
            {/* Header */}
            <header className="shrink-0 px-7 pt-7 pb-4 flex items-start justify-between gap-4 border-b border-white/[0.05]">
              <div className="min-w-0">
                <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                  <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
                  <span>◆ Studio Library</span>
                </div>
                <h2
                  id="library-title"
                  className="mt-1 font-display italic text-[26px] font-light tracking-tight text-foreground/95"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  Curated · the looks the field reaches for.
                </h2>
                <p className="mt-1 text-[12.5px] text-muted-foreground/65 max-w-[600px]">
                  Twelve effects. Eight templates. Every one earned by being the answer to “what would a working DP actually use here.”
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close library"
                className="text-muted-foreground/55 hover:text-foreground transition-colors mt-1"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </header>

            {/* Tabs */}
            <div className="shrink-0 px-7 pt-4 flex items-center gap-1 border-b border-white/[0.04]">
              <TabButton
                active={tab === "effects"}
                icon={<Wand2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
                label="Effects"
                count={PREMIUM_EFFECTS.length}
                onClick={() => setTab("effects")}
              />
              <TabButton
                active={tab === "templates"}
                icon={<Film className="h-3.5 w-3.5" strokeWidth={1.5} />}
                label="Templates"
                count={PROJECT_TEMPLATES.length}
                onClick={() => setTab("templates")}
              />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-6 scrollbar-hide">
              {tab === "effects" ? (
                <EffectsTab
                  selectedClipCount={selectedClipIds.length}
                  onApply={applyEffect}
                  onApplyNeutral={() => applyEffect(NEUTRAL_EFFECT)}
                />
              ) : (
                <TemplatesTab onApply={applyTemplate} />
              )}
            </div>

            <footer className="shrink-0 px-7 py-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-muted-foreground/55 font-mono uppercase tracking-[0.20em]">
              <span>Shift+L · open  ·  Esc · close</span>
              <span>{tab === "effects" ? `${PREMIUM_EFFECTS.length} curated effects` : `${PROJECT_TEMPLATES.length} curated templates`}</span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 px-4 py-2.5 rounded-t-md",
        "text-[13px] font-mono uppercase tracking-[0.18em]",
        "transition-colors",
        active
          ? "text-accent"
          : "text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.02]",
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="text-muted-foreground/45 font-mono tabular-nums">{count}</span>
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-2 bottom-0 h-0.5 bg-accent rounded-full"
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EffectsTab — color / film / atmosphere grouped chips
// ─────────────────────────────────────────────────────────────────────────────
function EffectsTab({
  selectedClipCount,
  onApply,
  onApplyNeutral,
}: {
  selectedClipCount: number;
  onApply: (e: CinematicEffect) => void;
  onApplyNeutral: () => void;
}) {
  return (
    <>
      {/* Scope hint */}
      <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.05]">
        <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>
          ◆ Applies to
        </span>
        <span className="text-[12.5px] text-foreground/95 font-mono">
          {selectedClipCount > 0
            ? `${selectedClipCount} selected ${selectedClipCount === 1 ? "clip" : "clips"}`
            : "every V1 clip"}
        </span>
      </div>

      {/* Reset row */}
      <div className="mb-7 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onApplyNeutral}
          className={cn(
            "group w-full text-left rounded-xl overflow-hidden",
            "ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.14]",
            "transition-all",
            "bg-white/[0.02] hover:bg-white/[0.04]",
            "p-3.5 flex items-center gap-4",
          )}
        >
          <div
            className="shrink-0 h-12 w-20 rounded-md ring-1 ring-inset ring-white/[0.10]"
            style={{ background: NEUTRAL_EFFECT.swatch }}
          />
          <div className="flex-1 min-w-0">
            <h3
              className="font-display italic text-[16px] text-foreground/95"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {NEUTRAL_EFFECT.name}
            </h3>
            <p className="text-[11.5px] text-muted-foreground/65">
              {NEUTRAL_EFFECT.attribution}
            </p>
          </div>
          <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground/45 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
        </button>
      </div>

      {/* Grouped by category */}
      {CATEGORY_ORDER.map((cat) => {
        const items = PREMIUM_EFFECTS.filter((e) => e.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mb-7">
            <header className="mb-3 flex items-baseline justify-between">
              <h3 className={cn(TYPE_META, "text-foreground/85 tracking-[0.32em]")}>
                ◆ {CATEGORY_LABEL[cat]}
              </h3>
              <span className={cn(TYPE_META, "text-muted-foreground/45 font-mono tabular-nums")}>
                {items.length}
              </span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {items.map((effect) => (
                <EffectCard key={effect.id} effect={effect} onApply={() => onApply(effect)} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function EffectCard({
  effect,
  onApply,
}: {
  effect: CinematicEffect;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={cn(
        "group relative w-full text-left rounded-xl overflow-hidden",
        "ring-1 ring-inset ring-white/[0.06] hover:ring-accent/45",
        "transition-all hover:-translate-y-0.5",
        "bg-white/[0.015] hover:bg-white/[0.04]",
      )}
    >
      {/* Swatch — 16:9 cinematic chip */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "16 / 9",
          background: effect.swatch,
          // Apply the filter to a darker overlay so the user sees the
          // grade tinting a real-feeling image, not just a flat color.
          filter: effect.cssFilter || undefined,
        }}
      >
        {/* Tier dot */}
        <div className="absolute top-2 right-2">
          <TierDot tier={effect.tier} />
        </div>
      </div>
      {/* Meta */}
      <div className="p-3">
        <h4
          className="font-display italic text-[15px] leading-tight text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {effect.name}
        </h4>
        <p className="mt-0.5 text-[11px] text-muted-foreground/65 line-clamp-1">
          {effect.attribution}
        </p>
      </div>
    </button>
  );
}

function TierDot({ tier }: { tier: CinematicEffect["tier"] }) {
  const label =
    tier === "studio" ? "Studio" : tier === "signature" ? "Signature" : "Cult";
  const color =
    tier === "studio"
      ? "bg-foreground/65"
      : tier === "signature"
      ? "bg-accent"
      : "bg-amber-300";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 h-5 rounded-full",
        "text-[9px] font-mono uppercase tracking-[0.18em]",
        "bg-[hsl(220_30%_4%/0.65)] backdrop-blur-sm ring-1 ring-inset ring-white/[0.10]",
        "text-foreground/85",
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", color)} />
      <span>{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplatesTab — whole-film recipes
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesTab({
  onApply,
}: {
  onApply: (t: ProjectTemplate) => void;
}) {
  return (
    <>
      <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/[0.06] ring-1 ring-inset ring-amber-500/[0.22]">
        <span className={cn(TYPE_META, "text-amber-300/85 tracking-[0.22em]")}>
          ◆ Whole-film recipe
        </span>
        <span className="text-[12.5px] text-foreground/95">
          Sets grade + transition + pace across every clip. Undo with Versions panel.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROJECT_TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} onApply={() => onApply(t)} />
        ))}
      </div>
    </>
  );
}

function TemplateCard({
  template,
  onApply,
}: {
  template: ProjectTemplate;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={cn(
        "group relative text-left rounded-2xl overflow-hidden",
        "ring-1 ring-inset ring-white/[0.06] hover:ring-accent/55",
        "transition-all hover:-translate-y-0.5",
        "bg-[hsl(220_30%_4%/0.5)]",
        "shadow-[0_20px_60px_-20px_hsl(0_0%_0%/0.6)]",
      )}
    >
      {/* Hero */}
      <div
        className="relative h-32 w-full"
        style={{ background: template.hero }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[hsl(220_30%_3%/0.65)]" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3
            className="font-display italic text-[22px] font-light leading-none tracking-tight text-foreground/95"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {template.name}
          </h3>
          <p className="mt-1 text-[11.5px] text-foreground/80">
            {template.tagline}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-[12.5px] text-foreground/75 leading-snug">
          {template.description}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px] font-mono uppercase tracking-[0.16em]">
          <div>
            <dt className="text-muted-foreground/45">Transition</dt>
            <dd className="text-foreground/85">
              {template.transition.kind}
              <span className="text-muted-foreground/55"> · {template.transition.durationSec.toFixed(2)}s</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground/45">Speed</dt>
            <dd className="text-foreground/85">{template.playbackSpeed}×</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/45">Grade</dt>
            <dd className="text-foreground/85 truncate">
              {template.effectId
                ? PREMIUM_EFFECTS.find((e) => e.id === template.effectId)?.name ?? "—"
                : "Neutral"}
            </dd>
          </div>
        </dl>
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-accent group-hover:text-foreground transition-colors">
          <span>Apply template</span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </div>
      </div>
    </button>
  );
}

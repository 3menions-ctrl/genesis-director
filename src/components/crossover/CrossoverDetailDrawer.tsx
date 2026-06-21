/**
 * CrossoverDetailDrawer — full editorial detail surface for one crossover.
 *
 * Visual language matches Template + Environment drawers: floating glass
 * panels, gradient italic titles, mono labels, editorial typography.
 *
 * Sections:
 *   - Hero band (thumb + name + hook + favorite + badges)
 *   - Render plan (engine + aspect + quality + ETA + credits + chrome)
 *   - Chrome preview embed (the UI mock-up the subject breaks out of)
 *   - The break (pure_prompt + collapsible negative_prompt)
 *   - Choreography (motion_hint + recipe + particle density visual)
 *   - Mood lab (all 10 mood presets with swatches + tail preview)
 *   - Audio + style (music genre + sfx tags + color LUT)
 *   - Subject pairing (subject_id_method guidance)
 *   - CTAs (Customize → opens TemplateComposer · Quick generate · favorite)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
  Sparkles,
  Cpu,
  Film,
  Music,
  Wand2,
  ArrowRight,
  Activity,
  ChevronDown,
  Camera,
  User as UserIcon,
  Layers,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChromePreview } from "@/components/crossover/ChromePreview";
import {
  type CrossoverBlueprint,
  type CrossoverMood,
  CROSSOVER_CATEGORY_SHORT,
  RECIPE_LABELS,
  MOTION_LABELS,
  SUBJECT_METHOD_LABELS,
  SUBJECT_METHOD_GUIDANCE,
  DIFFUSION_MODEL_LABELS,
  WORLD_LABELS,
  type RecipeSlug,
  type MotionHint,
} from "@/lib/crossovers/blueprint";
import { ENGINES } from "@/lib/video/engines";
import { ASPECT_RATIOS } from "@/lib/editor/types";

const TIER_HUE: Record<string, string> = {
  standard: "hsl(195 90% 70%)",
  pro:      "hsl(48 90% 70%)",
  cinema:   "hsl(330 90% 72%)",
};
const QUALITY_LABEL: Record<string, string> = {
  "hd-1080":       "HD 1080p",
  "hd-1080-60":    "HD · 60 fps",
  "4k-cinema":     "4K Cinema",
  "4k-cinema-60":  "4K Cinema · 60",
};

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Chip({
  children, hue, onClick, active,
}: {
  children: React.ReactNode;
  hue?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const color = hue ?? "hsl(48 80% 86%)";
  const props = {
    className: "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-mono uppercase tracking-[0.18em] ring-1 ring-inset transition-all",
    style: active ? {
      color: "#0b0b14",
      background: color,
      borderColor: color,
    } : {
      color,
      background: color.replace(")", " / 0.07)").replace("hsl(", "hsla("),
      borderColor: color.replace(")", " / 0.25)").replace("hsl(", "hsla("),
    },
  };
  if (onClick) return <button {...props} onClick={onClick}>{children}</button>;
  return <span {...props}>{children}</span>;
}

function AspectFrame({ aspect }: { aspect: CrossoverBlueprint["aspectRatio"] }) {
  const dims = ASPECT_RATIOS[aspect];
  const wPx = 26;
  const hPx = (wPx * dims.h) / dims.w;
  return (
    <span
      className="inline-block ring-1 ring-inset ring-white/40 rounded-[3px]"
      style={{ width: wPx, height: Math.max(hPx, 12), background: "hsl(48 80% 88% / 0.18)" }}
      aria-hidden
    />
  );
}

export function CrossoverDetailDrawer({
  crossover,
  open,
  onClose,
  onCustomize,
  onQuickGenerate,
  isFavorite,
  onToggleFavorite,
}: {
  crossover: CrossoverBlueprint | null;
  open: boolean;
  onClose: () => void;
  onCustomize: (bp: CrossoverBlueprint) => void;
  onQuickGenerate: (bp: CrossoverBlueprint, mood: CrossoverMood) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [activeMood, setActiveMood] = useState<CrossoverMood>("default");
  const [showNegative, setShowNegative] = useState(false);

  return (
    <AnimatePresence>
      {open && crossover && (
        <>
          {/* IMMERSIVE BACKDROP — crossover thumbnail fills the entire
              viewport (inset-0) including behind the LeftRail. The
              rail (z-40) sits on top; the modal (z-100) floats above. */}
          <motion.div
            key="backdrop-img"
            aria-hidden
            className="fixed inset-0 z-[30] bg-cover bg-center"
            style={crossover.thumbnailUrl ? { backgroundImage: `url("${crossover.thumbnailUrl}")` } : { background: "linear-gradient(135deg, hsl(220 60% 8%), hsl(220 40% 12%) 60%, hsl(280 50% 15%))" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="backdrop-tint"
            aria-hidden
            className="fixed inset-0 z-[31] bg-[hsl(220_30%_3%/0.55)] bg-gradient-to-b from-[hsl(220_30%_3%/0.5)] via-[hsl(220_30%_3%/0.45)] to-[hsl(220_30%_3%/0.7)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Floating modal frame — no shell of its own. */}
          <div
            key="dialog-wrap"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 pointer-events-none"
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={`${crossover.name} crossover details`}
              className="pointer-events-auto relative w-full max-w-[920px] max-h-[92vh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="relative flex-1 min-h-0 overflow-y-auto">
            <HeroBand
              crossover={crossover}
              onClose={onClose}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
            />

            <RenderPlanCard crossover={crossover} />

            <ChromePreviewSection crossover={crossover} />

            <PromptSection
              crossover={crossover}
              showNegative={showNegative}
              setShowNegative={setShowNegative}
            />

            <ChoreographySection crossover={crossover} />

            <MoodLab
              crossover={crossover}
              activeMood={activeMood}
              setActiveMood={setActiveMood}
            />

            <AudioStyleSection crossover={crossover} />

            {crossover.acceptsSubject && (
              <SubjectPairingSection crossover={crossover} />
            )}

            {/* ── CTAs ─────────────────────────────────────────── */}
            <footer className="sticky bottom-0 mt-6 px-5 sm:px-7 py-4 bg-gradient-to-t from-[hsl(220_30%_3%/0.95)] via-[hsl(220_30%_3%/0.75)] to-transparent backdrop-blur-xl border-t border-white/[0.10]">
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <Button
                  size="lg"
                  className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 font-medium tracking-wide rounded-xl"
                  onClick={() => onCustomize(crossover)}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Customize & generate
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/[0.12] bg-white/[0.02] backdrop-blur text-foreground hover:bg-white/[0.05] rounded-xl"
                  onClick={() => onQuickGenerate(crossover, activeMood)}
                >
                  Quick generate
                </Button>
              </div>
              <p className="mt-3 text-[10px] text-foreground/40 text-center leading-relaxed font-mono uppercase tracking-[0.18em]">
                Renders via the Hollywood Pipeline · costs ~{crossover.estimatedCreditCost} credits
              </p>
            </footer>
              </div>
            </motion.aside>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero band
// ─────────────────────────────────────────────────────────────────────────────
function HeroBand({
  crossover, onClose, isFavorite, onToggleFavorite,
}: {
  crossover: CrossoverBlueprint;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  // Image lives on the modal background now (set by the outer
  // motion.aside). This HeroBand only owns chrome: close button,
  // badges, favorite, and the title glass card.
  return (
    <header className="relative px-5 sm:px-7 pt-5 pb-6">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl ring-1 ring-inset ring-white/20 text-white/95 hover:text-white transition-colors shadow-[0_4px_16px_-2px_rgba(0,0,0,0.55)]"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-wrap gap-2">
        {crossover.isFeatured && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-amber-500/85 text-foreground text-[10px] font-mono uppercase tracking-[0.18em] shadow-[0_10px_30px_-6px_hsla(45,100%,60%,0.5)]">
            <Sparkles className="w-3 h-3" />
            Featured
          </span>
        )}
        {crossover.acceptsSubject && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-500/25 ring-1 ring-inset ring-emerald-300/40 text-emerald-100 text-[10px] font-mono uppercase tracking-[0.18em] backdrop-blur">
            <UserIcon className="w-3 h-3" />
            Subject-ready
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-foreground/85 text-[10px] font-mono uppercase tracking-[0.18em] backdrop-blur">
          {CROSSOVER_CATEGORY_SHORT[crossover.category]}
        </span>
      </div>

      {/* Title glass card with the favorite-star anchored top-right. */}
      <div className="mt-4 relative rounded-2xl bg-white/[0.035] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.55)] p-5">
        <button
          onClick={onToggleFavorite}
          className="absolute top-4 right-4 inline-flex items-center justify-center h-10 w-10 rounded-full ring-1 ring-inset ring-white/15 transition-all"
          style={{
            background: isFavorite ? "hsl(48 95% 70%)" : "rgba(0,0,0,0.55)",
            color: isFavorite ? "#000" : "#fff",
          }}
          aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
        >
          <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} strokeWidth={1.6} />
        </button>
        <h2 className="text-3xl sm:text-4xl font-display italic font-light leading-[0.95] pr-14">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            {crossover.name}
          </span>
        </h2>
        {crossover.hook && (
          <p className="mt-2 text-[13px] text-foreground/80 max-w-[92%] italic">
            {crossover.hook}
          </p>
        )}
        <div className="mt-3 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/55">
          <span>{WORLD_LABELS[crossover.world]}</span>
          {crossover.useCount && crossover.useCount > 0 ? (
            <>
              <span>·</span>
              <span>{compactNum(crossover.useCount)} remixes</span>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Render plan
// ─────────────────────────────────────────────────────────────────────────────
function RenderPlanCard({ crossover }: { crossover: CrossoverBlueprint }) {
  const engine = ENGINES[crossover.engine];
  const aspectDims = ASPECT_RATIOS[crossover.aspectRatio];

  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
        Render plan
      </h3>
      <div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Engine
            </div>
            <div className="text-[14px] font-medium text-foreground/95">{engine.shortLabel}</div>
            <div
              className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em]"
              style={{ color: TIER_HUE[engine.tier] }}
            >
              {engine.tier}
            </div>
            {crossover.preferredModel && (
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-foreground/40">
                via {DIFFUSION_MODEL_LABELS[crossover.preferredModel]}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Film className="w-3 h-3" /> Aspect
            </div>
            <div className="flex items-center gap-2">
              <AspectFrame aspect={crossover.aspectRatio} />
              <div>
                <div className="text-[14px] font-medium text-foreground/95">{crossover.aspectRatio}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
                  {aspectDims.label}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Quality
            </div>
            <div className="text-[14px] font-medium text-foreground/95">{QUALITY_LABEL[crossover.qualityTier]}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mt-0.5">
              {crossover.targetHeight ?? 1080}p · {crossover.targetFps ?? 24}fps
            </div>
          </div>

          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Activity className="w-3 h-3" /> ETA · Cost
            </div>
            <div className="text-[14px] font-medium text-foreground/95">
              ~{Math.floor(crossover.estimatedEtaSec / 60)}m {crossover.estimatedEtaSec % 60}s
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
              {crossover.estimatedCreditCost === 0 ? "FREE TIER" : `${crossover.estimatedCreditCost} credits`}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/45">
          <span>1 clip · {crossover.estimatedDurationSec}s · Chrome: {crossover.chrome.kind}</span>
          {crossover.upscaleFactor && crossover.upscaleFactor > 1 && (
            <span>{crossover.upscaleFactor}× upscale</span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome preview
// ─────────────────────────────────────────────────────────────────────────────
function ChromePreviewSection({ crossover }: { crossover: CrossoverBlueprint }) {
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
        The screen it breaks out of
      </h3>
      <div className="flex items-center justify-center">
        <div className="w-full max-w-[280px]">
          <ChromePreview
            kind={crossover.chrome.kind}
            aspectRatio={crossover.aspectRatio}
            posterUrl={crossover.thumbnailUrl}
          />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt section
// ─────────────────────────────────────────────────────────────────────────────
function PromptSection({
  crossover, showNegative, setShowNegative,
}: {
  crossover: CrossoverBlueprint;
  showNegative: boolean;
  setShowNegative: (v: boolean) => void;
}) {
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3">
        The break · pure prompt
      </h3>
      <div className="p-1">
        <p className="text-[12.5px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {crossover.purePrompt}
        </p>
        {crossover.negativePrompt && (
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <button
              onClick={() => setShowNegative(!showNegative)}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45 hover:text-foreground/80 transition-colors inline-flex items-center gap-1.5"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showNegative ? "rotate-180" : ""}`} />
              Negative prompt ({crossover.negativePrompt.split(/\s+/).length} tokens)
            </button>
            {showNegative && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-rose-200/65 italic whitespace-pre-wrap">
                {crossover.negativePrompt}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Choreography
// ─────────────────────────────────────────────────────────────────────────────
function ChoreographySection({ crossover }: { crossover: CrossoverBlueprint }) {
  const density = crossover.particleDensity ?? 0.5;
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3 inline-flex items-center gap-2">
        <Camera className="w-3 h-3" />
        Choreography
      </h3>
      <div className="p-1 space-y-4">
        {crossover.motionHint && (
          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-0.5">Motion</div>
            <div className="flex-1">
              <Chip hue="hsl(200 80% 70%)">{MOTION_LABELS[crossover.motionHint as MotionHint] ?? crossover.motionHint}</Chip>
            </div>
          </div>
        )}

        {crossover.recipeSlug && (
          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-0.5">VFX recipe</div>
            <div className="flex-1">
              <Chip hue="hsl(48 95% 72%)">
                <Wand2 className="w-3 h-3" />
                {RECIPE_LABELS[crossover.recipeSlug as RecipeSlug] ?? crossover.recipeSlug}
              </Chip>
            </div>
          </div>
        )}

        {crossover.particleDensity != null && (
          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-0.5">Particles</div>
            <div className="flex-1">
              <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden ring-1 ring-inset ring-white/[0.06]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(0.06, density) * 100}%`,
                    background: "linear-gradient(90deg, hsl(195 80% 65%), hsl(48 95% 70%))",
                  }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-foreground/45 tabular-nums">
                {Math.round(density * 100)}% density {density > 0.7 ? "· VFX-heavy" : density < 0.3 ? "· minimal" : "· balanced"}
              </div>
            </div>
          </div>
        )}

        {(crossover.depthCompositing || crossover.interpolate) && (
          <div className="flex items-baseline gap-4 pt-2 border-t border-white/[0.05]">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-0.5">Pipeline</div>
            <div className="flex-1 flex flex-wrap gap-1.5">
              {crossover.depthCompositing && <Chip hue="hsl(280 70% 75%)">Depth compositing</Chip>}
              {crossover.interpolate && <Chip hue="hsl(160 70% 70%)">Frame interpolation</Chip>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mood lab — all 10 presets with swatch previews + active tail
// ─────────────────────────────────────────────────────────────────────────────
function MoodLab({
  crossover, activeMood, setActiveMood,
}: {
  crossover: CrossoverBlueprint;
  activeMood: CrossoverMood;
  setActiveMood: (m: CrossoverMood) => void;
}) {
  const preset = crossover.availableMoods.find(m => m.key === activeMood)!;
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3 inline-flex items-center gap-2">
        <Layers className="w-3 h-3" />
        Mood lab · 10 presets
      </h3>
      <div className="p-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {crossover.availableMoods.map(m => {
            const isActive = m.key === activeMood;
            return (
              <button
                key={m.key}
                onClick={() => setActiveMood(m.key)}
                className={`group/mood relative rounded-xl ring-1 ring-inset px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? "ring-white/[0.18] bg-white/[0.04]"
                    : "ring-white/[0.05] bg-white/[0.015] hover:ring-white/[0.12] hover:bg-white/[0.025]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex">
                    {[m.swatch.primary, m.swatch.secondary, m.swatch.accent].map((c, i) => (
                      <span
                        key={i}
                        className="h-3.5 w-3.5 rounded-sm ring-1 ring-inset ring-white/15"
                        style={{ background: c, marginLeft: i ? -4 : 0 }}
                      />
                    ))}
                  </span>
                  {isActive && <Zap className="w-3 h-3 text-amber-300 ml-auto" />}
                </div>
                <div className="text-[11.5px] font-medium text-foreground/90 leading-tight">{m.label.split(" · ")[0]}</div>
                <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-foreground/40 mt-0.5 truncate">
                  {m.label.split(" · ")[1] ?? ""}
                </div>
              </button>
            );
          })}
        </div>

        {preset.promptTail && (
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5">Tail injection</div>
            <p className="text-[11.5px] leading-relaxed text-foreground/75 italic">{preset.promptTail.trim()}</p>
          </div>
        )}
        {!preset.promptTail && (
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/40 text-center py-2">
            Default · no mood tail · uses pure recipe only
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio + style
// ─────────────────────────────────────────────────────────────────────────────
function AudioStyleSection({ crossover }: { crossover: CrossoverBlueprint }) {
  if (!crossover.musicGenre && !crossover.colorLut && (!crossover.sfxTags || crossover.sfxTags.length === 0)) {
    return null;
  }
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3 inline-flex items-center gap-2">
        <Music className="w-3 h-3" />
        Audio + style
      </h3>
      <div className="p-1 space-y-3">
        {crossover.musicGenre && (
          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24">Music</div>
            <Chip hue="hsl(330 80% 72%)">{crossover.musicGenre}</Chip>
          </div>
        )}
        {crossover.sfxTags && crossover.sfxTags.length > 0 && (
          <div className="flex items-start gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-0.5">SFX</div>
            <div className="flex flex-wrap gap-1.5">
              {crossover.sfxTags.map(s => (
                <Chip key={s} hue="hsl(195 80% 70%)">{s}</Chip>
              ))}
            </div>
          </div>
        )}
        {crossover.colorLut && (
          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24">LUT</div>
            <Chip hue="hsl(48 95% 72%)">{crossover.colorLut}</Chip>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject pairing
// ─────────────────────────────────────────────────────────────────────────────
function SubjectPairingSection({ crossover }: { crossover: CrossoverBlueprint }) {
  return (
    <section className="mx-5 sm:mx-7 mt-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3 inline-flex items-center gap-2">
        <UserIcon className="w-3 h-3" />
        Subject pairing
      </h3>
      <div className="rounded-2xl ring-1 ring-inset ring-emerald-300/15 bg-emerald-500/[0.04] backdrop-blur p-4">
        <div className="flex items-baseline gap-3">
          <Chip hue="hsl(160 75% 65%)">{SUBJECT_METHOD_LABELS[crossover.subjectIdMethod]}</Chip>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-foreground/75">
          {SUBJECT_METHOD_GUIDANCE[crossover.subjectIdMethod]}
        </p>
      </div>
    </section>
  );
}

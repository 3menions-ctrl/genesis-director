/**
 * TemplateDetailDrawer — full storyboard preview for a TemplateBlueprint.
 *
 * Slide-in panel from the right. Shows:
 *   - Hero band (thumb, name, description, use count, badges)
 *   - Render plan card (engine + aspect + quality + ETA + credits)
 *   - Storyboard strip — clip 1 → 2 → 3, with the transition kind between
 *   - Per-clip blueprint — label, prompt, duration, VFX chips, props
 *   - Style — color grade swatches, pacing, music mood
 *   - CTAs: Use as-is / Save to library
 *
 * Visual language matches ProfileDashboard: floating glassmorphic
 * panels, rounded-2xl, ring-inset ring-white/[0.06], bg-white/[0.015],
 * backdrop-blur. Gradient text headers. Editorial typography.
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Heart,
  Sparkles,
  Film,
  Clock,
  Zap,
  Cpu,
  Wand2,
  Music,
  ArrowRight,
  Users,
  Layers,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  type TemplateBlueprint,
  type ClipBlueprint,
  type VfxPreset,
  VFX_PRESET_LABELS,
  VFX_CATEGORY_OF,
  QUALITY_TIER_LABELS,
  PACING_LABELS,
  MUSIC_MOOD_LABELS,
  totalClipDuration,
  totalVfxPresetCount,
  distinctVfxPresets,
} from "@/lib/templates/blueprint";
import { TRANSITION_LABELS, ASPECT_RATIOS } from "@/lib/editor/types";
import { ENGINES, creditsForScene } from "@/lib/video/engines";

const TIER_HUE: Record<string, string> = {
  standard: "hsl(195 90% 70%)",
  pro:      "hsl(48 90% 70%)",
  cinema:   "hsl(330 90% 72%)",
};

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function VfxChip({ preset }: { preset: VfxPreset }) {
  const cat = VFX_CATEGORY_OF[preset];
  const hue =
    cat === "motion"  ? "hsl(200 80% 70%)" :
    cat === "speed"   ? "hsl(280 80% 75%)" :
    cat === "optical" ? "hsl(48 95% 72%)"  :
    cat === "color"   ? "hsl(15 85% 70%)"  :
                        "hsl(160 70% 70%)";
  return (
    <span
      className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-mono uppercase tracking-[0.10em] ring-1 ring-inset"
      style={{
        color: hue,
        background: `${hue.replace(")", " / 0.08)").replace("hsl(", "hsla(")}`,
        borderColor: `${hue.replace(")", " / 0.25)").replace("hsl(", "hsla(")}`,
      }}
    >
      {VFX_PRESET_LABELS[preset]}
    </span>
  );
}

function AspectFrame({ aspect }: { aspect: TemplateBlueprint["aspectRatio"] }) {
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

function ClipCard({ clip, index }: { clip: ClipBlueprint; index: number }) {
  return (
    <div className="relative rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] backdrop-blur p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
            Clip {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className="text-base font-display italic text-foreground/95">
            {clip.label}
          </h4>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-foreground/65 tabular-nums">
          <Clock className="w-3 h-3" />
          {clip.durationSec}s
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-foreground/70 line-clamp-3">
        {clip.prompt}
      </p>

      {clip.vfxPresets && clip.vfxPresets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clip.vfxPresets.map((p) => <VfxChip key={p} preset={p} />)}
        </div>
      )}

      {clip.properties && (
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-[0.16em] text-foreground/45">
          {clip.properties.speed != null && <span>SPD {clip.properties.speed.toFixed(2)}×</span>}
          {clip.properties.opacity != null && <span>OPC {Math.round(clip.properties.opacity * 100)}%</span>}
          {clip.properties.scale != null && <span>SCL {clip.properties.scale.toFixed(2)}×</span>}
          {clip.properties.fadeInSec != null && clip.properties.fadeInSec > 0 && <span>FIN {clip.properties.fadeInSec}s</span>}
          {clip.properties.fadeOutSec != null && clip.properties.fadeOutSec > 0 && <span>FOT {clip.properties.fadeOutSec}s</span>}
          {clip.properties.mirror && <span>MIRROR</span>}
        </div>
      )}

      {clip.visualElements && clip.visualElements.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <ul className="space-y-1 text-[11px] text-foreground/55">
            {clip.visualElements.map((el, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 flex-shrink-0" />
                {el}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TemplateDetailDrawer({
  template,
  open,
  onClose,
  onUse,
}: {
  template: TemplateBlueprint | null;
  open: boolean;
  onClose: () => void;
  onUse: (bp: TemplateBlueprint) => void;
}) {
  return (
    <AnimatePresence>
      {open && template && (
        <>
          {/* IMMERSIVE BACKDROP — the template's cover image fills the
              ENTIRE viewport (inset-0) including behind the LeftRail.
              The rail (z-40) and modal (z-100) sit on top of these
              layers; the image + tint cover everything else. */}
          <motion.div
            key="backdrop-img"
            aria-hidden
            className="fixed inset-0 z-[30] bg-cover bg-center"
            style={template.thumbnailUrl ? { backgroundImage: `url("${template.thumbnailUrl}")` } : undefined}
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

          {/* Floating modal frame — no shell of its own. Just a
              max-width container that scrolls; all visible chrome is
              the glass cards inside. Dismissed only by the X button. */}
          <div
            key="dialog-wrap"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 pointer-events-none"
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={`${template.name} template details`}
              className="pointer-events-auto relative w-full max-w-[860px] max-h-[92vh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="relative flex-1 min-h-0 overflow-y-auto">
            {/* ── HERO BAND — chrome only (title, badges, close).
                 The image is now the modal's background, not the hero. */}
            <header className="relative px-5 sm:px-7 pt-5 pb-6">

              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl ring-1 ring-inset ring-white/20 text-white/95 hover:text-white transition-colors shadow-[0_4px_16px_-2px_rgba(0,0,0,0.55)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Badge cluster — sits in the hero header padding now */}
              <div className="flex flex-wrap gap-2">
                {template.isBreakout && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[hsl(215_100%_60%)] text-[10px] font-mono uppercase tracking-[0.18em] text-foreground shadow-[0_10px_30px_-6px_hsla(215,100%,60%,0.6)]">
                    <Zap className="w-3 h-3" />
                    4th Wall · Pro
                  </span>
                )}
                {template.isTrending && !template.isBreakout && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-rose-500/20 ring-1 ring-inset ring-rose-300/40 text-[10px] font-mono uppercase tracking-[0.18em] text-rose-100">
                    <Sparkles className="w-3 h-3" />
                    Hot
                  </span>
                )}
                {template.isPro && !template.isBreakout && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-amber-500/20 ring-1 ring-inset ring-amber-300/40 text-[10px] font-mono uppercase tracking-[0.18em] text-amber-100">
                    Pro entitlement
                  </span>
                )}
              </div>

              {/* Title + meta — wrapped in a glass card sitting over
                  the image. Heavy backdrop blur + translucent fill +
                  inset highlight = "made of glass". */}
              <div className="mt-4 rounded-2xl bg-white/[0.035] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.55)] p-5">
                <h2 className="text-3xl sm:text-4xl font-display italic font-light leading-[0.95]">
                  <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                    {template.name}
                  </span>
                </h2>
                <p className="mt-2 text-[13px] text-foreground/80 max-w-[88%]">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {compactNum(template.useCount)} used
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {template.clips.length} clips
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {totalClipDuration(template)}s
                  </span>
                </div>
              </div>
            </header>

            {/* All content sections below sit in glass cards over the
                image. Pattern: rounded-2xl + white/[0.06] fill + heavy
                backdrop blur + inset highlight for a real glass feel. */}
            <div className="px-5 sm:px-7 pb-5 space-y-4">

            {/* ── RENDER PLAN ─────────────────────────────────── */}
            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)]">
              <RenderPlanCard template={template} />
            </div>

            {/* ── STORYBOARD STRIP ────────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
                Storyboard
              </h3>
              <StoryboardStrip template={template} />
            </section>

            {/* ── PER-CLIP BLUEPRINT ──────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
                Clip blueprint
              </h3>
              <div className="space-y-3">
                {template.clips.map((c, i) => (
                  <ClipCard key={c.id} clip={c} index={i} />
                ))}
              </div>
            </section>

            {/* ── STYLE ───────────────────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
                Style + audio
              </h3>
              <div className="space-y-4">
                {/* Color grade */}
                <div className="flex items-center gap-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24">Grade</div>
                  <div className="flex items-center gap-2 flex-1">
                    {[template.colorGrade.primary, template.colorGrade.secondary, template.colorGrade.accent].map((hex) => (
                      <span
                        key={hex}
                        className="h-6 w-6 rounded-md ring-1 ring-inset ring-white/15"
                        style={{ background: hex }}
                        title={hex}
                      />
                    ))}
                    {template.colorGrade.label && (
                      <span className="ml-2 text-[11.5px] text-foreground/70 italic">
                        {template.colorGrade.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pacing */}
                <div className="flex items-center gap-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24">Pacing</div>
                  <div className="text-[12.5px] text-foreground/75">
                    {PACING_LABELS[template.pacing]}
                    {template.playbackSpeed != null && template.playbackSpeed !== 1 && (
                      <span className="ml-2 font-mono text-foreground/50">{template.playbackSpeed.toFixed(2)}×</span>
                    )}
                  </div>
                </div>

                {/* Music */}
                <div className="flex items-center gap-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24">Music</div>
                  <div className="text-[12.5px] text-foreground/75 inline-flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 text-foreground/45" />
                    {MUSIC_MOOD_LABELS[template.musicMood]}
                    {template.includeSfx && <span className="ml-2 font-mono text-[10px] text-foreground/50 uppercase tracking-[0.16em]">+ SFX</span>}
                  </div>
                </div>

                {/* VFX summary */}
                <div className="flex items-start gap-4 pt-3 border-t border-white/[0.05]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45 w-24 pt-1">VFX</div>
                  <div className="flex-1">
                    <div className="text-[11px] font-mono text-foreground/55 mb-2">
                      {totalVfxPresetCount(template)} preset application{totalVfxPresetCount(template) === 1 ? "" : "s"} · {distinctVfxPresets(template).length} unique
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {distinctVfxPresets(template).map((p) => <VfxChip key={p} preset={p} />)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            </div>{/* /content sections wrapper */}

            {/* ── CTAs ───────────────────────────────────────── */}
            <footer className="sticky bottom-0 px-5 sm:px-7 py-4 bg-gradient-to-t from-[hsl(220_30%_3%/0.95)] via-[hsl(220_30%_3%/0.75)] to-transparent backdrop-blur-xl border-t border-white/[0.10]">
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 font-medium tracking-wide rounded-xl"
                  onClick={() => onUse(template)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Use this template
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <button
                  className="inline-flex items-center justify-center h-12 w-12 rounded-xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] text-foreground/70 hover:text-foreground transition-colors"
                  aria-label="Save to library"
                  title="Save to library"
                >
                  <Heart className="w-4 h-4" />
                </button>
              </div>
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
// Render plan card — engine + aspect + quality + ETA + credits
// ─────────────────────────────────────────────────────────────────────────────
function RenderPlanCard({ template }: { template: TemplateBlueprint }) {
  const engine = ENGINES[template.engine];
  const totalDuration = totalClipDuration(template);
  const totalEtaSec = Math.round(engine.etaSeconds * template.clips.length);
  const totalCredits = template.clips.reduce((sum, c) => {
    try {
      // Defer to engine's allowed durations; clamp to closest
      const dur = engine.durations.includes(c.durationSec)
        ? c.durationSec
        : engine.durations.reduce((b, d) => (Math.abs(d - c.durationSec) < Math.abs(b - c.durationSec) ? d : b), engine.durations[0]);
      return sum + creditsForScene(template.engine, dur);
    } catch {
      return sum;
    }
  }, 0);

  return (
    <section className="px-5 sm:px-7 pt-6 pb-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mb-3">
        Render plan
      </h3>
      <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Engine */}
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Engine
            </div>
            <div className="text-[14px] font-medium text-foreground/95">{engine.shortLabel}</div>
            <div
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em]"
              style={{ color: TIER_HUE[engine.tier] }}
            >
              {engine.tier}
            </div>
          </div>

          {/* Aspect */}
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Film className="w-3 h-3" /> Aspect
            </div>
            <div className="flex items-center gap-2">
              <AspectFrame aspect={template.aspectRatio} />
              <div>
                <div className="text-[14px] font-medium text-foreground/95">{template.aspectRatio}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
                  {ASPECT_RATIOS[template.aspectRatio].label}
                </div>
              </div>
            </div>
          </div>

          {/* Quality */}
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Quality
            </div>
            <div className="text-[14px] font-medium text-foreground/95">{QUALITY_TIER_LABELS[template.qualityTier]}</div>
          </div>

          {/* ETA + credits */}
          <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
              <Activity className="w-3 h-3" /> ETA · Cost
            </div>
            <div className="text-[14px] font-medium text-foreground/95">
              ~{Math.floor(totalEtaSec / 60)}m {totalEtaSec % 60}s
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
              {totalCredits === 0 ? "FREE TIER" : `${totalCredits} credits`}
            </div>
          </div>
        </div>

        {/* Per-clip duration breakdown */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/45">
          <span>{template.clips.length} clips · {totalDuration}s total</span>
          <span>{template.transitions?.length ?? 0} transitions</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Storyboard strip — clip 1 [transition] clip 2 [transition] clip 3 …
// ─────────────────────────────────────────────────────────────────────────────
function StoryboardStrip({ template }: { template: TemplateBlueprint }) {
  return (
    <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4 overflow-x-auto">
      <div className="flex items-stretch gap-2 min-w-min">
        {template.clips.map((clip, i) => (
          <div key={clip.id} className="flex items-stretch gap-2">
            <div className="w-[140px] sm:w-[160px] flex-shrink-0">
              <div className="aspect-video rounded-lg overflow-hidden ring-1 ring-inset ring-white/[0.08] bg-black/40 relative">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${template.colorGrade.primary} 0%, ${template.colorGrade.secondary} 50%, ${template.colorGrade.accent} 100%)`,
                    opacity: 0.35,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display italic text-2xl text-white/85 drop-shadow">{i + 1}</span>
                </div>
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.18em] text-white/70">
                  <span>{clip.durationSec}s</span>
                  {clip.vfxPresets && clip.vfxPresets.length > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Wand2 className="w-2.5 h-2.5" />
                      {clip.vfxPresets.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 px-1 text-center">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/40">Clip {i + 1}</div>
                <div className="text-[12px] font-display italic text-foreground/85 line-clamp-1">{clip.label}</div>
              </div>
            </div>

            {/* transition badge between clips */}
            {i < template.clips.length - 1 && (
              <div className="flex flex-col items-center justify-center px-1">
                <div className="h-px w-6 bg-white/20" />
                <div className="my-1.5 inline-flex items-center justify-center h-7 px-2 rounded-full ring-1 ring-inset ring-white/[0.08] bg-white/[0.04] text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/65">
                  {template.transitions?.[i] ? TRANSITION_LABELS[template.transitions[i]] : "Cut"}
                </div>
                <div className="h-px w-6 bg-white/20" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

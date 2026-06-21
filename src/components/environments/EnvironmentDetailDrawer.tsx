/**
 * EnvironmentDetailDrawer — slide-in panel with the full scene blueprint.
 *
 * Visual language mirrors TemplateDetailDrawer: floating glassmorphic
 * panels, rounded-2xl, ring-inset, gradient text, editorial typography.
 *
 * Surfaces:
 *   - Hero image band (env image + name + description + favorite)
 *   - Scene plan (lighting + camera + sound)
 *   - 4-swatch color palette + temperature chip
 *   - Generator prompt (the subject-embedded scene description)
 *   - Atmospheric chips (weather + season + terrain + world)
 *   - VFX hint chips
 *   - CTA "Apply to project"
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
  Sparkles,
  Camera,
  Music,
  CloudSun,
  Sun,
  Wand2,
  ArrowRight,
  Palette,
  ThermometerSun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type EnvironmentBlueprint,
  ENV_WORLD_LABELS,
  WEATHER_LABELS,
  SEASON_LABELS,
  TERRAIN_LABELS,
  AMBIENT_LABELS,
  MUSIC_HINT_LABELS,
  CAMERA_MOVEMENT_LABELS,
  LENS_LABELS,
  ENV_VFX_LABELS,
} from "@/lib/environments/blueprint";

const TEMPERATURE_LABEL: Record<string, string> = {
  warm: "Warm", cool: "Cool", very_warm: "Very warm", very_cool: "Very cool",
  neutral: "Neutral", desaturated: "Desaturated", mixed: "Mixed",
};
const TEMPERATURE_HUE: Record<string, string> = {
  warm: "hsl(28 90% 65%)",
  very_warm: "hsl(15 90% 60%)",
  cool: "hsl(200 80% 70%)",
  very_cool: "hsl(220 85% 70%)",
  neutral: "hsl(48 25% 80%)",
  desaturated: "hsl(220 10% 60%)",
  mixed: "hsl(280 60% 70%)",
};

const TIME_OF_DAY_LABEL: Record<string, string> = {
  golden_hour: "Golden hour", blue_hour: "Blue hour", twilight: "Twilight",
  dawn: "Dawn", sunrise: "Sunrise", morning: "Morning", midday: "Midday",
  afternoon: "Afternoon", sunset: "Sunset", evening: "Evening", night: "Night",
  overcast: "Overcast", space: "Space", controlled: "Controlled",
};

const LIGHTING_TYPE_LABEL: Record<string, string> = {
  natural: "Natural", artificial: "Artificial", fire: "Fire", filtered: "Filtered", mixed: "Mixed",
};

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Chip({
  children, hue,
}: {
  children: React.ReactNode;
  hue?: string;
}) {
  const color = hue ?? "hsl(48 80% 86%)";
  return (
    <span
      className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-mono uppercase tracking-[0.18em] ring-1 ring-inset"
      style={{
        color,
        background: color.replace(")", " / 0.07)").replace("hsl(", "hsla("),
        borderColor: color.replace(")", " / 0.22)").replace("hsl(", "hsla("),
      }}
    >
      {children}
    </span>
  );
}

export function EnvironmentDetailDrawer({
  environment,
  open,
  onClose,
  onApply,
  isFavorite,
  onToggleFavorite,
}: {
  environment: EnvironmentBlueprint | null;
  open: boolean;
  onClose: () => void;
  onApply: (bp: EnvironmentBlueprint) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <AnimatePresence>
      {open && environment && (
        <>
          {/* IMMERSIVE BACKDROP — environment image fills the entire
              viewport (inset-0) including behind the LeftRail. The
              rail (z-40) sits on top; the modal (z-100) floats above. */}
          <motion.div
            key="backdrop-img"
            aria-hidden
            className="fixed inset-0 z-[30] bg-cover bg-center"
            style={{ backgroundImage: `url("${environment.image}")` }}
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
              aria-label={`${environment.name} environment details`}
              className="pointer-events-auto relative w-full max-w-[860px] max-h-[92vh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="relative flex-1 min-h-0 overflow-y-auto">
            {/* ── HERO BAND — chrome only (title + badges). */}
            <header className="relative px-5 sm:px-7 pt-5 pb-6">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl ring-1 ring-inset ring-white/20 text-white/95 hover:text-white transition-colors shadow-[0_4px_16px_-2px_rgba(0,0,0,0.55)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Badge cluster */}
              <div className="flex flex-wrap gap-2">
                {environment.isTrending && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-amber-500/85 text-foreground text-[10px] font-mono uppercase tracking-[0.18em] shadow-[0_10px_30px_-6px_hsla(45,100%,60%,0.5)]">
                    <Sparkles className="w-3 h-3" />
                    Hot
                  </span>
                )}
                {environment.isPopular && !environment.isTrending && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-rose-500/80 text-foreground text-[10px] font-mono uppercase tracking-[0.18em]">
                    Popular
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-foreground/85 text-[10px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                  {ENV_WORLD_LABELS[environment.world]}
                </span>
              </div>

              {/* Title + meta — glass card over the image */}
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
                    {environment.name}
                  </span>
                </h2>
                <p className="mt-2 text-[13px] text-foreground/80 max-w-[92%]">
                  {environment.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/55">
                  <span>{environment.mood}</span>
                  <span>·</span>
                  <span>{environment.category}</span>
                  {environment.useCount && environment.useCount > 100 ? (
                    <>
                      <span>·</span>
                      <span>{compactNum(environment.useCount)} scenes</span>
                    </>
                  ) : null}
                </div>
              </div>
            </header>

            {/* Glass content cards below the hero */}
            <div className="px-5 sm:px-7 pb-5 space-y-4">

            {/* ── SCENE PLAN ──────────────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
                Scene plan
              </h3>
              <div className="p-1">
                <div className="grid grid-cols-2 gap-3">
                  {/* Time of day */}
                  <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Time of day
                    </div>
                    <div className="text-[14px] font-medium text-foreground/95">
                      {TIME_OF_DAY_LABEL[environment.lighting.timeOfDay] ?? environment.lighting.timeOfDay}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mt-0.5">
                      {LIGHTING_TYPE_LABEL[environment.lighting.type] ?? environment.lighting.type} · {environment.lighting.direction}
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
                      <ThermometerSun className="w-3 h-3" /> Temperature
                    </div>
                    <div
                      className="text-[14px] font-medium"
                      style={{ color: TEMPERATURE_HUE[environment.lighting.temperature] ?? "var(--foreground)" }}
                    >
                      {TEMPERATURE_LABEL[environment.lighting.temperature] ?? environment.lighting.temperature}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mt-0.5">
                      Intensity · {environment.lighting.intensity}
                    </div>
                  </div>

                  {/* Camera */}
                  <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Camera
                    </div>
                    <div className="text-[14px] font-medium text-foreground/95">
                      {CAMERA_MOVEMENT_LABELS[environment.camera.movement]}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mt-0.5">
                      {LENS_LABELS[environment.camera.lens]}
                    </div>
                  </div>

                  {/* Sound */}
                  <div className="rounded-xl p-3 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-1.5 inline-flex items-center gap-1">
                      <Music className="w-3 h-3" /> Audio
                    </div>
                    <div className="text-[14px] font-medium text-foreground/95">
                      {AMBIENT_LABELS[environment.sound.ambient]}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mt-0.5">
                      Music · {MUSIC_HINT_LABELS[environment.sound.musicHint]}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── COLOR PALETTE ───────────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3">
                Color palette
              </h3>
              <div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Primary",   hex: environment.colorPalette.primary },
                    { label: "Secondary", hex: environment.colorPalette.secondary },
                    { label: "Accent",    hex: environment.colorPalette.accent },
                    { label: "Shadows",   hex: environment.colorPalette.shadows },
                  ].map((sw) => (
                    <div key={sw.label} className="flex flex-col items-stretch">
                      <span
                        className="aspect-square w-full rounded-xl ring-1 ring-inset ring-white/15"
                        style={{ background: sw.hex }}
                        title={sw.hex}
                      />
                      <div className="mt-2 text-center">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">{sw.label}</div>
                        <div className="text-[10px] font-mono tabular-nums text-foreground/70">{sw.hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── GENERATOR PROMPT (subject is IN the scene) ──── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3 inline-flex items-center gap-2">
                <Palette className="w-3 h-3" />
                Scene · the subject inhabits this
              </h3>
              <div>
                <p className="text-[12.5px] leading-relaxed text-foreground/80 italic font-display">
                  {environment.generatorPrompt}
                </p>
                <div className="mt-3 pt-3 border-t border-white/[0.05] text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/40">
                  Studio replaces "Subject" with your character/cast reference at render time.
                </div>
              </div>
            </section>

            {/* ── ATMOSPHERIC METADATA ────────────────────────── */}
            <section className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.45)] px-5 sm:px-6 py-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/55 mb-3 inline-flex items-center gap-2">
                <CloudSun className="w-3 h-3" />
                Atmosphere
              </h3>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Chip hue="hsl(195 80% 70%)">{WEATHER_LABELS[environment.weather]}</Chip>
                  <Chip hue="hsl(140 70% 65%)">{SEASON_LABELS[environment.season]}</Chip>
                  <Chip hue="hsl(28 85% 70%)">{TERRAIN_LABELS[environment.terrain]}</Chip>
                </div>

                {environment.vfxHints.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.05]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-2 inline-flex items-center gap-1">
                      <Wand2 className="w-3 h-3" /> Natural VFX in this scene
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {environment.vfxHints.map((v) => (
                        <Chip key={v} hue="hsl(48 95% 72%)">{ENV_VFX_LABELS[v]}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            </div>{/* /content wrapper */}

            {/* ── CTA ─────────────────────────────────────────── */}
            <footer className="sticky bottom-0 mt-6 px-5 sm:px-7 py-4 bg-gradient-to-t from-[hsl(220_30%_3%/0.95)] via-[hsl(220_30%_3%/0.75)] to-transparent backdrop-blur-xl border-t border-white/[0.10]">
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 font-medium tracking-wide rounded-xl"
                  onClick={() => onApply(environment)}
                >
                  Apply scene to project
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
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

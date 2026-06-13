/**
 * EffectsPalette — clickable presets that apply property bundles to
 * the selected clip(s). Three categories: Looks (CSS filter
 * recipes), Motion (speed presets + mirror), Transitions (fade-in/
 * out durations).
 *
 * Toggle with F. Press a preset → it commits via setClipProperty
 * to every clip in selectedClipIds, so multi-selected clips all
 * grade together — useful for shot-matching across a scene.
 */
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Wand2, X, Sparkles, FlipHorizontal2, Gauge, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";
import { setClipProperty } from "@/lib/editor/store";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
  selectedClipIds: string[];
  open: boolean;
  onClose: () => void;
}

interface Preset {
  id: string;
  name: string;
  hint: string;
  patch: Parameters<typeof setClipProperty>[1];
  /** CSS preview chip — visualises the effect on a swatch */
  preview?: React.CSSProperties;
}

const LOOKS: Preset[] = [
  {
    id: "look-default",
    name: "Reset look",
    hint: "Clear all colour grading",
    patch: { filter: "" },
    preview: { background: "linear-gradient(135deg, hsl(200 60% 50%), hsl(280 60% 50%))" },
  },
  {
    id: "look-bw",
    name: "B&W",
    hint: "Full desaturate",
    patch: { filter: "grayscale(1)" },
    preview: { background: "linear-gradient(135deg, hsl(0 0% 75%), hsl(0 0% 25%))" },
  },
  {
    id: "look-sepia",
    name: "Sepia",
    hint: "Warm vintage",
    patch: { filter: "sepia(0.85) saturate(1.1)" },
    preview: { background: "linear-gradient(135deg, hsl(30 60% 65%), hsl(20 50% 35%))" },
  },
  {
    id: "look-faded",
    name: "Faded",
    hint: "Lifted blacks, low sat",
    patch: { filter: "saturate(0.55) brightness(1.08) contrast(0.85)" },
    preview: { background: "linear-gradient(135deg, hsl(200 30% 60%), hsl(280 25% 50%))" },
  },
  {
    id: "look-cinema",
    name: "Cinema",
    hint: "Teal & orange",
    patch: {
      filter: "saturate(1.15) contrast(1.12) hue-rotate(-8deg) brightness(0.96)",
    },
    preview: { background: "linear-gradient(135deg, hsl(195 70% 45%), hsl(25 80% 50%))" },
  },
  {
    id: "look-noir",
    name: "Noir",
    hint: "High contrast B&W",
    patch: { filter: "grayscale(1) contrast(1.25) brightness(0.92)" },
    preview: { background: "linear-gradient(135deg, hsl(0 0% 95%), hsl(0 0% 10%))" },
  },
  {
    id: "look-warm",
    name: "Warm",
    hint: "Push to amber",
    patch: { filter: "saturate(1.2) hue-rotate(-15deg) brightness(1.04)" },
    preview: { background: "linear-gradient(135deg, hsl(40 80% 60%), hsl(15 70% 45%))" },
  },
  {
    id: "look-cool",
    name: "Cool",
    hint: "Push to cyan",
    patch: { filter: "saturate(1.1) hue-rotate(18deg) brightness(0.98)" },
    preview: { background: "linear-gradient(135deg, hsl(195 70% 60%), hsl(220 60% 40%))" },
  },
];

const MOTION: Preset[] = [
  { id: "speed-1x", name: "Real time", hint: "1× speed", patch: { speed: 1 } },
  { id: "speed-half", name: "Slow-mo", hint: "0.5× speed", patch: { speed: 0.5 } },
  { id: "speed-quarter", name: "Bullet time", hint: "0.25× speed", patch: { speed: 0.25 } },
  { id: "speed-2x", name: "Fast forward", hint: "2× speed", patch: { speed: 2 } },
  { id: "speed-4x", name: "Hyper lapse", hint: "4× speed", patch: { speed: 4 } },
  { id: "mirror-on", name: "Mirror", hint: "Horizontal flip", patch: { mirror: true } },
  { id: "mirror-off", name: "Unmirror", hint: "Reset flip", patch: { mirror: false } },
];

const TRANSITIONS: Preset[] = [
  {
    id: "trans-soft",
    name: "Soft in/out",
    hint: "0.6s each end",
    patch: { fadeInSec: 0.6, fadeOutSec: 0.6 },
  },
  {
    id: "trans-long",
    name: "Long dissolve",
    hint: "1.5s each end",
    patch: { fadeInSec: 1.5, fadeOutSec: 1.5 },
  },
  {
    id: "trans-fadein",
    name: "Fade in only",
    hint: "0.8s from black",
    patch: { fadeInSec: 0.8, fadeOutSec: 0 },
  },
  {
    id: "trans-fadeout",
    name: "Fade out only",
    hint: "0.8s to black",
    patch: { fadeInSec: 0, fadeOutSec: 0.8 },
  },
  {
    id: "trans-none",
    name: "Hard cut",
    hint: "No fades",
    patch: { fadeInSec: 0, fadeOutSec: 0 },
  },
];

export function EffectsPalette({ project, selectedClipIds, open, onClose }: Props) {
  void project;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const apply = (preset: Preset) => {
    if (selectedClipIds.length === 0) {
      toast.message("Select a clip first", {
        description: `Then click "${preset.name}" to apply it`,
      });
      return;
    }
    for (const id of selectedClipIds) {
      setClipProperty(id, preset.patch);
    }
    toast.message(`Applied ${preset.name}`, {
      description:
        selectedClipIds.length === 1
          ? undefined
          : `to ${selectedClipIds.length} clips`,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: EASE_PREMIUM }}
          className={cn(
            "fixed bottom-12 left-1/2 -translate-x-1/2 z-40",
            "w-[min(680px,calc(100vw-1.5rem))] max-h-[68vh] flex flex-col",
            "rounded-2xl border border-white/[0.07]",
            "bg-[hsl(220_30%_4%/0.88)] backdrop-blur-2xl",
            "shadow-[0_40px_100px_-30px_hsl(0_0%_0%/0.8)]",
          )}
        >
          <header className="shrink-0 px-6 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                <Wand2 className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
                <span>◆ Effects · {selectedClipIds.length} {selectedClipIds.length === 1 ? "clip" : "clips"} selected</span>
              </div>
              <h3
                className="mt-1 font-display italic text-[clamp(1.2rem,1.9vw,1.6rem)] font-light tracking-tight"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  Looks · motion · transitions.
                </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground/55 hover:text-foreground transition-colors"
              aria-label="Close effects"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-5 space-y-5">
            <PresetGroup title="Looks" Icon={Sparkles} presets={LOOKS} apply={apply} kind="look" />
            <PresetGroup title="Motion" Icon={Gauge} presets={MOTION} apply={apply} kind="motion" />
            <PresetGroup title="Transitions" Icon={Layers} presets={TRANSITIONS} apply={apply} kind="transition" />
          </div>

          <footer className="shrink-0 px-6 py-3 border-t border-white/[0.05] flex items-center justify-between text-[11.5px] text-muted-foreground/55">
            <span>Multi-select first, then apply — every clip gets the same patch.</span>
            <span className="flex items-center gap-1.5">
              <Kbd>F</Kbd> <span>toggle</span>
              <Kbd>Esc</Kbd> <span>close</span>
            </span>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PresetGroup({
  title,
  Icon,
  presets,
  apply,
  kind,
}: {
  title: string;
  Icon: typeof Sparkles;
  presets: Preset[];
  apply: (p: Preset) => void;
  kind: "look" | "motion" | "transition";
}) {
  return (
    <section>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-2 flex items-center gap-1.5")}>
        <Icon className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
        <span>◆ {title}</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {presets.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => apply(p)}
              className={cn(
                "group/p w-full flex items-center gap-2.5 rounded-md p-2 transition-colors",
                "hover:bg-white/[0.04] text-left",
              )}
            >
              {/* Visual chip per preset kind */}
              {kind === "look" && (
                <span
                  className="h-9 w-12 shrink-0 rounded ring-1 ring-inset ring-white/[0.08]"
                  style={p.preview}
                />
              )}
              {kind === "motion" && p.id.startsWith("speed") && (
                <span className="h-9 w-12 shrink-0 rounded ring-1 ring-inset ring-white/[0.08] bg-white/[0.04] flex items-center justify-center">
                  <Gauge className="h-4 w-4 text-accent/85" strokeWidth={1.5} />
                </span>
              )}
              {kind === "motion" && p.id.startsWith("mirror") && (
                <span className="h-9 w-12 shrink-0 rounded ring-1 ring-inset ring-white/[0.08] bg-white/[0.04] flex items-center justify-center">
                  <FlipHorizontal2 className="h-4 w-4 text-accent/85" strokeWidth={1.5} />
                </span>
              )}
              {kind === "transition" && (
                <span className="h-9 w-12 shrink-0 rounded ring-1 ring-inset ring-white/[0.08] relative overflow-hidden">
                  <span
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, hsl(var(--accent) / 0.85) 50%, transparent 100%)",
                    }}
                  />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[12.5px] text-foreground/95 truncate">{p.name}</div>
                <div className={cn(TYPE_META, "text-muted-foreground/50 truncate")}>{p.hint}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
        "font-mono text-[10px] tabular-nums",
        "rounded border border-white/[0.10] bg-white/[0.03] text-foreground/85",
      )}
    >
      {children}
    </span>
  );
}

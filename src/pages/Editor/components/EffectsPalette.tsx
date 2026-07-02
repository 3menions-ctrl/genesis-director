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
import { Sparkles, Gauge, Layers, FlipHorizontal2, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceBody, SurfaceFooter, SurfaceKbdHint } from "./Surface";
import type { EditorProject } from "@/lib/editor/types";
import { setClipProperty, setClipColorGrade } from "@/lib/editor/store";
import { IDENTITY_GRADE } from "@/lib/editor/color-grade";
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
  /** Bakeable grade for "look" presets — the CSS `filter` in `patch` is
   *  preview-only (the stitcher bakes colorGrade, not CSS), so without this
   *  the look never reached the export. `null` = reset the grade. */
  lutId?: string | null;
  /** CSS preview chip — visualises the effect on a swatch */
  preview?: React.CSSProperties;
}

const LOOKS: Preset[] = [
  {
    id: "look-default",
    name: "Reset look",
    hint: "Clear all colour grading",
    patch: { filter: "" },
    lutId: null,
    preview: { background: "linear-gradient(135deg, hsl(200 60% 50%), hsl(280 60% 50%))" },
  },
  {
    id: "look-bw",
    name: "B&W",
    hint: "Full desaturate",
    patch: { filter: "grayscale(1)" },
    lutId: "ilford-hp5",
    preview: { background: "linear-gradient(135deg, hsl(0 0% 75%), hsl(0 0% 25%))" },
  },
  {
    id: "look-sepia",
    name: "Sepia",
    hint: "Warm vintage",
    patch: { filter: "sepia(0.85) saturate(1.1)" },
    lutId: "70s-warm",
    preview: { background: "linear-gradient(135deg, hsl(30 60% 65%), hsl(20 50% 35%))" },
  },
  {
    id: "look-faded",
    name: "Faded",
    hint: "Lifted blacks, low sat",
    patch: { filter: "saturate(0.55) brightness(1.08) contrast(0.85)" },
    lutId: "2010s-instagram",
    preview: { background: "linear-gradient(135deg, hsl(200 30% 60%), hsl(280 25% 50%))" },
  },
  {
    id: "look-cinema",
    name: "Cinema",
    hint: "Teal & orange",
    patch: {
      filter: "saturate(1.15) contrast(1.12) hue-rotate(-8deg) brightness(0.96)",
    },
    lutId: "teal-orange",
    preview: { background: "linear-gradient(135deg, hsl(195 70% 45%), hsl(25 80% 50%))" },
  },
  {
    id: "look-noir",
    name: "Noir",
    hint: "High contrast B&W",
    patch: { filter: "grayscale(1) contrast(1.25) brightness(0.92)" },
    lutId: "noir",
    preview: { background: "linear-gradient(135deg, hsl(0 0% 95%), hsl(0 0% 10%))" },
  },
  {
    id: "look-warm",
    name: "Warm",
    hint: "Push to amber",
    patch: { filter: "saturate(1.2) hue-rotate(-15deg) brightness(1.04)" },
    lutId: "skin-warm",
    preview: { background: "linear-gradient(135deg, hsl(40 80% 60%), hsl(15 70% 45%))" },
  },
  {
    id: "look-cool",
    name: "Cool",
    hint: "Push to cyan",
    patch: { filter: "saturate(1.1) hue-rotate(18deg) brightness(0.98)" },
    lutId: "fincher-cold",
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

// Track placement — move the selected clip(s) to another ROW. This is how you
// stack a second video on the Overlay row (V2) so it composites OVER V1, or
// drop a clip onto the Music row. The bake routes V2 clips into the overlay
// compositor and A-tracks into the audio mix, so it reaches the export.
const PLACEMENT: Preset[] = [
  { id: "track-v1", name: "Main video (V1)", hint: "Base video row", patch: { trackId: "sys:V1" } },
  { id: "track-v2", name: "Overlay (V2)", hint: "Composite OVER the main video (picture-in-picture / stacked)", patch: { trackId: "sys:V2" } },
  { id: "track-a1", name: "Voice (A1)", hint: "Audio row — voiceover / narration", patch: { trackId: "sys:A1" } },
  { id: "track-a2", name: "Music (A2)", hint: "Audio row — layer music under everything", patch: { trackId: "sys:A2" } },
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

  const apply = (preset: Preset) => {
    if (selectedClipIds.length === 0) {
      toast.message("Select a clip first", {
        description: `Then click "${preset.name}" to apply it`,
      });
      return;
    }
    for (const id of selectedClipIds) {
      setClipProperty(id, preset.patch);
      // "look" presets also write a BAKEABLE grade — the CSS filter above is
      // preview-only (the stitcher bakes colorGrade). Without this the look
      // vanished on export. `lutId: null` = reset to the neutral grade.
      if (preset.lutId !== undefined) {
        setClipColorGrade(
          id,
          preset.lutId
            ? { ...IDENTITY_GRADE, lutId: preset.lutId, lutMix: 1 }
            : { ...IDENTITY_GRADE },
        );
      }
    }
    toast.message(`Applied ${preset.name}`, {
      description:
        selectedClipIds.length === 1
          ? undefined
          : `to ${selectedClipIds.length} clips`,
    });
  };

  return (
    <Surface open={open} onClose={onClose} size="md">
      <SurfaceHeader
        eyebrow={`◆ Effects · ${selectedClipIds.length} ${selectedClipIds.length === 1 ? "clip" : "clips"} selected`}
        title="Looks · motion · transitions."
        description="Multi-select first, then apply — every clip gets the same patch."
        onClose={onClose}
      />
      <SurfaceBody>
        <div className="space-y-5">
          <PresetGroup title="Placement (rows)" Icon={Rows3} presets={PLACEMENT} apply={apply} kind="transition" />
          <PresetGroup title="Looks" Icon={Sparkles} presets={LOOKS} apply={apply} kind="look" />
          <PresetGroup title="Motion" Icon={Gauge} presets={MOTION} apply={apply} kind="motion" />
          <PresetGroup title="Transitions" Icon={Layers} presets={TRANSITIONS} apply={apply} kind="transition" />
        </div>
      </SurfaceBody>
      <SurfaceFooter>
        <span>For curated cinematic looks, use the Studio Library (⇧L).</span>
        <span className="flex items-center gap-1.5">
          <SurfaceKbdHint keys="F" label="toggle" />
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
      </SurfaceFooter>
    </Surface>
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


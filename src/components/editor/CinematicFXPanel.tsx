/**
 * CinematicFXPanel — One-Click Cinematic Effects
 * Film grain, LUT color grades, cinematic letterbox, sound design presets
 */

import { memo, useState, useCallback } from "react";
import {
  Film, Palette, RectangleHorizontal, Music, Sparkles,
  Sun, Moon, Contrast, Droplets, Flame, Snowflake, Eye,
  CloudRain, Sunset, Zap, Volume2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";

// ─── LUT / Color Grade Presets ───

interface ColorGrade {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: string; // CSS gradient for preview swatch
  updates: Partial<TimelineClip>;
}

const COLOR_GRADES: ColorGrade[] = [
  {
    id: "teal-orange",
    name: "Teal & Orange",
    description: "Blockbuster cinema look",
    icon: <Flame className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #008080, #ff8c00)",
    updates: { saturation: 30, contrast: 15, brightness: -5 },
  },
  {
    id: "desaturated-noir",
    name: "Noir",
    description: "Dark, moody, desaturated",
    icon: <Moon className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #1a1a2e, #4a4a4a)",
    updates: { saturation: -60, contrast: 30, brightness: -15 },
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    description: "Warm sunset glow",
    icon: <Sunset className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #ff9a56, #ffd700)",
    updates: { saturation: 20, contrast: 5, brightness: 10 },
  },
  {
    id: "arctic-blue",
    name: "Arctic",
    description: "Cold, clinical, blue tones",
    icon: <Snowflake className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #0f3460, #5dade2)",
    updates: { saturation: -20, contrast: 20, brightness: -8 },
  },
  {
    id: "vintage-fade",
    name: "Vintage",
    description: "Faded film with lifted blacks",
    icon: <Film className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #d4a574, #c9b896)",
    updates: { saturation: -30, contrast: -15, brightness: 15 },
  },
  {
    id: "neon-pop",
    name: "Neon Pop",
    description: "Hyper-saturated cyberpunk",
    icon: <Zap className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #ff006e, #3a86ff)",
    updates: { saturation: 60, contrast: 25, brightness: 5 },
  },
  {
    id: "forest-green",
    name: "Forest",
    description: "Rich earthy greens",
    icon: <Droplets className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #1b4332, #52b788)",
    updates: { saturation: 15, contrast: 10, brightness: -10 },
  },
  {
    id: "bleach-bypass",
    name: "Bleach Bypass",
    description: "Harsh, metallic, high contrast",
    icon: <Contrast className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #2d2d2d, #b0b0b0)",
    updates: { saturation: -40, contrast: 45, brightness: -5 },
  },
  {
    id: "dream-haze",
    name: "Dream Haze",
    description: "Soft, ethereal glow",
    icon: <CloudRain className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #e8d5f5, #fce4ec)",
    updates: { saturation: -10, contrast: -20, brightness: 20 },
  },
  {
    id: "high-contrast-bw",
    name: "B&W High Contrast",
    description: "Pure monochrome drama",
    icon: <Eye className="w-3.5 h-3.5" />,
    preview: "linear-gradient(135deg, #000000, #ffffff)",
    updates: { saturation: -100, contrast: 40, brightness: 0 },
  },
];

// ─── Cinematic Transitions ───

interface CinematicTransition {
  id: string;
  name: string;
  description: string;
  transition: TimelineClip["transition"];
  transitionDuration: number;
}

const CINEMATIC_TRANSITIONS: CinematicTransition[] = [
  { id: "fade-slow", name: "Slow Fade", description: "Elegant 1.5s fade", transition: "fade", transitionDuration: 1.5 },
  { id: "fade-quick", name: "Quick Fade", description: "Snappy 0.3s fade", transition: "fade", transitionDuration: 0.3 },
  { id: "dissolve", name: "Dissolve", description: "Dreamy dissolve blend", transition: "dissolve", transitionDuration: 1.0 },
  { id: "wipe-left", name: "Wipe Left", description: "Cinematic wipe reveal", transition: "wipeleft", transitionDuration: 0.8 },
  { id: "wipe-right", name: "Wipe Right", description: "Reverse wipe", transition: "wiperight", transitionDuration: 0.8 },
  { id: "slide-up", name: "Slide Up", description: "Vertical reveal", transition: "slideup", transitionDuration: 0.6 },
];

// ─── Film Grain / Letterbox Presets ───

interface FilmPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  opacity: number;
  fadeIn: number;
  fadeOut: number;
}

const FILM_PRESETS: FilmPreset[] = [
  { id: "cinema-scope", name: "CinemaScope 2.39:1", description: "Wide letterbox bars", icon: <RectangleHorizontal className="w-3.5 h-3.5" />, opacity: 1, fadeIn: 0.5, fadeOut: 0.5 },
  { id: "16mm-grain", name: "16mm Film", description: "Light grain + warmth", icon: <Film className="w-3.5 h-3.5" />, opacity: 0.95, fadeIn: 1, fadeOut: 1 },
  { id: "35mm-grain", name: "35mm Film", description: "Medium grain texture", icon: <Film className="w-3.5 h-3.5" />, opacity: 0.92, fadeIn: 0.5, fadeOut: 0.5 },
  { id: "vhs-look", name: "VHS Look", description: "Retro scan lines", icon: <Film className="w-3.5 h-3.5" />, opacity: 0.88, fadeIn: 0, fadeOut: 0 },
];

type FXCategory = "grades" | "transitions" | "film" | "audio";

const FX_TABS: { key: FXCategory; label: string; icon: React.ReactNode }[] = [
  { key: "grades", label: "Color", icon: <Palette className="w-3 h-3" /> },
  { key: "transitions", label: "Trans.", icon: <Sparkles className="w-3 h-3" /> },
  { key: "film", label: "Film", icon: <Film className="w-3 h-3" /> },
  { key: "audio", label: "Sound", icon: <Volume2 className="w-3 h-3" /> },
];

// ─── Sound Design Presets ───

interface SoundPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  updates: Partial<TimelineClip>;
}

const SOUND_PRESETS: SoundPreset[] = [
  { id: "dramatic-swell", name: "Dramatic Swell", description: "Volume builds from 0→100%", icon: <Sun className="w-3.5 h-3.5" />, updates: { volume: 1, fadeIn: 2, fadeOut: 0 } },
  { id: "fade-to-silence", name: "Fade to Silence", description: "Gradual volume decrease", icon: <Moon className="w-3.5 h-3.5" />, updates: { volume: 1, fadeIn: 0, fadeOut: 3 } },
  { id: "whisper-quiet", name: "Whisper", description: "20% volume, subtle", icon: <Volume2 className="w-3.5 h-3.5" />, updates: { volume: 0.2 } },
  { id: "full-blast", name: "Full Blast", description: "100% volume, no fades", icon: <Zap className="w-3.5 h-3.5" />, updates: { volume: 1, fadeIn: 0, fadeOut: 0 } },
  { id: "cross-fade", name: "Cross-fade", description: "Smooth audio blend", icon: <Sparkles className="w-3.5 h-3.5" />, updates: { volume: 1, fadeIn: 1, fadeOut: 1 } },
];

export const CinematicFXPanel = memo(function CinematicFXPanel() {
  const [activeTab, setActiveTab] = useState<FXCategory>("grades");
  const { state, dispatch } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId && !!state.selectedTrackId;

  const applyToClip = useCallback((updates: Partial<TimelineClip>, label: string) => {
    if (!state.selectedClipId || !state.selectedTrackId) {
      toast.error("Select a clip first");
      return;
    }
    dispatch({
      type: "UPDATE_CLIP",
      trackId: state.selectedTrackId,
      clipId: state.selectedClipId,
      updates,
    });
    toast.success(`Applied "${label}"`);
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  const resetColorGrade = useCallback(() => {
    applyToClip({ brightness: 0, contrast: 0, saturation: 0 }, "Reset Color");
  }, [applyToClip]);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: "1px solid hsla(210, 30%, 90%, 0.06)" }}
      >
        {FX_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
              activeTab === tab.key
                ? "bg-[hsla(215,100%,50%,0.12)] text-[hsl(215,100%,65%)]"
                : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsla(0,0%,100%,0.04)]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2.5 space-y-1.5">
          {/* No selection warning */}
          {!hasSelection && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-4 text-center rounded-xl border border-dashed"
              style={{ borderColor: "hsla(215, 60%, 50%, 0.12)" }}
            >
              <Sparkles className="w-5 h-5 text-[hsl(215,80%,60%)] opacity-30 mx-auto mb-2" />
              <p className="text-[10px] text-[hsl(0,0%,45%)] leading-relaxed">
                Select a clip to apply cinematic effects
              </p>
            </motion.div>
          )}

          {/* ─── Color Grades ─── */}
          {activeTab === "grades" && (
            <>
              {hasSelection && (
                <button
                  onClick={resetColorGrade}
                  className="w-full text-left px-3 py-2 rounded-lg text-[10px] text-[hsl(0,0%,55%)] hover:bg-[hsla(0,0%,100%,0.04)] transition-colors"
                >
                  ↺ Reset to original
                </button>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_GRADES.map((grade) => (
                  <button
                    key={grade.id}
                    onClick={() => applyToClip(grade.updates, grade.name)}
                    disabled={!hasSelection}
                    className={cn(
                      "text-left rounded-xl border overflow-hidden transition-all group",
                      hasSelection
                        ? "hover:border-[hsla(215,80%,60%,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                        : "opacity-30 cursor-not-allowed"
                    )}
                    style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
                  >
                    {/* Color swatch */}
                    <div
                      className="h-10 w-full"
                      style={{ background: grade.preview }}
                    />
                    <div className="p-2">
                      <span className="text-[10px] font-bold text-[hsl(0,0%,85%)] block leading-none">
                        {grade.name}
                      </span>
                      <span className="text-[8px] text-[hsl(0,0%,45%)] mt-0.5 block">
                        {grade.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Manual adjustment sliders */}
              {hasSelection && (
                <div className="mt-3 space-y-3 px-1">
                  <p className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Fine Tune</p>
                  {[
                    { label: "Brightness", key: "brightness" as const, icon: <Sun className="w-3 h-3" /> },
                    { label: "Contrast", key: "contrast" as const, icon: <Contrast className="w-3 h-3" /> },
                    { label: "Saturation", key: "saturation" as const, icon: <Droplets className="w-3 h-3" /> },
                  ].map((ctrl) => {
                    const clip = state.tracks
                      .find(t => t.id === state.selectedTrackId)
                      ?.clips.find(c => c.id === state.selectedClipId);
                    const val = clip?.[ctrl.key] ?? 0;
                    return (
                      <div key={ctrl.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[hsl(0,0%,50%)] flex items-center gap-1">
                            {ctrl.icon} {ctrl.label}
                          </span>
                          <span className="text-[9px] font-mono text-[hsl(0,0%,45%)]">{val > 0 ? '+' : ''}{val}</span>
                        </div>
                        <Slider
                          value={[val]}
                          onValueChange={([v]) => applyToClip({ [ctrl.key]: v }, ctrl.label)}
                          min={-100}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ─── Transitions ─── */}
          {activeTab === "transitions" && CINEMATIC_TRANSITIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => applyToClip({ transition: t.transition, transitionDuration: t.transitionDuration }, t.name)}
              disabled={!hasSelection}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all group",
                hasSelection
                  ? "hover:border-[hsla(215,80%,60%,0.2)] hover:bg-[hsla(0,0%,100%,0.03)] active:scale-[0.98]"
                  : "opacity-30 cursor-not-allowed"
              )}
              style={{ borderColor: "hsla(0, 0%, 100%, 0.05)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsla(215,80%,60%,0.1)] text-[hsl(215,80%,60%)]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[hsl(0,0%,85%)] block">{t.name}</span>
                  <span className="text-[8px] text-[hsl(0,0%,45%)]">{t.description}</span>
                </div>
                <span className="text-[8px] font-mono text-[hsl(0,0%,40%)] bg-[hsla(0,0%,100%,0.05)] px-1.5 py-0.5 rounded">
                  {t.transitionDuration}s
                </span>
              </div>
            </button>
          ))}

          {/* ─── Film Presets ─── */}
          {activeTab === "film" && FILM_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyToClip({ opacity: p.opacity, fadeIn: p.fadeIn, fadeOut: p.fadeOut }, p.name)}
              disabled={!hasSelection}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all group",
                hasSelection
                  ? "hover:border-[hsla(215,80%,60%,0.2)] hover:bg-[hsla(0,0%,100%,0.03)] active:scale-[0.98]"
                  : "opacity-30 cursor-not-allowed"
              )}
              style={{ borderColor: "hsla(0, 0%, 100%, 0.05)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,60%)]">
                  {p.icon}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[hsl(0,0%,85%)] block">{p.name}</span>
                  <span className="text-[8px] text-[hsl(0,0%,45%)]">{p.description}</span>
                </div>
              </div>
            </button>
          ))}

          {/* ─── Sound Design ─── */}
          {activeTab === "audio" && SOUND_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyToClip(p.updates, p.name)}
              disabled={!hasSelection}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all group",
                hasSelection
                  ? "hover:border-[hsla(215,80%,60%,0.2)] hover:bg-[hsla(0,0%,100%,0.03)] active:scale-[0.98]"
                  : "opacity-30 cursor-not-allowed"
              )}
              style={{ borderColor: "hsla(0, 0%, 100%, 0.05)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsla(190,70%,50%,0.1)] text-[hsl(190,70%,55%)]">
                  {p.icon}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[hsl(0,0%,85%)] block">{p.name}</span>
                  <span className="text-[8px] text-[hsl(0,0%,45%)]">{p.description}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

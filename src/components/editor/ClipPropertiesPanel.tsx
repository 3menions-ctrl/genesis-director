/**
 * ClipPropertiesPanel — Premium Inspector panel for editing selected clip properties.
 * Glassmorphic section cards, icon-accented labels, value readouts.
 */

import { memo, useCallback } from "react";
import {
  X, Scissors, Copy, Trash2, Type, Clock, Film, Image, Volume2,
  AlignLeft, AlignCenter, AlignVerticalJustifyEnd, Gauge, Sunset,
  Eye, Palette, Tag, SunMedium, Contrast, Droplets, Wand2, Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomTimeline, TimelineClip, generateClipId } from "@/hooks/useCustomTimeline";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Film className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
  text: <Type className="w-3.5 h-3.5" />,
  audio: <Volume2 className="w-3.5 h-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
  video: "hsla(215, 100%, 60%, 0.14)",
  image: "hsla(200, 100%, 60%, 0.14)",
  text: "hsla(195, 100%, 70%, 0.14)",
  audio: "hsla(210, 100%, 65%, 0.14)",
};

const TYPE_ACCENT: Record<string, string> = {
  video: "hsl(215, 100%, 70%)",
  image: "hsl(200, 100%, 70%)",
  text: "hsl(195, 100%, 75%)",
  audio: "hsl(210, 100%, 70%)",
};

const SPEED_PRESETS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

const FONT_FAMILIES = [
  { label: "Sans Serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Cursive", value: "cursive" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial Black", value: "'Arial Black', sans-serif" },
  { label: "Comic Sans", value: "'Comic Sans MS', cursive" },
];

const COLOR_LABELS = [
  { label: "None", value: "" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
];

function SectionCard({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "hsla(0, 0%, 100%, 0.02)",
        backdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.04), 0 8px 24px -16px hsla(0,0%,0%,0.4)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ boxShadow: "inset 0 -1px 0 hsla(0,0%,100%,0.04)" }}
      >
        <span style={{ color: accent || "hsla(215, 100%, 75%, 0.7)" }}>{icon}</span>
        <span className="text-[10px] font-light uppercase tracking-[0.18em]" style={{ color: "hsla(0, 0%, 100%, 0.55)" }}>
          {title}
        </span>
      </div>
      <div className="p-3.5 space-y-2.5">{children}</div>
    </div>
  );
}

function ValueReadout({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-light text-[hsla(0,0%,100%,0.40)] tracking-wide">{label}</span>
      <span className={cn("text-[10px] font-light text-[hsla(0,0%,100%,0.75)] px-2 py-0.5 rounded-full", mono && "font-mono tabular-nums")}
        style={{ background: "hsla(0,0%,100%,0.035)", boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.04)" }}>
        {value}
      </span>
    </div>
  );
}

function SliderRow({ label, value, displayValue, min, max, step, onChange, icon }: {
  label: string; value: number; displayValue: string; min: number; max: number; step: number;
  onChange: (v: number) => void; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-light text-[hsla(0,0%,100%,0.45)] flex items-center gap-1.5 tracking-wide">
          {icon} {label}
        </span>
        <span className="text-[9px] font-mono font-light tabular-nums text-[hsla(215,100%,80%,0.95)] px-2 py-0.5 rounded-full"
          style={{ background: "hsla(215,100%,60%,0.10)", boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.05)" }}>
          {displayValue}
        </span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export const ClipPropertiesPanel = memo(function ClipPropertiesPanel({
  className,
  embedded,
}: {
  className?: string;
  embedded?: boolean;
}) {
  const { state, dispatch } = useCustomTimeline();

  const selectedTrack = state.tracks.find(t => t.id === state.selectedTrackId);
  const selectedClip = selectedTrack?.clips.find(c => c.id === state.selectedClipId);

  const updateClip = useCallback(
    (updates: Partial<TimelineClip>) => {
      if (!state.selectedClipId || !state.selectedTrackId) return;
      dispatch({
        type: "UPDATE_CLIP",
        trackId: state.selectedTrackId,
        clipId: state.selectedClipId,
        updates,
      });
    },
    [state.selectedClipId, state.selectedTrackId, dispatch]
  );

  const handleSplit = useCallback(() => {
    if (!selectedClip || !state.selectedTrackId) return;
    const splitTime = state.playheadTime;
    if (splitTime <= selectedClip.start || splitTime >= selectedClip.end) return;

    dispatch({ type: "TRIM_CLIP", trackId: state.selectedTrackId, clipId: selectedClip.id, edge: "end", newTime: splitTime });

    const offsetIntoSource = splitTime - selectedClip.start;
    const newClip: TimelineClip = {
      id: generateClipId(), type: selectedClip.type, src: selectedClip.src, text: selectedClip.text,
      start: splitTime, end: selectedClip.end, trimStart: selectedClip.trimStart + offsetIntoSource, trimEnd: selectedClip.trimEnd,
      name: `${selectedClip.name} (split)`, thumbnail: selectedClip.thumbnail, sourceDuration: selectedClip.sourceDuration,
      textStyle: selectedClip.textStyle, volume: selectedClip.volume, speed: selectedClip.speed,
      fadeIn: selectedClip.fadeIn, fadeOut: selectedClip.fadeOut, opacity: selectedClip.opacity, colorLabel: selectedClip.colorLabel,
    };
    dispatch({ type: "ADD_CLIP", trackId: state.selectedTrackId, clip: newClip });
  }, [selectedClip, state.selectedTrackId, state.playheadTime, dispatch]);

  const handleDuplicate = useCallback(() => {
    if (!selectedClip || !state.selectedTrackId) return;
    const newClip: TimelineClip = {
      ...selectedClip, id: generateClipId(), start: selectedClip.end,
      end: selectedClip.end + (selectedClip.end - selectedClip.start), name: `${selectedClip.name} (copy)`,
    };
    dispatch({ type: "ADD_CLIP", trackId: state.selectedTrackId, clip: newClip });
  }, [selectedClip, state.selectedTrackId, dispatch]);

  const handleDelete = useCallback(() => {
    if (!state.selectedClipId || !state.selectedTrackId) return;
    dispatch({ type: "REMOVE_CLIP", trackId: state.selectedTrackId, clipId: state.selectedClipId });
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${sec.padStart(4, "0")}`;
  };

  if (!selectedClip) {
    if (embedded) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "hsla(215,100%,60%,0.06)",
              backdropFilter: "blur(24px)",
              boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.05), 0 0 32px -8px hsla(215,100%,60%,0.30)",
            }}>
            <Scissors className="w-6 h-6 text-[hsla(215,100%,75%,0.40)]" strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[11px] font-light tracking-tight text-[hsla(0,0%,100%,0.50)]">No Clip Selected</p>
            <p className="text-[9px] font-light text-[hsla(0,0%,100%,0.30)] leading-relaxed max-w-[180px]">
              Select a clip on the timeline to edit its properties
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className={`w-52 shrink-0 flex flex-col overflow-hidden ${className || ""}`}
        style={{ background: "hsla(220, 14%, 4%, 0.55)", backdropFilter: "blur(48px) saturate(180%)" }}>
        <div className="shrink-0 flex items-center gap-2 px-3.5 h-10"
          style={{ boxShadow: "inset 0 -1px 0 hsla(0,0%,100%,0.04)" }}>
          <Scissors className="w-3.5 h-3.5 text-[hsla(215,100%,75%,0.65)]" strokeWidth={1.5} />
          <span className="text-[11px] font-light tracking-tight text-[hsla(0,0%,100%,0.75)]">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[10px] font-light text-[hsla(0,0%,100%,0.30)] text-center">Select a clip to edit</p>
        </div>
      </div>
    );
  }

  const clipDuration = selectedClip.end - selectedClip.start;
  const currentVolume = selectedClip.volume ?? 1;
  const currentSpeed = selectedClip.speed ?? 1;
  const currentFadeIn = selectedClip.fadeIn ?? 0;
  const currentFadeOut = selectedClip.fadeOut ?? 0;
  const currentOpacity = selectedClip.opacity ?? 1;
  const maxFade = clipDuration / 2;
  const accent = TYPE_ACCENT[selectedClip.type] || TYPE_ACCENT.video;

  const headerContent = (
    <div
      className="shrink-0 flex items-center gap-2.5 px-3.5 h-11"
      style={{ boxShadow: "inset 0 -1px 0 hsla(0,0%,100%,0.04)" }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: TYPE_COLORS[selectedClip.type] || TYPE_COLORS.video,
          boxShadow: `inset 0 1px 0 hsla(0,0%,100%,0.06), 0 0 14px -4px ${accent}`,
        }}>
        <span style={{ color: accent }}>{TYPE_ICONS[selectedClip.type]}</span>
      </div>
      <span className="text-[11.5px] font-light tracking-tight text-[hsla(0,0%,100%,0.85)] flex-1 truncate">
        {selectedClip.name}
      </span>
      <button
        onClick={() => dispatch({ type: "SELECT_CLIP", clipId: null, trackId: null })}
        className="w-6 h-6 rounded-full flex items-center justify-center text-[hsla(0,0%,100%,0.35)] hover:text-[hsla(0,0%,100%,0.85)] hover:bg-white/[0.05] transition-all duration-300"
      >
        <X className="w-3 h-3" strokeWidth={1.5} />
      </button>
    </div>
  );

  const bodyContent = (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-3">
        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {[
            { icon: <Scissors className="w-3 h-3" strokeWidth={1.5} />, label: "Split", onClick: handleSplit, color: "hsla(215,100%,60%,0.10)", text: "hsla(215,100%,80%,0.85)" },
            { icon: <Copy className="w-3 h-3" strokeWidth={1.5} />, label: "Duplicate", onClick: handleDuplicate, color: "hsla(200,100%,60%,0.10)", text: "hsla(200,100%,80%,0.85)" },
            { icon: <Trash2 className="w-3 h-3" strokeWidth={1.5} />, label: "Delete", onClick: handleDelete, color: "hsla(0,70%,55%,0.10)", text: "hsla(0,70%,75%,0.85)" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[9.5px] font-light tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-95"
              style={{
                background: action.color,
                color: action.text,
                backdropFilter: "blur(16px)",
                boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.05)",
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        {/* Name + Color Label */}
        <SectionCard title="Identity" icon={<Tag className="w-3 h-3" />} accent={accent}>
          <Input
            value={selectedClip.name}
            onChange={(e) => updateClip({ name: e.target.value })}
            className="h-8 text-[11px] font-light tracking-tight rounded-full px-3 bg-[hsla(0,0%,100%,0.025)] border-0 text-[hsla(0,0%,100%,0.85)] focus-visible:ring-1 focus-visible:ring-[hsla(215,100%,60%,0.40)]"
          />
          <div className="flex items-center gap-1.5 pt-1">
            {COLOR_LABELS.map((cl) => (
              <button
                key={cl.value || "none"}
                onClick={() => updateClip({ colorLabel: cl.value || undefined })}
                className={cn(
                  "w-5 h-5 rounded-full transition-all duration-300 hover:scale-125",
                  (selectedClip.colorLabel || "") === cl.value && "scale-125"
                )}
                style={{
                  background: cl.value || "hsla(0,0%,100%,0.08)",
                  boxShadow: (selectedClip.colorLabel || "") === cl.value
                    ? `0 0 14px ${cl.value || "hsla(0,0%,100%,0.4)"}, inset 0 0 0 2px hsla(0,0%,100%,0.95)`
                    : "inset 0 1px 0 hsla(0,0%,100%,0.10)",
                }}
                title={cl.label}
              />
            ))}
          </div>
        </SectionCard>

        {/* Timing */}
        <SectionCard title="Timing" icon={<Clock className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <ValueReadout label="Start" value={formatTime(selectedClip.start)} mono />
            <ValueReadout label="End" value={formatTime(selectedClip.end)} mono />
          </div>
          <ValueReadout label="Duration" value={`${clipDuration.toFixed(1)}s`} mono />
          {selectedClip.type === "video" && selectedClip.sourceDuration && (
            <ValueReadout label="Source" value={`${selectedClip.sourceDuration.toFixed(1)}s`} mono />
          )}
        </SectionCard>

        {/* Visual Controls */}
        <SectionCard title="Visual" icon={<Eye className="w-3 h-3" />} accent="hsl(215, 100%, 60%)">
          <SliderRow label="Opacity" value={currentOpacity * 100} displayValue={`${Math.round(currentOpacity * 100)}%`} min={0} max={100} step={1} onChange={(v) => updateClip({ opacity: v / 100 })} />
        </SectionCard>

        {/* Audio Controls */}
        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <SectionCard title="Audio" icon={<Volume2 className="w-3 h-3" />} accent="hsl(190, 70%, 55%)">
            <SliderRow label="Volume" value={currentVolume * 100} displayValue={`${Math.round(currentVolume * 100)}%`} min={0} max={100} step={1} onChange={(v) => updateClip({ volume: v / 100 })} />
          </SectionCard>
        )}

        {/* Speed */}
        {selectedClip.type === "video" && (
          <SectionCard title="Speed" icon={<Gauge className="w-3 h-3" />} accent="hsl(215, 100%, 75%)">
            <div className="grid grid-cols-3 gap-1">
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateClip({ speed: p.value })}
                  className={cn(
                    "py-1.5 rounded-full text-[10px] font-mono font-light tabular-nums transition-all duration-300 hover:scale-[1.04]",
                    Math.abs(currentSpeed - p.value) < 0.01
                      ? "text-[hsl(215,100%,85%)]"
                      : "text-[hsla(0,0%,100%,0.45)] hover:text-[hsla(0,0%,100%,0.80)] hover:bg-[hsla(0,0%,100%,0.04)]"
                  )}
                  style={{
                    background: Math.abs(currentSpeed - p.value) < 0.01
                      ? "linear-gradient(180deg, hsla(215,100%,60%,0.22), hsla(215,100%,45%,0.10))"
                      : "transparent",
                    boxShadow: Math.abs(currentSpeed - p.value) < 0.01
                      ? "inset 0 1px 0 hsla(0,0%,100%,0.08), 0 0 14px hsla(215,100%,60%,0.40)"
                      : "inset 0 1px 0 hsla(0,0%,100%,0.025)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Fades */}
        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <SectionCard title="Fades" icon={<Sunset className="w-3 h-3" />} accent="hsl(200, 100%, 75%)">
            <SliderRow
              label="Fade In" value={currentFadeIn} displayValue={`${currentFadeIn.toFixed(1)}s`}
              min={0} max={Math.max(0.5, maxFade)} step={0.1}
              onChange={(v) => updateClip({ fadeIn: Math.round(v * 10) / 10 })}
            />
            <SliderRow
              label="Fade Out" value={currentFadeOut} displayValue={`${currentFadeOut.toFixed(1)}s`}
              min={0} max={Math.max(0.5, maxFade)} step={0.1}
              onChange={(v) => updateClip({ fadeOut: Math.round(v * 10) / 10 })}
            />
          </SectionCard>
        )}

        {/* Color Grading */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <SectionCard title="Color Grade" icon={<Palette className="w-3 h-3" />} accent="hsl(195, 100%, 75%)">
            <SliderRow
              label="Brightness" value={selectedClip.brightness ?? 0} displayValue={`${(selectedClip.brightness ?? 0) > 0 ? "+" : ""}${selectedClip.brightness ?? 0}`}
              min={-100} max={100} step={1} onChange={(v) => updateClip({ brightness: v })}
              icon={<SunMedium className="w-2.5 h-2.5" />}
            />
            <SliderRow
              label="Contrast" value={selectedClip.contrast ?? 0} displayValue={`${(selectedClip.contrast ?? 0) > 0 ? "+" : ""}${selectedClip.contrast ?? 0}`}
              min={-100} max={100} step={1} onChange={(v) => updateClip({ contrast: v })}
              icon={<Contrast className="w-2.5 h-2.5" />}
            />
            <SliderRow
              label="Saturation" value={selectedClip.saturation ?? 0} displayValue={`${(selectedClip.saturation ?? 0) > 0 ? "+" : ""}${selectedClip.saturation ?? 0}`}
              min={-100} max={100} step={1} onChange={(v) => updateClip({ saturation: v })}
              icon={<Droplets className="w-2.5 h-2.5" />}
            />
          </SectionCard>
        )}

        {/* Text Styling */}
        {selectedClip.type === "text" && (
          <SectionCard title="Text Style" icon={<Type className="w-3 h-3" />} accent="hsl(195, 100%, 75%)">
            <textarea
              value={selectedClip.text || ""}
              onChange={(e) => updateClip({ text: e.target.value })}
              className="w-full h-16 text-[11px] rounded-lg px-2.5 py-2 resize-none outline-none transition-colors"
              style={{
                background: "hsla(0,0%,100%,0.04)",
                border: "1px solid hsla(0,0%,100%,0.06)",
                color: "hsla(0,0%,100%,0.8)",
              }}
              placeholder="Enter text..."
            />
            <Select
              value={selectedClip.textStyle?.fontFamily || "sans-serif"}
              onValueChange={(v) => updateClip({ textStyle: { ...(selectedClip.textStyle || { fontSize: 32, color: "#ffffff", position: "bottom" as const }), fontFamily: v } })}
            >
              <SelectTrigger className="h-7 text-[11px] bg-[hsla(0,0%,100%,0.04)] border-[hsla(0,0%,100%,0.06)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SliderRow
              label="Font Size" value={selectedClip.textStyle?.fontSize || 32} displayValue={`${selectedClip.textStyle?.fontSize || 32}px`}
              min={12} max={120} step={1}
              onChange={(v) => updateClip({ textStyle: { ...(selectedClip.textStyle || { fontFamily: "sans-serif", color: "#ffffff", position: "bottom" as const }), fontSize: v } })}
            />
            <Select
              value={selectedClip.textStyle?.position || "bottom"}
              onValueChange={(v) => updateClip({ textStyle: { ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", color: "#ffffff" }), position: v as "top" | "center" | "bottom" } })}
            >
              <SelectTrigger className="h-7 text-[11px] bg-[hsla(0,0%,100%,0.04)] border-[hsla(0,0%,100%,0.06)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-[9px] text-[hsla(0,0%,100%,0.4)]">Text</label>
              <input
                type="color"
                value={selectedClip.textStyle?.color || "#ffffff"}
                onChange={(e) => updateClip({ textStyle: { ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", position: "bottom" as const }), color: e.target.value } })}
                className="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent"
              />
              <label className="text-[9px] text-[hsla(0,0%,100%,0.4)]">BG</label>
              <input
                type="color"
                value={selectedClip.textStyle?.backgroundColor || "#000000"}
                onChange={(e) => updateClip({ textStyle: { ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", color: "#ffffff", position: "bottom" as const }), backgroundColor: e.target.value } })}
                className="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent"
              />
            </div>
          </SectionCard>
        )}

        {/* Transitions */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <SectionCard title="Transition" icon={<Wand2 className="w-3 h-3" />}>
            <Select
              value={selectedClip.transition || "none"}
              onValueChange={(v) => updateClip({ transition: v === "none" ? undefined : v as any, transitionDuration: v === "none" ? undefined : (selectedClip.transitionDuration || 0.5) })}
            >
              <SelectTrigger className="h-7 text-[11px] bg-[hsla(0,0%,100%,0.04)] border-[hsla(0,0%,100%,0.06)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="dissolve">Dissolve</SelectItem>
                <SelectItem value="wipeleft">Wipe Left</SelectItem>
                <SelectItem value="wiperight">Wipe Right</SelectItem>
                <SelectItem value="slideup">Slide Up</SelectItem>
              </SelectContent>
            </Select>
            {selectedClip.transition && selectedClip.transition !== "none" && (
              <SliderRow
                label="Duration" value={selectedClip.transitionDuration || 0.5} displayValue={`${(selectedClip.transitionDuration || 0.5).toFixed(1)}s`}
                min={0.1} max={3} step={0.1}
                onChange={(v) => updateClip({ transitionDuration: v })}
              />
            )}
          </SectionCard>
        )}
      </div>
    </ScrollArea>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        {headerContent}
        {bodyContent}
      </div>
    );
  }

  return (
    <div className={`w-52 shrink-0 flex flex-col border-l overflow-hidden ${className || ""}`} style={{ background: "hsl(220, 14%, 5%)", borderColor: "hsla(0, 0%, 100%, 0.06)" }}>
      {headerContent}
      {bodyContent}
    </div>
  );
});

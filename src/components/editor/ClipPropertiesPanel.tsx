/**
 * ClipPropertiesPanel — Inspector panel for editing selected clip properties.
 * Includes volume, speed, fade in/out, opacity, text bg color, font family, color labels.
 */

import { memo, useCallback } from "react";
import {
  X, Scissors, Copy, Trash2, Type, Clock, Film, Image, Volume2,
  AlignLeft, AlignCenter, AlignVerticalJustifyEnd, Gauge, Sunset,
  Eye, Palette, Tag, SunMedium, Contrast, Droplets, Wand2
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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Film className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
  text: <Type className="w-3.5 h-3.5" />,
  audio: <Volume2 className="w-3.5 h-3.5" />,
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

    dispatch({
      type: "TRIM_CLIP",
      trackId: state.selectedTrackId,
      clipId: selectedClip.id,
      edge: "end",
      newTime: splitTime,
    });

    const offsetIntoSource = splitTime - selectedClip.start;
    const newClip: TimelineClip = {
      id: generateClipId(),
      type: selectedClip.type,
      src: selectedClip.src,
      text: selectedClip.text,
      start: splitTime,
      end: selectedClip.end,
      trimStart: selectedClip.trimStart + offsetIntoSource,
      trimEnd: selectedClip.trimEnd,
      name: `${selectedClip.name} (split)`,
      thumbnail: selectedClip.thumbnail,
      sourceDuration: selectedClip.sourceDuration,
      textStyle: selectedClip.textStyle,
      volume: selectedClip.volume,
      speed: selectedClip.speed,
      fadeIn: selectedClip.fadeIn,
      fadeOut: selectedClip.fadeOut,
      opacity: selectedClip.opacity,
      colorLabel: selectedClip.colorLabel,
    };

    dispatch({ type: "ADD_CLIP", trackId: state.selectedTrackId, clip: newClip });
  }, [selectedClip, state.selectedTrackId, state.playheadTime, dispatch]);

  const handleDuplicate = useCallback(() => {
    if (!selectedClip || !state.selectedTrackId) return;
    const newClip: TimelineClip = {
      ...selectedClip,
      id: generateClipId(),
      start: selectedClip.end,
      end: selectedClip.end + (selectedClip.end - selectedClip.start),
      name: `${selectedClip.name} (copy)`,
    };
    dispatch({ type: "ADD_CLIP", trackId: state.selectedTrackId, clip: newClip });
  }, [selectedClip, state.selectedTrackId, dispatch]);

  const handleDelete = useCallback(() => {
    if (!state.selectedClipId || !state.selectedTrackId) return;
    dispatch({
      type: "REMOVE_CLIP",
      trackId: state.selectedTrackId,
      clipId: state.selectedClipId,
    });
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${sec.padStart(4, "0")}`;
  };

  if (!selectedClip) {
    if (embedded) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Select a clip on the timeline to edit its properties
          </p>
        </div>
      );
    }
    return (
      <div
        className={`w-52 shrink-0 flex flex-col border-l overflow-hidden ${className || ""}`}
        style={{
          background: "hsl(240, 25%, 5%)",
          borderColor: "hsla(0, 0%, 100%, 0.06)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-2 px-3 h-9 border-b"
          style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
        >
          <Scissors className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs font-semibold text-foreground/80">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Select a clip on the timeline to edit its properties
          </p>
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

  const headerContent = (
    <div
      className="shrink-0 flex items-center gap-2 px-3 h-9 border-b"
      style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
    >
      <span className="text-muted-foreground/50">{TYPE_ICONS[selectedClip.type]}</span>
      <span className="text-xs font-semibold text-foreground/80 flex-1 truncate">
        {selectedClip.name}
      </span>
      <button
        onClick={() => dispatch({ type: "SELECT_CLIP", clipId: null, trackId: null })}
        className="text-muted-foreground/40 hover:text-foreground transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );

  const bodyContent = (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-4">
        {/* Name */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Name</Label>
          <Input
            value={selectedClip.name}
            onChange={(e) => updateClip({ name: e.target.value })}
            className="h-7 text-xs bg-muted/10 border-border/20"
          />
        </div>

        {/* Color Label */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3" /> Color Label
          </Label>
          <div className="flex flex-wrap gap-1">
            {COLOR_LABELS.map((cl) => (
              <button
                key={cl.value || "none"}
                onClick={() => updateClip({ colorLabel: cl.value || undefined })}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  (selectedClip.colorLabel || "") === cl.value
                    ? "border-foreground scale-110"
                    : "border-border/20 hover:border-foreground/40"
                }`}
                style={{ background: cl.value || 'hsl(240, 25%, 10%)' }}
                title={cl.label}
              />
            ))}
          </div>
        </div>

        {/* Timing */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" /> Timing
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-muted-foreground/40">Start</span>
              <div className="text-xs font-mono text-foreground/70 bg-muted/10 rounded px-2 py-1 border border-border/10">
                {formatTime(selectedClip.start)}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40">End</span>
              <div className="text-xs font-mono text-foreground/70 bg-muted/10 rounded px-2 py-1 border border-border/10">
                {formatTime(selectedClip.end)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-muted-foreground/40">Duration</span>
            <span className="text-xs font-mono text-foreground/70">{clipDuration.toFixed(1)}s</span>
          </div>
        </div>

        {/* Trim info */}
        {selectedClip.type === "video" && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Trim</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[9px] text-muted-foreground/40">Trim Start</span>
                <div className="text-xs font-mono text-foreground/70 bg-muted/10 rounded px-2 py-1 border border-border/10">
                  {formatTime(selectedClip.trimStart)}
                </div>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground/40">Source Dur.</span>
                <div className="text-xs font-mono text-foreground/70 bg-muted/10 rounded px-2 py-1 border border-border/10">
                  {selectedClip.sourceDuration ? `${selectedClip.sourceDuration.toFixed(1)}s` : "–"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Opacity */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3" /> Opacity
          </Label>
          <Slider
            value={[currentOpacity * 100]}
            onValueChange={([v]) => updateClip({ opacity: v / 100 })}
            min={0} max={100} step={1}
            className="w-full"
          />
          <span className="text-[9px] text-muted-foreground/40">{Math.round(currentOpacity * 100)}%</span>
        </div>

        {/* Volume */}
        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Volume
            </Label>
            <Slider
              value={[currentVolume * 100]}
              onValueChange={([v]) => updateClip({ volume: v / 100 })}
              min={0} max={100} step={1}
              className="w-full"
            />
            <span className="text-[9px] text-muted-foreground/40">{Math.round(currentVolume * 100)}%</span>
          </div>
        )}

        {/* Speed */}
        {selectedClip.type === "video" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Speed
            </Label>
            <div className="flex flex-wrap gap-1">
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateClip({ speed: p.value })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                    Math.abs(currentSpeed - p.value) < 0.01
                      ? "bg-foreground/15 border-foreground/30 text-foreground"
                      : "bg-muted/10 border-border/20 text-muted-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground/40">Current: {currentSpeed}×</span>
          </div>
        )}

        {/* Fades */}
        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <Sunset className="w-3 h-3" /> Fades
            </Label>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40">Fade In</span>
                <span className="text-[9px] font-mono text-muted-foreground/40">{currentFadeIn.toFixed(1)}s</span>
              </div>
              <Slider
                value={[currentFadeIn]}
                onValueChange={([v]) => updateClip({ fadeIn: Math.round(v * 10) / 10 })}
                min={0} max={Math.max(0.5, maxFade)} step={0.1}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40">Fade Out</span>
                <span className="text-[9px] font-mono text-muted-foreground/40">{currentFadeOut.toFixed(1)}s</span>
              </div>
              <Slider
                value={[currentFadeOut]}
                onValueChange={([v]) => updateClip({ fadeOut: Math.round(v * 10) / 10 })}
                min={0} max={Math.max(0.5, maxFade)} step={0.1}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Text styling */}
        {selectedClip.type === "text" && (
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Text Content</Label>
            <textarea
              value={selectedClip.text || ""}
              onChange={(e) => updateClip({ text: e.target.value })}
              className="w-full h-16 text-xs bg-muted/10 border border-border/20 rounded-md px-2 py-1.5 resize-none text-foreground/80"
              placeholder="Enter text..."
            />
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Font Family</Label>
            <Select
              value={selectedClip.textStyle?.fontFamily || "sans-serif"}
              onValueChange={(v) =>
                updateClip({
                  textStyle: {
                    ...(selectedClip.textStyle || { fontSize: 32, color: "#ffffff", position: "bottom" as const }),
                    fontFamily: v,
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-muted/10 border-border/20">
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
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Font Size</Label>
            <Slider
              value={[selectedClip.textStyle?.fontSize || 32]}
              onValueChange={([v]) =>
                updateClip({
                  textStyle: { ...(selectedClip.textStyle || { fontFamily: "sans-serif", color: "#ffffff", position: "bottom" as const }), fontSize: v },
                })
              }
              min={12} max={120} step={1}
              className="w-full"
            />
            <span className="text-[9px] text-muted-foreground/40">{selectedClip.textStyle?.fontSize || 32}px</span>
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Position</Label>
            <Select
              value={selectedClip.textStyle?.position || "bottom"}
              onValueChange={(v) =>
                updateClip({
                  textStyle: {
                    ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", color: "#ffffff" }),
                    position: v as "top" | "center" | "bottom",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-muted/10 border-border/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top"><span className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> Top</span></SelectItem>
                <SelectItem value="center"><span className="flex items-center gap-1.5"><AlignCenter className="w-3 h-3" /> Center</span></SelectItem>
                <SelectItem value="bottom"><span className="flex items-center gap-1.5"><AlignVerticalJustifyEnd className="w-3 h-3" /> Bottom</span></SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Color</Label>
                <input
                  type="color"
                  value={selectedClip.textStyle?.color || "#ffffff"}
                  onChange={(e) =>
                    updateClip({
                      textStyle: {
                        ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", position: "bottom" as const }),
                        color: e.target.value,
                      },
                    })
                  }
                  className="w-8 h-6 rounded border border-border/20 cursor-pointer"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                  <Palette className="w-3 h-3" /> BG Color
                </Label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={selectedClip.textStyle?.backgroundColor || "#000000"}
                    onChange={(e) =>
                      updateClip({
                        textStyle: {
                          ...(selectedClip.textStyle || { fontSize: 32, fontFamily: "sans-serif", color: "#ffffff", position: "bottom" as const }),
                          backgroundColor: e.target.value,
                        },
                      })
                    }
                    className="w-8 h-6 rounded border border-border/20 cursor-pointer"
                  />
                  {selectedClip.textStyle?.backgroundColor && (
                    <button
                      onClick={() => updateClip({
                        textStyle: { ...selectedClip.textStyle!, backgroundColor: undefined },
                      })}
                      className="text-[8px] text-muted-foreground/40 hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color Grading */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <SunMedium className="w-3 h-3" /> Color Grading
            </Label>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><SunMedium className="w-2.5 h-2.5" /> Brightness</span>
                <span className="text-[9px] font-mono text-muted-foreground/40">{selectedClip.brightness ?? 0}</span>
              </div>
              <Slider
                value={[selectedClip.brightness ?? 0]}
                onValueChange={([v]) => updateClip({ brightness: v })}
                min={-100} max={100} step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><Contrast className="w-2.5 h-2.5" /> Contrast</span>
                <span className="text-[9px] font-mono text-muted-foreground/40">{selectedClip.contrast ?? 0}</span>
              </div>
              <Slider
                value={[selectedClip.contrast ?? 0]}
                onValueChange={([v]) => updateClip({ contrast: v })}
                min={-100} max={100} step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><Droplets className="w-2.5 h-2.5" /> Saturation</span>
                <span className="text-[9px] font-mono text-muted-foreground/40">{selectedClip.saturation ?? 0}</span>
              </div>
              <Slider
                value={[selectedClip.saturation ?? 0]}
                onValueChange={([v]) => updateClip({ saturation: v })}
                min={-100} max={100} step={1}
                className="w-full"
              />
            </div>
            <button
              onClick={() => updateClip({ brightness: 0, contrast: 0, saturation: 0 })}
              className="text-[9px] text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              Reset Color
            </button>
          </div>
        )}

        {/* Transition */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> Transition Out
            </Label>
            <Select
              value={selectedClip.transition || "none"}
              onValueChange={(v) => updateClip({ transition: v as any })}
            >
              <SelectTrigger className="h-7 text-xs bg-muted/10 border-border/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="dissolve">Dissolve</SelectItem>
                <SelectItem value="wipeleft">Wipe Left</SelectItem>
                <SelectItem value="wiperight">Wipe Right</SelectItem>
                <SelectItem value="slideup">Slide Up</SelectItem>
                <SelectItem value="slidedown">Slide Down</SelectItem>
              </SelectContent>
            </Select>
            {selectedClip.transition && selectedClip.transition !== "none" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground/40">Duration</span>
                  <span className="text-[9px] font-mono text-muted-foreground/40">{(selectedClip.transitionDuration ?? 0.5).toFixed(1)}s</span>
                </div>
                <Slider
                  value={[selectedClip.transitionDuration ?? 0.5]}
                  onValueChange={([v]) => updateClip({ transitionDuration: Math.round(v * 10) / 10 })}
                  min={0.1} max={2} step={0.1}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}>
          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Actions</Label>
          <Button variant="ghost" size="sm" onClick={handleSplit}
            className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground/70 hover:text-foreground"
            disabled={state.playheadTime <= selectedClip.start || state.playheadTime >= selectedClip.end}
          >
            <Scissors className="w-3 h-3" /> Split at Playhead
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDuplicate}
            className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground/70 hover:text-foreground"
          >
            <Copy className="w-3 h-3" /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}
            className="w-full justify-start gap-2 h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3 h-3" /> Delete Clip
          </Button>
        </div>
      </div>
    </ScrollArea>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {headerContent}
        {bodyContent}
      </div>
    );
  }

  return (
    <div
      className={`w-52 shrink-0 flex flex-col border-l overflow-hidden ${className || ""}`}
      style={{
        background: "hsl(240, 25%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {headerContent}
      {bodyContent}
    </div>
  );
});

/**
 * ClipPropertiesPanel — Inspector panel for editing selected clip properties.
 * Includes volume, speed, fade in/out controls.
 */

import { memo, useCallback } from "react";
import {
  X, Scissors, Copy, Trash2, Type, Clock, Film, Image, Volume2,
  AlignLeft, AlignCenter, AlignVerticalJustifyEnd, Gauge, Sunset
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

export const ClipPropertiesPanel = memo(function ClipPropertiesPanel({
  className,
}: {
  className?: string;
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
    return (
      <div
        className={`w-56 shrink-0 flex flex-col border-l ${className || ""}`}
        style={{
          background: "hsl(240, 25%, 5%)",
          borderColor: "hsla(263, 84%, 58%, 0.08)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-2 px-3 h-9 border-b"
          style={{ borderColor: "hsla(263, 84%, 58%, 0.08)" }}
        >
          <Scissors className="w-3.5 h-3.5 text-primary/60" />
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
  const maxFade = clipDuration / 2; // each fade can be at most half the clip

  return (
    <div
      className={`w-56 shrink-0 flex flex-col border-l ${className || ""}`}
      style={{
        background: "hsl(240, 25%, 5%)",
        borderColor: "hsla(263, 84%, 58%, 0.08)",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 h-9 border-b"
        style={{ borderColor: "hsla(263, 84%, 58%, 0.08)" }}
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

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
              Name
            </Label>
            <Input
              value={selectedClip.name}
              onChange={(e) => updateClip({ name: e.target.value })}
              className="h-7 text-xs bg-muted/10 border-border/20"
            />
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
              <span className="text-xs font-mono text-primary/70">{clipDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Trim info */}
          {selectedClip.type === "video" && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Trim
              </Label>
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

          {/* ─── Volume Control ─── */}
          {(selectedClip.type === "video" || selectedClip.type === "audio") && (
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Volume
              </Label>
              <Slider
                value={[currentVolume * 100]}
                onValueChange={([v]) => updateClip({ volume: v / 100 })}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <span className="text-[9px] text-muted-foreground/40">{Math.round(currentVolume * 100)}%</span>
            </div>
          )}

          {/* ─── Speed Control ─── */}
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
                        ? "bg-primary/20 border-primary/40 text-primary"
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

          {/* ─── Fade In / Out ─── */}
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
                  min={0}
                  max={Math.max(0.5, maxFade)}
                  step={0.1}
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
                  min={0}
                  max={Math.max(0.5, maxFade)}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Text styling */}
          {selectedClip.type === "text" && (
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Text Content
              </Label>
              <textarea
                value={selectedClip.text || ""}
                onChange={(e) => updateClip({ text: e.target.value })}
                className="w-full h-16 text-xs bg-muted/10 border border-border/20 rounded-md px-2 py-1.5 resize-none text-foreground/80"
                placeholder="Enter text..."
              />

              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Font Size
              </Label>
              <Slider
                value={[selectedClip.textStyle?.fontSize || 32]}
                onValueChange={([v]) =>
                  updateClip({
                    textStyle: { ...(selectedClip.textStyle || { fontFamily: "sans-serif", color: "#ffffff", position: "bottom" }), fontSize: v },
                  })
                }
                min={12}
                max={120}
                step={1}
                className="w-full"
              />
              <span className="text-[9px] text-muted-foreground/40">{selectedClip.textStyle?.fontSize || 32}px</span>

              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Position
              </Label>
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
                  <SelectItem value="top">
                    <span className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> Top</span>
                  </SelectItem>
                  <SelectItem value="center">
                    <span className="flex items-center gap-1.5"><AlignCenter className="w-3 h-3" /> Center</span>
                  </SelectItem>
                  <SelectItem value="bottom">
                    <span className="flex items-center gap-1.5"><AlignVerticalJustifyEnd className="w-3 h-3" /> Bottom</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Color
              </Label>
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
          )}

          {/* Actions */}
          <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "hsla(263, 84%, 58%, 0.08)" }}>
            <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
              Actions
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSplit}
              className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground/70 hover:text-foreground"
              disabled={state.playheadTime <= selectedClip.start || state.playheadTime >= selectedClip.end}
            >
              <Scissors className="w-3 h-3" /> Split at Playhead
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground/70 hover:text-foreground"
            >
              <Copy className="w-3 h-3" /> Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="w-full justify-start gap-2 h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3 h-3" /> Delete Clip
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});

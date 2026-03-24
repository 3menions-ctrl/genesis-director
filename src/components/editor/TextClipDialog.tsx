/**
 * TextClipDialog — Premium dialog for creating text/caption overlay clips.
 * Matches the editor's pro-dark aesthetic with blue accent system.
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useCustomTimeline,
  generateClipId,
  generateTrackId,
  TimelineClip,
} from "@/hooks/useCustomTimeline";
import { toast } from "sonner";
import { Type, AlignLeft, AlignCenter, AlignVerticalJustifyEnd, Plus, X } from "lucide-react";

const FONT_OPTIONS = [
  { label: "Sans Serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial Black", value: "'Arial Black', sans-serif" },
];

const POSITION_OPTIONS = [
  { label: "Top", value: "top", icon: <AlignLeft className="w-3 h-3" /> },
  { label: "Center", value: "center", icon: <AlignCenter className="w-3 h-3" /> },
  { label: "Bottom", value: "bottom", icon: <AlignVerticalJustifyEnd className="w-3 h-3" /> },
];

interface TextClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TextClipDialog({ open, onOpenChange }: TextClipDialogProps) {
  const { state, dispatch } = useCustomTimeline();
  const [text, setText] = useState("Your text here");
  const [duration, setDuration] = useState(5);
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [position, setPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [color, setColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("");

  const handleCreate = useCallback(() => {
    let textTrack = state.tracks.find((t) => t.type === "text");
    if (!textTrack) {
      const newTrackId = generateTrackId();
      dispatch({
        type: "ADD_TRACK",
        track: { id: newTrackId, type: "text", label: "Text 1", clips: [] },
      });
      textTrack = { id: newTrackId, type: "text" as const, label: "Text 1", clips: [] };
    }

    const lastEnd =
      textTrack.clips.length > 0
        ? Math.max(...textTrack.clips.map((c) => c.end))
        : state.playheadTime;

    const newClip: TimelineClip = {
      id: generateClipId(),
      type: "text",
      text,
      start: lastEnd,
      end: lastEnd + duration,
      trimStart: 0,
      trimEnd: duration,
      name: text.slice(0, 20) || "Text",
      textStyle: {
        fontSize,
        fontFamily,
        color,
        position,
        backgroundColor: bgColor || undefined,
      },
    };

    dispatch({ type: "ADD_CLIP", trackId: textTrack.id, clip: newClip });
    toast.success("Text clip added");
    onOpenChange(false);
    setText("Your text here");
  }, [state.tracks, state.playheadTime, text, duration, fontSize, fontFamily, position, color, bgColor, dispatch, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 overflow-hidden border-0"
        style={{
          background: "hsl(220, 14%, 7%)",
          border: "1px solid hsla(0, 0%, 100%, 0.08)",
          boxShadow: "0 25px 60px hsla(0, 0%, 0%, 0.5), 0 0 40px hsla(215, 100%, 50%, 0.05)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid hsla(0, 0%, 100%, 0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsla(160, 65%, 50%, 0.12)" }}
            >
              <Type className="w-3.5 h-3.5 text-[hsl(160,65%,55%)]" />
            </div>
            <h2 className="text-[13px] font-bold text-[hsl(0,0%,90%)]">Add Text Overlay</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsla(0,0%,100%,0.06)] transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Live preview */}
          <div
            className="relative w-full h-28 rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              background: "hsl(0, 0%, 4%)",
              border: "1px solid hsla(0, 0%, 100%, 0.06)",
            }}
          >
            {/* Aspect ratio guide lines */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: "linear-gradient(hsla(0,0%,100%,0.3) 1px, transparent 1px), linear-gradient(90deg, hsla(0,0%,100%,0.3) 1px, transparent 1px)",
              backgroundSize: "33.33% 33.33%",
            }} />
            <div
              className={`absolute left-0 right-0 flex justify-center px-4 ${
                position === "top" ? "top-3" : position === "center" ? "top-1/2 -translate-y-1/2" : "bottom-3"
              }`}
            >
              <span
                className="px-3 py-1.5 rounded-lg text-center max-w-[90%] transition-all"
                style={{
                  fontSize: `${Math.min(fontSize * 0.45, 22)}px`,
                  fontFamily,
                  color,
                  backgroundColor: bgColor || "rgba(0,0,0,0.5)",
                  textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                  wordBreak: "break-word",
                }}
              >
                {text || "Preview"}
              </span>
            </div>
            {/* Position label */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-mono text-[hsl(0,0%,40%)] bg-[hsla(0,0%,0%,0.6)]">
              {position}
            </div>
          </div>

          {/* Text content */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Text Content</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-16 text-[12px] rounded-xl px-3 py-2.5 resize-none outline-none transition-all"
              style={{
                background: "hsla(0, 0%, 100%, 0.04)",
                border: "1px solid hsla(0, 0%, 100%, 0.08)",
                color: "hsl(0, 0%, 85%)",
              }}
              placeholder="Enter your text..."
              onFocus={(e) => (e.target.style.borderColor = "hsla(215, 100%, 50%, 0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "hsla(0, 0%, 100%, 0.08)")}
            />
          </div>

          {/* Duration + Font Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Duration</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.5, Number(e.target.value)))}
                min={0.5}
                max={60}
                step={0.5}
                className="h-8 text-xs"
                style={{
                  background: "hsla(0, 0%, 100%, 0.04)",
                  border: "1px solid hsla(0, 0%, 100%, 0.08)",
                  color: "hsl(0, 0%, 85%)",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">
                Font Size — {fontSize}px
              </Label>
              <Slider
                value={[fontSize]}
                onValueChange={([v]) => setFontSize(v)}
                min={12}
                max={120}
                step={1}
              />
            </div>
          </div>

          {/* Font + Position */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Font</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="h-8 text-xs" style={{
                  background: "hsla(0, 0%, 100%, 0.04)",
                  border: "1px solid hsla(0, 0%, 100%, 0.08)",
                }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span style={{ fontFamily: f.value }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Position</Label>
              <div className="flex gap-1">
                {POSITION_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPosition(p.value as any)}
                    className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-[10px] font-semibold transition-all"
                    style={{
                      background: position === p.value ? "hsla(215, 100%, 50%, 0.15)" : "hsla(0, 0%, 100%, 0.04)",
                      border: `1px solid ${position === p.value ? "hsla(215, 100%, 50%, 0.3)" : "hsla(0, 0%, 100%, 0.08)"}`,
                      color: position === p.value ? "hsl(215, 100%, 70%)" : "hsl(0, 0%, 50%)",
                    }}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer"
                  style={{ border: "1px solid hsla(0, 0%, 100%, 0.1)" }}
                />
                <span className="text-[10px] font-mono text-[hsl(0,0%,45%)]">{color}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider font-semibold">Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor || "#000000"}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer"
                  style={{ border: "1px solid hsla(0, 0%, 100%, 0.1)" }}
                />
                {bgColor && (
                  <button
                    onClick={() => setBgColor("")}
                    className="text-[9px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3.5"
          style={{ borderTop: "1px solid hsla(0, 0%, 100%, 0.06)" }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 rounded-lg text-[11px] font-semibold text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsla(0,0%,100%,0.06)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!text.trim()}
            className="h-8 px-5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-30"
            style={{
              background: "hsl(215, 100%, 50%)",
              color: "white",
              boxShadow: "0 2px 12px hsla(215, 100%, 50%, 0.3)",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add to Timeline
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
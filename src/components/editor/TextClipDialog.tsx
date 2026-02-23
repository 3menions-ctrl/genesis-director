/**
 * TextClipDialog — Dialog for creating text/caption overlay clips.
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  useCustomTimeline,
  generateClipId,
  generateTrackId,
  TimelineClip,
} from "@/hooks/useCustomTimeline";
import { toast } from "sonner";

interface TextClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TextClipDialog({ open, onOpenChange }: TextClipDialogProps) {
  const { state, dispatch } = useCustomTimeline();
  const [text, setText] = useState("Your text here");
  const [duration, setDuration] = useState(5);
  const [fontSize, setFontSize] = useState(32);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [color, setColor] = useState("#ffffff");

  const handleCreate = useCallback(() => {
    // Find or create a text track
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
        fontFamily: "sans-serif",
        color,
        position,
      },
    };

    dispatch({ type: "ADD_CLIP", trackId: textTrack.id, clip: newClip });
    toast.success("Text clip added");
    onOpenChange(false);
    setText("Your text here");
  }, [state.tracks, state.playheadTime, text, duration, fontSize, position, color, dispatch, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/30">
        <DialogHeader>
          <DialogTitle className="text-sm font-display">Add Text Overlay</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground/70">Text Content</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-20 text-sm bg-muted/10 border border-border/20 rounded-lg px-3 py-2 resize-none text-foreground"
              placeholder="Enter your text..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground/70">Duration (s)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.5, Number(e.target.value)))}
                min={0.5}
                max={60}
                step={0.5}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground/70">Font Size</Label>
              <Slider
                value={[fontSize]}
                onValueChange={([v]) => setFontSize(v)}
                min={12}
                max={120}
                step={1}
              />
              <span className="text-[9px] text-muted-foreground/40">{fontSize}px</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground/70">Position</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground/70">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border border-border/20 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-muted-foreground/50">{color}</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div
            className="relative w-full h-24 rounded-lg border border-border/20 overflow-hidden flex items-center justify-center"
            style={{ background: "hsl(240, 28%, 8%)" }}
          >
            <div
              className={`absolute left-0 right-0 flex justify-center px-4 ${
                position === "top" ? "top-2" : position === "center" ? "top-1/2 -translate-y-1/2" : "bottom-2"
              }`}
            >
              <span
                style={{
                  fontSize: `${Math.min(fontSize, 24)}px`,
                  color,
                  fontFamily: "sans-serif",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
                className="text-center"
              >
                {text || "Preview"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!text.trim()}
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))",
              color: "white",
            }}
          >
            Add to Timeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

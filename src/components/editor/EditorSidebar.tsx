import { Type, Trash2, ArrowRightLeft, Film, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TRANSITION_TYPES, type TimelineTrack, type TimelineClip } from "./types";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onAddTextOverlay: () => void;
  onAddTransition: (clipId: string, type: string) => void;
  onDeleteClip: (clipId: string) => void;
}

export const EditorSidebar = ({
  tracks,
  selectedClipId,
  onUpdateClip,
  onAddTextOverlay,
  onAddTransition,
  onDeleteClip,
}: EditorSidebarProps) => {
  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Header */}
      <div className="h-9 flex items-center px-3 border-b border-border shrink-0 bg-surface-2">
        <Sliders className="h-3 w-3 text-muted-foreground/50 mr-2" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {selectedClip ? "Inspector" : "Tools"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!selectedClip ? (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Select a clip on the timeline, or add new elements.
            </p>

            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border"
              onClick={onAddTextOverlay}
            >
              <Type className="h-3.5 w-3.5" />
              Add Text Overlay
            </Button>
          </div>
        ) : selectedClip.type === "text" ? (
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Content</Label>
              <Input
                value={selectedClip.textContent || ""}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { textContent: e.target.value })
                }
                className="mt-1.5 h-8 text-xs bg-background border-border text-foreground/80 focus-visible:ring-primary/50"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Font Size</Label>
              <Slider
                value={[selectedClip.textStyle?.fontSize || 48]}
                min={12}
                max={120}
                step={1}
                onValueChange={([v]) =>
                  onUpdateClip(selectedClip.id, {
                    textStyle: { ...selectedClip.textStyle!, fontSize: v },
                  })
                }
                className="mt-2"
              />
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {selectedClip.textStyle?.fontSize || 48}px
              </span>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      textStyle: { ...selectedClip.textStyle!, color: e.target.value },
                    })
                  }
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      textStyle: { ...selectedClip.textStyle!, color: e.target.value },
                    })
                  }
                  className="flex-1 h-7 text-[10px] bg-background border-border text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</Label>
              <Slider
                value={[selectedClip.end - selectedClip.start]}
                min={0.5}
                max={30}
                step={0.5}
                onValueChange={([v]) =>
                  onUpdateClip(selectedClip.id, { end: selectedClip.start + v })
                }
                className="mt-2"
              />
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {(selectedClip.end - selectedClip.start).toFixed(1)}s
              </span>
            </div>

            <div className="h-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 h-7 text-[11px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 border border-destructive/20"
              onClick={() => onDeleteClip(selectedClip.id)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        ) : (
          /* Video/audio clip properties */
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Clip</Label>
              <p className="text-[11px] font-medium text-foreground/70 mt-1 truncate">{selectedClip.label}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "In", value: `${selectedClip.start.toFixed(2)}s` },
                { label: "Out", value: `${selectedClip.end.toFixed(2)}s` },
                { label: "Dur", value: `${(selectedClip.end - selectedClip.start).toFixed(2)}s` },
              ].map((item) => (
                <div key={item.label} className="bg-background rounded px-2 py-1.5 border border-border">
                  <span className="text-[8px] text-muted-foreground/50 uppercase tracking-wider block">{item.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-border" />

            {/* Transitions */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="h-2.5 w-2.5" />
                Transition
              </Label>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {TRANSITION_TYPES.map((t) => {
                  const isActive = selectedClip.effects.some(
                    (e) => e.type === "transition" && e.name === t.id
                  );
                  return (
                    <Button
                      key={t.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-[9px] h-6 border",
                        isActive
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
                      )}
                      onClick={() => onAddTransition(selectedClip.id, t.id)}
                    >
                      {t.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 h-7 text-[11px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 border border-destructive/20"
              onClick={() => onDeleteClip(selectedClip.id)}
            >
              <Trash2 className="h-3 w-3" />
              Delete Clip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

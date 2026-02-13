import { Type, Sparkles, Trash2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { TRANSITION_TYPES, type TimelineTrack, type TimelineClip } from "./types";

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
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {selectedClip ? "Properties" : "Tools"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedClip ? (
          /* No selection — show add tools */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select a clip on the timeline to edit its properties, or add new elements.
            </p>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onAddTextOverlay}
            >
              <Type className="h-4 w-4" />
              Add Text Overlay
            </Button>
          </div>
        ) : selectedClip.type === "text" ? (
          /* Text clip properties */
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Text Content</Label>
              <Input
                value={selectedClip.textContent || ""}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { textContent: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Font Size</Label>
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
              <span className="text-[10px] text-muted-foreground">
                {selectedClip.textStyle?.fontSize || 48}px
              </span>
            </div>

            <div>
              <Label className="text-xs">Color</Label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      textStyle: { ...selectedClip.textStyle!, color: e.target.value },
                    })
                  }
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
                <Input
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      textStyle: { ...selectedClip.textStyle!, color: e.target.value },
                    })
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Duration (seconds)</Label>
              <Slider
                value={[selectedClip.end - selectedClip.start]}
                min={0.5}
                max={30}
                step={0.5}
                onValueChange={([v]) =>
                  onUpdateClip(selectedClip.id, {
                    end: selectedClip.start + v,
                  })
                }
                className="mt-2"
              />
              <span className="text-[10px] text-muted-foreground">
                {(selectedClip.end - selectedClip.start).toFixed(1)}s
              </span>
            </div>

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => onDeleteClip(selectedClip.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ) : (
          /* Video/audio clip properties */
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Clip</Label>
              <p className="text-sm font-medium mt-1 truncate">{selectedClip.label}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">In</Label>
                <p className="text-xs font-mono">{selectedClip.start.toFixed(2)}s</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Out</Label>
                <p className="text-xs font-mono">{selectedClip.end.toFixed(2)}s</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Duration</Label>
                <p className="text-xs font-mono">
                  {(selectedClip.end - selectedClip.start).toFixed(2)}s
                </p>
              </div>
            </div>

            <Separator />

            {/* Transitions */}
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <ArrowRightLeft className="h-3 w-3" />
                Transition
              </Label>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {TRANSITION_TYPES.map((t) => {
                  const isActive = selectedClip.effects.some(
                    (e) => e.type === "transition" && e.name === t.id
                  );
                  return (
                    <Button
                      key={t.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="text-[10px] h-7"
                      onClick={() => onAddTransition(selectedClip.id, t.id)}
                    >
                      {t.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => onDeleteClip(selectedClip.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Clip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

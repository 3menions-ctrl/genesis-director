import { Type, Trash2, ArrowRightLeft, Sliders, Volume2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRANSITION_TYPES, type TimelineTrack, type TimelineClip } from "./types";
import { ColorGradingPanel } from "./ColorGradingPanel";
import { KeyframeEditor } from "./KeyframeEditor";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  currentTime?: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onAddTextOverlay: () => void;
  onAddTransition: (clipId: string, type: string) => void;
  onDeleteClip: (clipId: string) => void;
}

export const EditorSidebar = ({
  tracks,
  selectedClipId,
  currentTime = 0,
  onUpdateClip,
  onAddTextOverlay,
  onAddTransition,
  onDeleteClip,
}: EditorSidebarProps) => {
  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="h-full flex flex-col bg-[hsl(260,15%,7%)] border-l border-white/[0.06]">
      {/* Header */}
      <div className="h-9 flex items-center px-3 border-b border-white/[0.06] shrink-0 bg-[hsl(260,15%,8%)] relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <Sliders className="h-3 w-3 text-primary/40 mr-2" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {selectedClip ? "Inspector" : "Tools"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide">
        {!selectedClip ? (
          <div className="space-y-4">
            <p className="text-[11px] text-white/30 leading-relaxed">
              Select a clip on the timeline, or add new elements.
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 h-9 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.06] rounded-lg transition-all group"
              onClick={onAddTextOverlay}
            >
              <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                <Type className="h-2.5 w-2.5 text-amber-400" />
              </div>
              Add Text Overlay
            </Button>
          </div>
        ) : selectedClip.type === "text" ? (
          <div className="space-y-4">
            <div>
              <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Content</Label>
              <Input
                value={selectedClip.textContent || ""}
                onChange={(e) => onUpdateClip(selectedClip.id, { textContent: e.target.value })}
                className="mt-1.5 h-8 text-xs bg-white/[0.03] border-white/[0.06] text-white/80 focus-visible:ring-primary/30 focus-visible:border-primary/30 rounded-md"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Font Size</Label>
              <Slider
                value={[selectedClip.textStyle?.fontSize || 48]}
                min={12} max={120} step={1}
                onValueChange={([v]) => onUpdateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, fontSize: v } })}
                className="mt-2"
              />
              <span className="text-[9px] text-white/25 tabular-nums font-mono">{selectedClip.textStyle?.fontSize || 48}px</span>
            </div>
            <div>
              <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) => onUpdateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, color: e.target.value } })}
                  className="w-7 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
                />
                <Input
                  value={selectedClip.textStyle?.color || "#FFFFFF"}
                  onChange={(e) => onUpdateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, color: e.target.value } })}
                  className="flex-1 h-7 text-[10px] bg-white/[0.03] border-white/[0.06] text-white/50 font-mono"
                />
              </div>
            </div>
            <div className="h-px bg-white/[0.04]" />
            <Button
              variant="ghost" size="sm"
              className="w-full gap-1.5 h-7 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-md"
              onClick={() => onDeleteClip(selectedClip.id)}
            >
              <Trash2 className="h-2.5 w-2.5" /> Delete
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="w-full h-7 bg-white/[0.03] p-0.5 gap-0.5 rounded-lg border border-white/[0.04]">
              <TabsTrigger value="properties" className="text-[9px] h-5.5 flex-1 rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_hsl(263,70%,58%,0.1)] text-white/35 font-medium tracking-wide transition-all">
                Properties
              </TabsTrigger>
              <TabsTrigger value="color" className="text-[9px] h-5.5 flex-1 rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_hsl(263,70%,58%,0.1)] text-white/35 font-medium tracking-wide transition-all">
                Color
              </TabsTrigger>
              <TabsTrigger value="keyframes" className="text-[9px] h-5.5 flex-1 rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_hsl(263,70%,58%,0.1)] text-white/35 font-medium tracking-wide transition-all">
                Animate
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="mt-3 space-y-4">
              <div>
                <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Clip</Label>
                <p className="text-[11px] font-medium text-white/60 mt-1 truncate">{selectedClip.label}</p>
              </div>

              {/* Timecode grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "IN", value: `${selectedClip.start.toFixed(2)}s` },
                  { label: "OUT", value: `${selectedClip.end.toFixed(2)}s` },
                  { label: "DUR", value: `${(selectedClip.end - selectedClip.start).toFixed(2)}s` },
                ].map((item) => (
                  <div key={item.label} className="bg-black/20 rounded-md px-2 py-1.5 border border-white/[0.04]">
                    <span className="text-[7px] text-white/20 uppercase tracking-[0.2em] block font-semibold">{item.label}</span>
                    <span className="text-[10px] font-mono text-primary/70 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Volume */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3 w-3 text-white/25" />
                  <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Volume</Label>
                  <span className="ml-auto text-[8px] tabular-nums text-white/20 font-mono">{selectedClip.volume ?? 100}%</span>
                </div>
                <Slider
                  value={[selectedClip.volume ?? 100]}
                  min={0} max={100} step={1}
                  onValueChange={([v]) => onUpdateClip(selectedClip.id, { volume: v })}
                />
              </div>

              <div className="h-px bg-white/[0.04]" />

              {/* Transitions */}
              <div>
                <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
                  <ArrowRightLeft className="h-2.5 w-2.5" /> Transitions
                </Label>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {TRANSITION_TYPES.map((t) => {
                    const isActive = selectedClip.effects.some((e) => e.type === "transition" && e.name === t.id);
                    return (
                      <Button
                        key={t.id} variant="ghost" size="sm"
                        className={cn(
                          "text-[9px] h-6 border rounded-md transition-all",
                          isActive
                            ? "bg-primary/10 border-primary/25 text-primary shadow-[0_0_8px_hsl(263,70%,58%,0.08)]"
                            : "border-white/[0.04] text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                        )}
                        onClick={() => onAddTransition(selectedClip.id, t.id)}
                      >
                        {t.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-white/[0.04]" />

              <Button
                variant="ghost" size="sm"
                className="w-full gap-1.5 h-7 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-md transition-all"
                onClick={() => onDeleteClip(selectedClip.id)}
              >
                <Trash2 className="h-2.5 w-2.5" /> Delete Clip
              </Button>
            </TabsContent>

            <TabsContent value="color" className="mt-3">
              <ColorGradingPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>

            <TabsContent value="keyframes" className="mt-3">
              <KeyframeEditor clip={selectedClip} currentTime={currentTime} onUpdateClip={onUpdateClip} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};
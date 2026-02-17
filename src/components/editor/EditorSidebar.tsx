import { Type, Trash2, ArrowRightLeft, Sliders, Volume2, Gauge, Crop, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRANSITION_TYPES, type TimelineTrack, type TimelineClip } from "./types";
import { ColorGradingPanel } from "./ColorGradingPanel";
import { KeyframeEditor } from "./KeyframeEditor";
import { SpeedControlPanel } from "./SpeedControlPanel";
import { CropRotatePanel } from "./CropRotatePanel";
import { FiltersPanel } from "./FiltersPanel";
import { AudioFadePanel } from "./AudioFadePanel";
import { PipPanel } from "./PipPanel";
import { ChromaKeyPanel } from "./ChromaKeyPanel";
import { CaptionsPanel } from "./CaptionsPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  currentTime?: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onAddTextOverlay: () => void;
  onAddTransition: (clipId: string, type: string) => void;
  onDeleteClip: (clipId: string) => void;
  onApplyTemplate?: (templateId: string) => void;
}

export const EditorSidebar = ({
  tracks, selectedClipId, currentTime = 0,
  onUpdateClip, onAddTextOverlay, onAddTransition, onDeleteClip, onApplyTemplate,
}: EditorSidebarProps) => {
  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="h-full flex flex-col bg-[hsl(0,0%,5%)]/80 backdrop-blur-xl border-l border-white/[0.06]">
      <div className="h-10 flex items-center px-4 border-b border-white/[0.06] shrink-0">
        <Sliders className="h-3 w-3 text-white/40 mr-2" />
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
              className="w-full justify-start gap-2.5 h-9 text-[11px] text-white/70 hover:text-white hover:bg-white/[0.06] border border-white/[0.06] rounded-lg transition-all group"
              onClick={onAddTextOverlay}
            >
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                <Type className="h-2.5 w-2.5 text-amber-400" />
              </div>
              Add Text Overlay
            </Button>

            <div className="h-px bg-white/[0.04]" />
            <TemplatesPanel onApplyTemplate={onApplyTemplate || (() => {})} />
          </div>
        ) : selectedClip.type === "text" ? (
          <TextClipInspector clip={selectedClip} onUpdateClip={onUpdateClip} onDeleteClip={onDeleteClip} />
        ) : (
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="w-full h-auto bg-white/[0.03] p-0.5 gap-0.5 rounded-lg border border-white/[0.06] flex flex-wrap">
              {[
                { value: "properties", label: "Props" },
                { value: "filters", label: "Filters" },
                { value: "audio", label: "Audio" },
                { value: "speed", label: "Speed" },
                { value: "crop", label: "Crop" },
                { value: "color", label: "Color" },
                { value: "pip", label: "PiP" },
                { value: "chroma", label: "Green" },
                { value: "captions", label: "Caption" },
                { value: "keyframes", label: "Anim" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-[7px] h-5 flex-1 min-w-[40px] rounded-md data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-white/35 font-medium tracking-wide transition-all"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="properties" className="mt-3 space-y-4">
              <PropertiesTab clip={selectedClip} onUpdateClip={onUpdateClip} onAddTransition={onAddTransition} onDeleteClip={onDeleteClip} />
            </TabsContent>
            <TabsContent value="filters" className="mt-3">
              <FiltersPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="audio" className="mt-3">
              <AudioFadePanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="speed" className="mt-3">
              <SpeedControlPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="crop" className="mt-3">
              <CropRotatePanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="color" className="mt-3">
              <ColorGradingPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="pip" className="mt-3">
              <PipPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="chroma" className="mt-3">
              <ChromaKeyPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
            </TabsContent>
            <TabsContent value="captions" className="mt-3">
              <CaptionsPanel clip={selectedClip} onUpdateClip={onUpdateClip} />
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

const TextClipInspector = ({ clip, onUpdateClip, onDeleteClip }: { clip: TimelineClip; onUpdateClip: (id: string, u: Partial<TimelineClip>) => void; onDeleteClip: (id: string) => void }) => (
  <div className="space-y-4">
    <div>
      <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Content</Label>
      <Input
        value={clip.textContent || ""}
        onChange={(e) => onUpdateClip(clip.id, { textContent: e.target.value })}
        className="mt-1.5 h-8 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 focus-visible:ring-white/20 focus-visible:border-white/20 rounded-md"
      />
    </div>
    <div>
      <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Font Size</Label>
      <Slider
        value={[clip.textStyle?.fontSize || 48]}
        min={12} max={120} step={1}
        onValueChange={([v]) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, fontSize: v } })}
        className="mt-2"
      />
      <span className="text-[9px] text-white/25 tabular-nums font-mono">{clip.textStyle?.fontSize || 48}px</span>
    </div>
    <div>
      <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Color</Label>
      <div className="flex gap-2 mt-1.5">
        <input
          type="color"
          value={clip.textStyle?.color || "#FFFFFF"}
          onChange={(e) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, color: e.target.value } })}
          className="w-7 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
        />
        <Input
          value={clip.textStyle?.color || "#FFFFFF"}
          onChange={(e) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, color: e.target.value } })}
          className="flex-1 h-7 text-[10px] bg-white/[0.04] border-white/[0.06] text-white/50 font-mono"
        />
      </div>
    </div>
    <div className="h-px bg-white/[0.04]" />
    <Button
      variant="ghost" size="sm"
      className="w-full gap-1.5 h-7 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-md"
      onClick={() => onDeleteClip(clip.id)}
    >
      <Trash2 className="h-2.5 w-2.5" /> Delete
    </Button>
  </div>
);

const PropertiesTab = ({ clip, onUpdateClip, onAddTransition, onDeleteClip }: {
  clip: TimelineClip;
  onUpdateClip: (id: string, u: Partial<TimelineClip>) => void;
  onAddTransition: (id: string, type: string) => void;
  onDeleteClip: (id: string) => void;
}) => (
  <>
    <div>
      <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Clip</Label>
      <p className="text-[11px] font-medium text-white/60 mt-1 truncate">{clip.label}</p>
    </div>

    <div className="grid grid-cols-3 gap-1.5">
      {[
        { label: "IN", value: `${clip.start.toFixed(2)}s` },
        { label: "OUT", value: `${clip.end.toFixed(2)}s` },
        { label: "DUR", value: `${(clip.end - clip.start).toFixed(2)}s` },
      ].map((item) => (
        <div key={item.label} className="bg-white/[0.03] rounded-md px-2 py-1.5 border border-white/[0.04]">
          <span className="text-[7px] text-white/20 uppercase tracking-[0.2em] block font-semibold">{item.label}</span>
          <span className="text-[10px] font-mono text-white/70 tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Volume2 className="h-3 w-3 text-white/25" />
        <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Volume</Label>
        <span className="ml-auto text-[8px] tabular-nums text-white/20 font-mono">{clip.volume ?? 100}%</span>
      </div>
      <Slider
        value={[clip.volume ?? 100]}
        min={0} max={100} step={1}
        onValueChange={([v]) => onUpdateClip(clip.id, { volume: v })}
      />
    </div>

    <div className="h-px bg-white/[0.04]" />

    <div>
      <Label className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
        <ArrowRightLeft className="h-2.5 w-2.5" /> Transitions
      </Label>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {TRANSITION_TYPES.map((t) => {
          const isActive = clip.effects.some((e) => e.type === "transition" && e.name === t.id);
          return (
            <Button
              key={t.id} variant="ghost" size="sm"
              className={cn(
                "text-[9px] h-6 border rounded-md transition-all",
                isActive
                  ? "bg-white text-black border-white/20 font-semibold"
                  : "border-white/[0.06] text-white/35 hover:text-white hover:bg-white/[0.06]"
              )}
              onClick={() => onAddTransition(clip.id, t.id)}
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
      onClick={() => onDeleteClip(clip.id)}
    >
      <Trash2 className="h-2.5 w-2.5" /> Delete Clip
    </Button>
  </>
);

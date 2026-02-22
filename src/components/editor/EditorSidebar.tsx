import { Type, Trash2, ArrowRightLeft, Sliders, Volume2, Gauge, Crop, Layout, Music, Zap, Smile, Wand2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRANSITION_TYPES, type TimelineTrack, type TimelineClip, type MusicTrack } from "./types";
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
import { MusicLibraryPanel } from "./MusicLibraryPanel";
import { TrendingEffectsPanel } from "./TrendingEffectsPanel";
import { StickersPanel } from "./StickersPanel";
import { TextAnimationPanel } from "./TextAnimationPanel";
import { BeatSyncPanel } from "./BeatSyncPanel";
import { AudioUploadPanel } from "./AudioUploadPanel";
import { TextToVideoPanel } from "./TextToVideoPanel";
import { cn } from "@/lib/utils";
import type { Caption } from "./types";

interface EditorSidebarProps {
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  currentTime?: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onAddTextOverlay: () => void;
  onAddTransition: (clipId: string, type: string) => void;
  onDeleteClip: (clipId: string) => void;
  onApplyTemplate?: (templateId: string) => void;
  onAddMusic?: (track: MusicTrack) => void;
  onAddSticker?: (stickerId: string, content: string, category: string) => void;
  onApplyEffect?: (effectId: string) => void;
  onBeatSyncAutocut?: (cutPoints: number[]) => void;
  onAudioUploaded?: (audioUrl: string, duration: number, captions: Caption[]) => void;
  onGenerateVideosFromAudio?: (segments: { start: number; end: number; prompt: string }[]) => void;
  isGeneratingFromAudio?: boolean;
  onGenerateTextToVideo?: (prompt: string, durationSeconds: number, insertAt: number) => void;
  isGeneratingTextToVideo?: boolean;
}

export const EditorSidebar = ({
  tracks, selectedClipId, currentTime = 0,
  onUpdateClip, onAddTextOverlay, onAddTransition, onDeleteClip, onApplyTemplate,
  onAddMusic, onAddSticker, onApplyEffect, onBeatSyncAutocut,
  onAudioUploaded, onGenerateVideosFromAudio, isGeneratingFromAudio,
  onGenerateTextToVideo, isGeneratingTextToVideo,
}: EditorSidebarProps) => {
  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="h-full flex flex-col bg-[#060f0b]/90 backdrop-blur-xl border-l border-emerald-400/[0.06]">
      <div className="h-10 flex items-center px-4 border-b border-emerald-400/[0.06] shrink-0 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent" />
        <Sliders className="h-3 w-3 text-emerald-400/40 mr-2" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/35">
          {selectedClip ? "Inspector" : "Tools"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide">
        {!selectedClip ? (
          <div className="space-y-4">
            <p className="text-[11px] text-emerald-300/30 leading-relaxed">
              Select a clip on the timeline, or add new elements.
            </p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="ghost"
                className="justify-start gap-2 h-9 text-[10px] text-emerald-200/40 hover:text-emerald-100/80 hover:bg-emerald-400/[0.06] border border-emerald-400/[0.08] rounded-xl transition-all group"
                onClick={onAddTextOverlay}
              >
                <div className="w-5 h-5 rounded-lg bg-purple-400/10 border border-purple-400/15 flex items-center justify-center">
                  <Type className="h-2.5 w-2.5 text-purple-300" />
                </div>
                Text
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-2 h-9 text-[10px] text-emerald-200/40 hover:text-emerald-100/80 hover:bg-emerald-400/[0.06] border border-emerald-400/[0.08] rounded-xl transition-all group"
                onClick={() => onAddSticker?.("fire", "🔥", "emoji")}
              >
                <div className="w-5 h-5 rounded-lg bg-pink-400/10 border border-pink-400/15 flex items-center justify-center">
                  <Smile className="h-2.5 w-2.5 text-pink-300" />
                </div>
                Sticker
              </Button>
            </div>

            <div className="h-px bg-emerald-400/[0.06]" />

            {/* Tabbed tool panels */}
            <Tabs defaultValue="generate" className="w-full">
              <TabsList className="w-full h-auto bg-emerald-400/[0.03] p-0.5 gap-0.5 rounded-xl border border-emerald-400/[0.08] flex flex-wrap">
                {[
                  { value: "generate", label: "Generate", icon: Sparkles },
                  { value: "audio-upload", label: "Audio", icon: Upload },
                  { value: "templates", label: "Templates", icon: Layout },
                  { value: "music", label: "Music", icon: Music },
                  { value: "effects", label: "Effects", icon: Zap },
                  { value: "stickers", label: "Stickers", icon: Smile },
                  { value: "beatsync", label: "Beat", icon: Wand2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-1 text-[8px] h-6 min-w-[40px] rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-400 data-[state=active]:to-cyan-400 data-[state=active]:text-[#040d08] data-[state=active]:shadow-sm text-emerald-300/30 font-medium tracking-wide transition-all gap-1"
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="generate" className="mt-3">
                <TextToVideoPanel
                  currentTime={currentTime}
                  onGenerate={onGenerateTextToVideo || (() => {})}
                  isGenerating={isGeneratingTextToVideo}
                />
              </TabsContent>
              <TabsContent value="audio-upload" className="mt-3">
                <AudioUploadPanel
                  onAudioUploaded={onAudioUploaded || (() => {})}
                  onGenerateVideos={onGenerateVideosFromAudio || (() => {})}
                  isGenerating={isGeneratingFromAudio}
                />
              </TabsContent>
              <TabsContent value="templates" className="mt-3">
                <TemplatesPanel onApplyTemplate={onApplyTemplate || (() => {})} />
              </TabsContent>
              <TabsContent value="music" className="mt-3">
                <MusicLibraryPanel onAddMusic={onAddMusic || (() => {})} />
              </TabsContent>
              <TabsContent value="effects" className="mt-3">
                <TrendingEffectsPanel onApplyEffect={onApplyEffect || (() => {})} />
              </TabsContent>
              <TabsContent value="stickers" className="mt-3">
                <StickersPanel onAddSticker={onAddSticker || (() => {})} />
              </TabsContent>
              <TabsContent value="beatsync" className="mt-3">
                <BeatSyncPanel tracks={tracks} onAutocut={onBeatSyncAutocut || (() => {})} />
              </TabsContent>
            </Tabs>
          </div>
        ) : selectedClip.type === "text" ? (
          <TextClipInspector clip={selectedClip} onUpdateClip={onUpdateClip} onDeleteClip={onDeleteClip} />
        ) : (
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="w-full h-auto bg-emerald-400/[0.03] p-0.5 gap-0.5 rounded-xl border border-emerald-400/[0.08] flex flex-wrap">
              {[
                { value: "properties", label: "Props" },
                { value: "filters", label: "Filters" },
                { value: "effects", label: "FX" },
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
                  className="text-[7px] h-5 flex-1 min-w-[40px] rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-400 data-[state=active]:to-cyan-400 data-[state=active]:text-[#040d08] data-[state=active]:shadow-sm text-emerald-300/30 font-medium tracking-wide transition-all"
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
            <TabsContent value="effects" className="mt-3">
              <TrendingEffectsPanel onApplyEffect={onApplyEffect || (() => {})} />
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
      <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold">Content</Label>
      <Input
        value={clip.textContent || ""}
        onChange={(e) => onUpdateClip(clip.id, { textContent: e.target.value })}
        className="mt-1.5 h-8 text-xs bg-emerald-400/[0.03] border-emerald-400/[0.08] text-emerald-100/60 focus-visible:ring-emerald-400/20 focus-visible:border-emerald-400/20 rounded-xl"
      />
    </div>
    <div>
      <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold">Font Size</Label>
      <Slider
        value={[clip.textStyle?.fontSize || 48]}
        min={12} max={120} step={1}
        onValueChange={([v]) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, fontSize: v } })}
        className="mt-2"
      />
      <span className="text-[9px] text-emerald-300/25 tabular-nums font-mono">{clip.textStyle?.fontSize || 48}px</span>
    </div>
    <div>
      <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold">Color</Label>
      <div className="flex gap-2 mt-1.5">
        <input
          type="color"
          value={clip.textStyle?.color || "#FFFFFF"}
          onChange={(e) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, color: e.target.value } })}
          className="w-7 h-7 rounded-lg border border-emerald-400/[0.1] cursor-pointer bg-transparent"
        />
        <Input
          value={clip.textStyle?.color || "#FFFFFF"}
          onChange={(e) => onUpdateClip(clip.id, { textStyle: { ...clip.textStyle!, color: e.target.value } })}
          className="flex-1 h-7 text-[10px] bg-emerald-400/[0.03] border-emerald-400/[0.08] text-emerald-300/40 font-mono"
        />
      </div>
    </div>
    <div className="h-px bg-emerald-400/[0.06]" />
    <Button
      variant="ghost" size="sm"
      className="w-full gap-1.5 h-7 text-[10px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-xl"
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
      <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold">Clip</Label>
      <p className="text-[11px] font-medium text-emerald-100/40 mt-1 truncate">{clip.label}</p>
    </div>

    <div className="grid grid-cols-3 gap-1.5">
      {[
        { label: "IN", value: `${clip.start.toFixed(2)}s` },
        { label: "OUT", value: `${clip.end.toFixed(2)}s` },
        { label: "DUR", value: `${(clip.end - clip.start).toFixed(2)}s` },
      ].map((item) => (
        <div key={item.label} className="bg-emerald-400/[0.03] rounded-xl px-2 py-1.5 border border-emerald-400/[0.08]">
          <span className="text-[7px] text-emerald-300/25 uppercase tracking-[0.2em] block font-semibold">{item.label}</span>
          <span className="text-[10px] font-mono text-emerald-100/50 tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Volume2 className="h-3 w-3 text-emerald-400/25" />
        <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold">Volume</Label>
        <span className="ml-auto text-[8px] tabular-nums text-emerald-300/20 font-mono">{clip.volume ?? 100}%</span>
      </div>
      <Slider
        value={[clip.volume ?? 100]}
        min={0} max={100} step={1}
        onValueChange={([v]) => onUpdateClip(clip.id, { volume: v })}
      />
    </div>

    <div className="h-px bg-emerald-400/[0.06]" />

    <div>
      <Label className="text-[9px] text-emerald-300/30 uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
        <ArrowRightLeft className="h-2.5 w-2.5" /> Transitions
      </Label>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {TRANSITION_TYPES.map((t) => {
          const isActive = clip.effects.some((e) => e.type === "transition" && e.name === t.id);
          return (
            <Button
              key={t.id} variant="ghost" size="sm"
              className={cn(
                "text-[9px] h-6 border rounded-xl transition-all",
                isActive
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#040d08] border-emerald-400/20 font-semibold"
                  : "border-emerald-400/[0.08] text-emerald-300/30 hover:text-emerald-200/60 hover:bg-emerald-400/[0.06]"
              )}
              onClick={() => onAddTransition(clip.id, t.id)}
            >
              {t.name}
            </Button>
          );
        })}
      </div>
    </div>

    <div className="h-px bg-emerald-400/[0.06]" />

    <Button
      variant="ghost" size="sm"
      className="w-full gap-1.5 h-7 text-[10px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-xl transition-all"
      onClick={() => onDeleteClip(clip.id)}
    >
      <Trash2 className="h-2.5 w-2.5" /> Delete Clip
    </Button>
  </>
);

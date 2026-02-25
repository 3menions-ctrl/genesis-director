/**
 * TemplatesPanel — Comprehensive templates for video presets, text overlays, and style presets.
 */

import { memo, useState, useCallback } from "react";
import {
  Film, Type, Sparkles, Clock, Zap, Clapperboard, 
  MessageSquare, Subtitles, CaseSensitive, Gauge,
  Sun, Moon, Palette, ChevronRight
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomTimeline, generateClipId, TimelineClip } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Template Data ───

interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  duration: number;
  clips: Omit<TimelineClip, "id">[];
}

interface TextTemplate {
  id: string;
  name: string;
  preview: string;
  style: NonNullable<TimelineClip["textStyle"]>;
  duration: number;
}

interface StylePreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  updates: Partial<TimelineClip>;
}

const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "tiktok-intro",
    name: "TikTok Intro",
    description: "Quick 3s hook + 5s content",
    icon: <Zap className="w-3.5 h-3.5" />,
    duration: 8,
    clips: [
      { type: "text", text: "HOOK TEXT HERE", start: 0, end: 3, trimStart: 0, trimEnd: 0, name: "Hook", textStyle: { fontSize: 48, fontFamily: "Impact, sans-serif", color: "#ffffff", position: "center" } },
      { type: "video", start: 0, end: 8, trimStart: 0, trimEnd: 0, name: "Main Video" },
    ],
  },
  {
    id: "yt-short",
    name: "YouTube Short",
    description: "15s vertical short format",
    icon: <Film className="w-3.5 h-3.5" />,
    duration: 15,
    clips: [
      { type: "text", text: "YOUR TITLE", start: 0, end: 3, trimStart: 0, trimEnd: 0, name: "Title Card", textStyle: { fontSize: 42, fontFamily: "sans-serif", color: "#ffffff", position: "center" } },
      { type: "video", start: 0, end: 15, trimStart: 0, trimEnd: 0, name: "Content" },
      { type: "text", text: "Follow for more!", start: 12, end: 15, trimStart: 0, trimEnd: 0, name: "CTA", textStyle: { fontSize: 28, fontFamily: "sans-serif", color: "#fbbf24", position: "bottom" } },
    ],
  },
  {
    id: "cinematic-trailer",
    name: "Cinematic Trailer",
    description: "Dramatic 30s trailer structure",
    icon: <Clapperboard className="w-3.5 h-3.5" />,
    duration: 30,
    clips: [
      { type: "video", start: 0, end: 8, trimStart: 0, trimEnd: 0, name: "Act 1 — Setup", fadeIn: 1.5, fadeOut: 0.5 },
      { type: "video", start: 8, end: 18, trimStart: 0, trimEnd: 0, name: "Act 2 — Tension", fadeIn: 0.3, fadeOut: 0.3 },
      { type: "video", start: 18, end: 27, trimStart: 0, trimEnd: 0, name: "Act 3 — Climax", fadeIn: 0.3, fadeOut: 1 },
      { type: "text", text: "COMING SOON", start: 27, end: 30, trimStart: 0, trimEnd: 0, name: "Title Slate", textStyle: { fontSize: 56, fontFamily: "serif", color: "#ffffff", position: "center" } },
    ],
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    description: "Clean 20s product demo",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    duration: 20,
    clips: [
      { type: "text", text: "Introducing", start: 0, end: 3, trimStart: 0, trimEnd: 0, name: "Intro Text", textStyle: { fontSize: 36, fontFamily: "sans-serif", color: "#ffffff", position: "center" } },
      { type: "video", start: 3, end: 16, trimStart: 0, trimEnd: 0, name: "Product Demo", fadeIn: 0.5 },
      { type: "text", text: "Get Yours Today", start: 16, end: 20, trimStart: 0, trimEnd: 0, name: "CTA", textStyle: { fontSize: 40, fontFamily: "sans-serif", color: "#22c55e", position: "center" } },
    ],
  },
  {
    id: "montage",
    name: "Quick Montage",
    description: "5 rapid cuts with transitions",
    icon: <Clock className="w-3.5 h-3.5" />,
    duration: 10,
    clips: [
      { type: "video", start: 0, end: 2, trimStart: 0, trimEnd: 0, name: "Shot 1", fadeIn: 0.2, fadeOut: 0.2 },
      { type: "video", start: 2, end: 4, trimStart: 0, trimEnd: 0, name: "Shot 2", fadeIn: 0.2, fadeOut: 0.2 },
      { type: "video", start: 4, end: 6, trimStart: 0, trimEnd: 0, name: "Shot 3", fadeIn: 0.2, fadeOut: 0.2 },
      { type: "video", start: 6, end: 8, trimStart: 0, trimEnd: 0, name: "Shot 4", fadeIn: 0.2, fadeOut: 0.2 },
      { type: "video", start: 8, end: 10, trimStart: 0, trimEnd: 0, name: "Shot 5", fadeIn: 0.2, fadeOut: 0.2 },
    ],
  },
];

const TEXT_TEMPLATES: TextTemplate[] = [
  { id: "lower-third", name: "Lower Third", preview: "Speaker Name", duration: 4, style: { fontSize: 24, fontFamily: "sans-serif", color: "#ffffff", backgroundColor: "#000000", position: "bottom" } },
  { id: "title-card", name: "Title Card", preview: "TITLE", duration: 3, style: { fontSize: 56, fontFamily: "Impact, sans-serif", color: "#ffffff", position: "center" } },
  { id: "subtitle", name: "Subtitle", preview: "Subtitle text here", duration: 5, style: { fontSize: 20, fontFamily: "sans-serif", color: "#ffffff", backgroundColor: "#000000", position: "bottom" } },
  { id: "caption-bold", name: "Bold Caption", preview: "BOLD TEXT", duration: 3, style: { fontSize: 44, fontFamily: "'Arial Black', sans-serif", color: "#fbbf24", position: "center" } },
  { id: "minimal-label", name: "Minimal Label", preview: "label", duration: 4, style: { fontSize: 16, fontFamily: "monospace", color: "#a1a1aa", position: "top" } },
  { id: "quote", name: "Quote", preview: "Inspirational quote", duration: 5, style: { fontSize: 28, fontFamily: "Georgia, serif", color: "#e2e8f0", position: "center" } },
  { id: "chapter-marker", name: "Chapter Marker", preview: "Chapter 1", duration: 3, style: { fontSize: 32, fontFamily: "serif", color: "#ffffff", position: "top" } },
  { id: "cta-banner", name: "CTA Banner", preview: "Subscribe Now!", duration: 4, style: { fontSize: 30, fontFamily: "sans-serif", color: "#000000", backgroundColor: "#fbbf24", position: "bottom" } },
];

const STYLE_PRESETS: StylePreset[] = [
  { id: "slow-mo", name: "Slow Motion", description: "0.5× speed with fade", icon: <Gauge className="w-3.5 h-3.5" />, updates: { speed: 0.5, fadeIn: 0.5, fadeOut: 0.5 } },
  { id: "speed-ramp", name: "Speed Ramp", description: "1.5× fast paced", icon: <Zap className="w-3.5 h-3.5" />, updates: { speed: 1.5 } },
  { id: "dramatic-intro", name: "Dramatic Intro", description: "Slow fade in, full volume", icon: <Sun className="w-3.5 h-3.5" />, updates: { fadeIn: 2, fadeOut: 0, volume: 1, opacity: 1 } },
  { id: "fade-out-end", name: "Fade Out Ending", description: "Gentle fade to black", icon: <Moon className="w-3.5 h-3.5" />, updates: { fadeOut: 2, opacity: 1 } },
  { id: "ghost-overlay", name: "Ghost Overlay", description: "50% opacity overlay", icon: <Palette className="w-3.5 h-3.5" />, updates: { opacity: 0.5 } },
  { id: "silent-clip", name: "Silent Clip", description: "Muted with cross-fade", icon: <MessageSquare className="w-3.5 h-3.5" />, updates: { volume: 0, fadeIn: 0.3, fadeOut: 0.3 } },
  { id: "punchy-cut", name: "Punchy Cut", description: "No fades, full speed", icon: <Zap className="w-3.5 h-3.5" />, updates: { speed: 1, fadeIn: 0, fadeOut: 0, volume: 1, opacity: 1 } },
  { id: "cinematic-look", name: "Cinematic Look", description: "Slight slow-mo + fade", icon: <Clapperboard className="w-3.5 h-3.5" />, updates: { speed: 0.85, fadeIn: 1, fadeOut: 1, opacity: 0.95 } },
];

type TemplateCategory = "video" | "text" | "style";

const TABS: { key: TemplateCategory; label: string; icon: React.ReactNode }[] = [
  { key: "video", label: "Layouts", icon: <Film className="w-3 h-3" /> },
  { key: "text", label: "Text", icon: <Type className="w-3 h-3" /> },
  { key: "style", label: "Styles", icon: <Sparkles className="w-3 h-3" /> },
];

export const TemplatesPanel = memo(function TemplatesPanel() {
  const [activeTab, setActiveTab] = useState<TemplateCategory>("video");
  const { state, dispatch } = useCustomTimeline();

  const applyVideoTemplate = useCallback((template: VideoTemplate) => {
    // Add text clips to a text track, video clips as placeholders
    template.clips.forEach((clipData) => {
      const trackType = clipData.type === "text" ? "text" : "video";
      let targetTrack = state.tracks.find((t) => t.type === trackType);

      if (!targetTrack) {
        const trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        dispatch({
          type: "ADD_TRACK",
          track: {
            id: trackId,
            type: trackType,
            label: trackType === "text" ? "Text" : "Video",
            clips: [],
          },
        });
        targetTrack = { id: trackId, type: trackType, label: trackType === "text" ? "Text" : "Video", clips: [] };
      }

      const clip: TimelineClip = {
        ...clipData,
        id: generateClipId(),
      };

      dispatch({ type: "ADD_CLIP", trackId: targetTrack.id, clip });
    });

    toast.success(`Applied "${template.name}" template`);
  }, [state.tracks, dispatch]);

  const applyTextTemplate = useCallback((template: TextTemplate) => {
    let textTrack = state.tracks.find((t) => t.type === "text");

    if (!textTrack) {
      const trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      dispatch({
        type: "ADD_TRACK",
        track: { id: trackId, type: "text", label: "Text", clips: [] },
      });
      textTrack = { id: trackId, type: "text", label: "Text", clips: [] };
    }

    const startTime = state.playheadTime;
    const clip: TimelineClip = {
      id: generateClipId(),
      type: "text",
      text: template.preview,
      start: startTime,
      end: startTime + template.duration,
      trimStart: 0,
      trimEnd: 0,
      name: template.name,
      textStyle: { ...template.style },
    };

    dispatch({ type: "ADD_CLIP", trackId: textTrack.id, clip });
    toast.success(`Added "${template.name}" at ${startTime.toFixed(1)}s`);
  }, [state.tracks, state.playheadTime, dispatch]);

  const applyStylePreset = useCallback((preset: StylePreset) => {
    if (!state.selectedClipId || !state.selectedTrackId) {
      toast.error("Select a clip first to apply a style preset");
      return;
    }
    dispatch({
      type: "UPDATE_CLIP",
      trackId: state.selectedTrackId,
      clipId: state.selectedClipId,
      updates: preset.updates,
    });
    toast.success(`Applied "${preset.name}" style`);
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b"
        style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
              activeTab === tab.key
                ? "bg-foreground/10 text-foreground/90"
                : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/[0.04]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5">
          {activeTab === "video" && VIDEO_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyVideoTemplate(t)}
              className="w-full text-left p-2.5 rounded-lg border transition-all hover:border-foreground/15 hover:bg-foreground/[0.04] group"
              style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
            >
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-foreground/[0.06] text-muted-foreground/50 group-hover:text-foreground/70 transition-colors">
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                      {t.name}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                  </div>
                  <p className="text-[9px] text-muted-foreground/35 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[8px] font-mono text-muted-foreground/30 bg-foreground/[0.04] px-1.5 py-0.5 rounded">
                      {t.duration}s
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/30 bg-foreground/[0.04] px-1.5 py-0.5 rounded">
                      {t.clips.length} clips
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {activeTab === "text" && TEXT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTextTemplate(t)}
              className="w-full text-left p-2.5 rounded-lg border transition-all hover:border-foreground/15 hover:bg-foreground/[0.04] group"
              style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-full max-w-[140px] h-10 rounded flex items-center justify-center shrink-0 overflow-hidden"
                  style={{
                    background: t.style.backgroundColor || "hsla(0, 0%, 100%, 0.04)",
                    border: "1px solid hsla(0, 0%, 100%, 0.08)",
                  }}
                >
                  <span
                    className="truncate px-1"
                    style={{
                      fontFamily: t.style.fontFamily,
                      fontSize: `${Math.min(t.style.fontSize * 0.35, 14)}px`,
                      color: t.style.color,
                      fontWeight: t.style.fontFamily.includes("Impact") || t.style.fontFamily.includes("Arial Black") ? 900 : 500,
                    }}
                  >
                    {t.preview}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-foreground/75 block truncate">
                    {t.name}
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground/30">
                    {t.duration}s
                  </span>
                </div>
              </div>
            </button>
          ))}

          {activeTab === "style" && (
            <>
              {!state.selectedClipId && (
                <div className="px-2 py-3 text-center">
                  <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
                    Select a clip to apply style presets
                  </p>
                </div>
              )}
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyStylePreset(p)}
                  disabled={!state.selectedClipId}
                  className={cn(
                    "w-full text-left p-2 rounded-lg border transition-all group",
                    state.selectedClipId
                      ? "hover:border-foreground/15 hover:bg-foreground/[0.04]"
                      : "opacity-40 cursor-not-allowed"
                  )}
                  style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-foreground/[0.06] text-muted-foreground/50 group-hover:text-foreground/70 transition-colors">
                      {p.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-foreground/75 block">
                        {p.name}
                      </span>
                      <span className="text-[8px] text-muted-foreground/30">
                        {p.description}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

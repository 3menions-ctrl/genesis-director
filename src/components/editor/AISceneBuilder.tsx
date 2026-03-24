/**
 * AISceneBuilder — Generate, extend, and remix clips with AI
 * Inline AI-powered scene creation directly from the editor
 */

import { memo, useState, useCallback } from "react";
import {
  Sparkles, Wand2, RefreshCw, Plus, Film, Loader2,
  ArrowRight, Expand, Scissors, Layers, Zap, Clock,
  Image, MessageSquare
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomTimeline, generateClipId, TimelineClip } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ─── AI Action Types ───

interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresClip: boolean;
  color: string;
}

const AI_ACTIONS: AIAction[] = [
  {
    id: "generate-scene",
    name: "Generate Scene",
    description: "Create a new video clip from a text prompt",
    icon: <Sparkles className="w-4 h-4" />,
    requiresClip: false,
    color: "hsla(265, 80%, 60%, 0.15)",
  },
  {
    id: "extend-clip",
    name: "Extend Clip",
    description: "AI continues the selected clip seamlessly",
    icon: <Expand className="w-4 h-4" />,
    requiresClip: true,
    color: "hsla(215, 80%, 55%, 0.15)",
  },
  {
    id: "remix-scene",
    name: "Remix Scene",
    description: "Re-imagine the clip with a different style",
    icon: <RefreshCw className="w-4 h-4" />,
    requiresClip: true,
    color: "hsla(340, 75%, 55%, 0.15)",
  },
  {
    id: "generate-broll",
    name: "Generate B-Roll",
    description: "Auto-create supplementary footage",
    icon: <Film className="w-4 h-4" />,
    requiresClip: false,
    color: "hsla(160, 70%, 45%, 0.15)",
  },
];

// ─── Scene Templates ───

interface SceneTemplate {
  id: string;
  name: string;
  prompt: string;
  duration: number;
  icon: React.ReactNode;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: "action-chase", name: "Action Chase", prompt: "Intense car chase through neon-lit city streets at night, cinematic camera angles, explosions in background", duration: 6, icon: <Zap className="w-3.5 h-3.5" /> },
  { id: "dialogue-scene", name: "Dialogue Scene", prompt: "Two characters having an intense conversation in a dimly lit room, close-up shots", duration: 8, icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: "establishing-shot", name: "Establishing Shot", prompt: "Sweeping aerial shot of a futuristic cityscape at sunset, volumetric clouds", duration: 5, icon: <Image className="w-3.5 h-3.5" /> },
  { id: "transition-shot", name: "Transition Shot", prompt: "Abstract motion graphics transition with particle effects", duration: 3, icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "montage", name: "Quick Montage", prompt: "Rapid montage of preparation scenes, training sequence, getting ready", duration: 6, icon: <Clock className="w-3.5 h-3.5" /> },
];

export const AISceneBuilder = memo(function AISceneBuilder() {
  const { state, dispatch } = useCustomTimeline();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("generate-scene");
  const [generationProgress, setGenerationProgress] = useState(0);

  const hasSelection = !!state.selectedClipId && !!state.selectedTrackId;

  const handleGenerate = useCallback(async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) {
      toast.error("Enter a scene description");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate progress for now — in production this calls the AI generation edge function
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      // For now, create a placeholder clip to demonstrate the workflow
      // In production, this would call the video generation API
      toast.info("AI Scene Builder: Generating scene...");

      // Simulate generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add placeholder clip to timeline
      let videoTrack = state.tracks.find(t => t.type === "video");
      if (!videoTrack) {
        const trackId = `track-${Date.now()}`;
        dispatch({
          type: "ADD_TRACK",
          track: { id: trackId, type: "video", label: "Video 1", clips: [] },
        });
        videoTrack = { id: trackId, type: "video" as const, label: "Video 1", clips: [] };
      }

      const lastEnd = videoTrack.clips.length > 0
        ? Math.max(...videoTrack.clips.map(c => c.end))
        : 0;

      const duration = 6;
      const newClip: TimelineClip = {
        id: generateClipId(),
        type: "video",
        start: lastEnd,
        end: lastEnd + duration,
        trimStart: 0,
        trimEnd: duration,
        name: `AI: ${finalPrompt.slice(0, 30)}...`,
      };

      dispatch({ type: "ADD_CLIP", trackId: videoTrack.id, clip: newClip });
      setGenerationProgress(100);
      toast.success("Scene added to timeline — generate video from your projects page");
      setPrompt("");
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Generation failed. Please try again.");
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [prompt, state.tracks, dispatch]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsla(265, 80%, 60%, 0.2), hsla(215, 80%, 55%, 0.1))" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[hsl(265,80%,65%)]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[hsl(0,0%,85%)] block leading-none">AI Scene Builder</span>
              <span className="text-[9px] text-[hsl(0,0%,45%)]">Generate & remix with AI</span>
            </div>
          </div>

          {/* Action selector */}
          <div className="grid grid-cols-2 gap-1.5">
            {AI_ACTIONS.map((action) => {
              const disabled = action.requiresClip && !hasSelection;
              return (
                <button
                  key={action.id}
                  onClick={() => !disabled && setSelectedAction(action.id)}
                  disabled={disabled}
                  className={cn(
                    "text-left p-2.5 rounded-xl border transition-all",
                    selectedAction === action.id
                      ? "border-[hsla(215,80%,60%,0.4)] bg-[hsla(215,80%,60%,0.08)]"
                      : disabled
                      ? "opacity-25 cursor-not-allowed border-transparent"
                      : "border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(215,80%,60%,0.2)]"
                  )}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5"
                    style={{ background: action.color }}
                  >
                    <span className="text-[hsl(0,0%,80%)]">{action.icon}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[hsl(0,0%,80%)] block leading-tight">{action.name}</span>
                  <span className="text-[8px] text-[hsl(0,0%,42%)] leading-tight block mt-0.5">{action.description}</span>
                </button>
              );
            })}
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                selectedAction === "extend-clip" ? "Describe how to continue the scene..."
                : selectedAction === "remix-scene" ? "Describe the new style or mood..."
                : "Describe the scene you want to create..."
              }
              className="w-full h-20 text-[11px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(215,80%,60%,0.4)] transition-colors"
            />

            {/* Generate button */}
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !prompt.trim()}
              className={cn(
                "w-full h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all",
                isGenerating
                  ? "bg-[hsla(265,80%,60%,0.15)] text-[hsl(265,80%,65%)] cursor-wait"
                  : prompt.trim()
                  ? "bg-[hsl(215,100%,50%)] text-white hover:bg-[hsl(215,100%,55%)] active:scale-[0.98] shadow-lg shadow-[hsla(215,100%,50%,0.25)]"
                  : "bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,40%)] cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating... {Math.round(generationProgress)}%
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate Scene
                </>
              )}
            </button>

            {/* Generation progress */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="h-1 rounded-full bg-[hsla(0,0%,100%,0.06)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, hsl(265, 80%, 60%), hsl(215, 100%, 50%))" }}
                      animate={{ width: `${generationProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick scene templates */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Quick Templates</p>
            {SCENE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setPrompt(template.prompt);
                  setSelectedAction("generate-scene");
                }}
                className="w-full text-left p-2.5 rounded-xl border border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(215,80%,60%,0.2)] hover:bg-[hsla(0,0%,100%,0.02)] transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,55%)] group-hover:text-[hsl(215,80%,60%)] transition-colors">
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-[hsl(0,0%,80%)] block">{template.name}</span>
                    <span className="text-[8px] text-[hsl(0,0%,42%)] line-clamp-1">{template.prompt}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[8px] font-mono text-[hsl(0,0%,40%)] bg-[hsla(0,0%,100%,0.05)] px-1.5 py-0.5 rounded">
                      {template.duration}s
                    </span>
                    <ArrowRight className="w-3 h-3 text-[hsl(0,0%,30%)] group-hover:text-[hsl(215,80%,60%)] transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});

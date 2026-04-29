/**
 * AISceneBuilder — Generate real video clips via Kling V3, extend, and remix
 * Connects to editor-ai-scene for prompt enhancement + editor-generate-clip for actual generation
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles, Wand2, RefreshCw, Film, Loader2,
  ArrowRight, Expand, Zap, Clock,
  Image, MessageSquare, CheckCircle2, AlertTriangle, Layers
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomTimeline, generateClipId, generateTrackId, TimelineClip } from "@/hooks/useCustomTimeline";
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
    description: "Create a real video clip from text",
    icon: <Sparkles className="w-4 h-4" />,
    requiresClip: false,
    color: "hsla(215, 80%, 55%, 0.15)",
  },
  {
    id: "extend-clip",
    name: "Continue Story",
    description: "Extend using last frame for continuity",
    icon: <Expand className="w-4 h-4" />,
    requiresClip: true,
    color: "hsla(160, 70%, 45%, 0.15)",
  },
  {
    id: "remix-scene",
    name: "Remix Scene",
    description: "Re-imagine with a different style",
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
    color: "hsla(45, 80%, 55%, 0.15)",
  },
];

// ─── Scene Templates ───

const SCENE_TEMPLATES = [
  { id: "action-chase", name: "Action Chase", prompt: "Intense car chase through neon-lit city streets at night, cinematic camera angles, explosions in background", duration: 10, icon: <Zap className="w-3.5 h-3.5" /> },
  { id: "dialogue-scene", name: "Dialogue Scene", prompt: "Two characters having an intense conversation in a dimly lit room, close-up shots", duration: 10, icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: "establishing-shot", name: "Establishing Shot", prompt: "Sweeping aerial shot of a futuristic cityscape at sunset, volumetric clouds", duration: 5, icon: <Image className="w-3.5 h-3.5" /> },
  { id: "transition-shot", name: "Transition Shot", prompt: "Smooth cinematic transition with light and shadow play", duration: 5, icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "montage", name: "Quick Montage", prompt: "Rapid montage of preparation scenes, training sequence, getting ready", duration: 10, icon: <Clock className="w-3.5 h-3.5" /> },
];

type GenState = "idle" | "enhancing" | "generating" | "polling" | "completed" | "failed";

export const AISceneBuilder = memo(function AISceneBuilder() {
  const { state, dispatch } = useCustomTimeline();
  const [prompt, setPrompt] = useState("");
  const [genState, setGenState] = useState<GenState>("idle");
  const [selectedAction, setSelectedAction] = useState<string>("generate-scene");
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [duration, setDuration] = useState(10);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionIdRef = useRef<string | null>(null);

  const hasSelection = !!state.selectedClipId && !!state.selectedTrackId;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const getSelectedClipContext = useCallback(() => {
    if (!state.selectedClipId || !state.selectedTrackId) return null;
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const clip = track?.clips.find(c => c.id === state.selectedClipId);
    if (!clip) return null;
    return {
      name: clip.name,
      type: clip.type,
      duration: clip.end - clip.start,
      text: clip.text,
      src: clip.src,
      thumbnail: clip.thumbnail,
    };
  }, [state.selectedClipId, state.selectedTrackId, state.tracks]);

  const addClipToTimeline = useCallback((videoUrl: string, name: string, clipDuration: number) => {
    let videoTrack = state.tracks.find(t => t.type === "video");
    const trackId = videoTrack?.id || generateTrackId();
    
    if (!videoTrack) {
      dispatch({
        type: "ADD_TRACK",
        track: { id: trackId, type: "video", label: "Video 1", clips: [], muted: false, locked: false },
      });
    }

    const lastEnd = videoTrack?.clips.length
      ? Math.max(...videoTrack.clips.map(c => c.end))
      : 0;

    const newClip: TimelineClip = {
      id: generateClipId(),
      type: "video",
      start: lastEnd,
      end: lastEnd + clipDuration,
      trimStart: 0,
      trimEnd: clipDuration,
      name,
      src: videoUrl,
      volume: 1,
      speed: 1,
      opacity: 1,
    };

    dispatch({ type: "ADD_CLIP", trackId: videoTrack?.id || trackId, clip: newClip });
    return newClip;
  }, [state.tracks, dispatch]);

  const pollPrediction = useCallback((predictionId: string, clipName: string) => {
    setGenState("polling");
    
    pollRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("editor-generate-clip", {
          body: { action: "status", predictionId },
        });

        if (error) return;

        if (data.status === "completed" && data.videoUrl) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          
          addClipToTimeline(data.videoUrl, clipName, duration);
          setGenState("completed");
          setProgress(100);
          toast.success("Video clip generated and added to timeline!");
          setTimeout(() => {
            setGenState("idle");
            setProgress(0);
          }, 2000);
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setGenState("failed");
          toast.error(`Generation failed: ${data.error || "Unknown error"}`);
        } else {
          setProgress(Math.min(90, progress + 5));
        }
      } catch (e) {
        console.error("[AISceneBuilder] Poll error:", e);
      }
    }, 5000);
  }, [addClipToTimeline, duration, progress]);

  const handleGenerate = useCallback(async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) {
      toast.error("Enter a scene description");
      return;
    }

    setGenState("enhancing");
    setProgress(5);
    setLastResult(null);

    try {
      // Step 1: Enhance prompt with AI
      const clipContext = getSelectedClipContext();
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("editor-ai-scene", {
        body: {
          prompt: finalPrompt,
          action: selectedAction,
          clipContext,
        },
      });

      if (aiError) throw new Error(aiError.message || "AI enhancement failed");

      setLastResult(aiResult);
      setProgress(20);
      
      const enhancedPrompt = aiResult?.enhancedPrompt || finalPrompt;
      const suggestedDuration = aiResult?.suggestedDuration || duration;
      const clipName = aiResult?.mood
        ? `AI: ${aiResult.mood} — ${finalPrompt.slice(0, 20)}…`
        : `AI: ${finalPrompt.slice(0, 30)}…`;

      // Step 2: Submit to Kling V3 via editor-generate-clip
      setGenState("generating");
      setProgress(30);

      const startImageUrl = (selectedAction === "extend-clip" || selectedAction === "remix-scene")
        ? clipContext?.thumbnail || clipContext?.src
        : undefined;

      const { data: genResult, error: genError } = await supabase.functions.invoke("editor-generate-clip", {
        body: {
          action: "submit",
          prompt: enhancedPrompt,
          duration: suggestedDuration,
          startImageUrl,
          aspectRatio: state.aspectRatio === "9:16" ? "9:16" : state.aspectRatio === "1:1" ? "1:1" : "16:9",
        },
      });

      if (genError) throw new Error(genError.message || "Generation failed");
      if (!genResult?.success) throw new Error(genResult?.error || "Failed to start generation");

      predictionIdRef.current = genResult.predictionId;
      setProgress(40);
      toast.info(`Generating ${suggestedDuration}s clip… (${genResult.creditsCharged} credits charged)`);

      // Step 3: Poll for completion
      pollPrediction(genResult.predictionId, clipName);
      setPrompt("");

    } catch (error: any) {
      console.error("AI generation error:", error);
      setGenState("failed");
      if (error?.message?.includes("Insufficient credits")) {
        toast.error("Not enough credits. Buy more to continue generating.");
      } else if (error?.message?.includes("Rate limit")) {
        toast.error("Rate limit reached — please wait a moment.");
      } else {
        toast.error(error?.message || "Generation failed. Please try again.");
      }
    }
  }, [prompt, state.aspectRatio, selectedAction, getSelectedClipContext, duration, pollPrediction]);

  const isWorking = genState !== "idle" && genState !== "completed" && genState !== "failed";

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsla(215, 80%, 55%, 0.2), hsla(160, 70%, 45%, 0.1))" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[hsl(215,80%,65%)]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[hsl(0,0%,85%)] block leading-none">AI Scene Generator</span>
              <span className="text-[9px] text-[hsl(0,0%,45%)]">Kling V3 · Real video generation</span>
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
                  disabled={disabled || isWorking}
                  className={cn(
                    "text-left p-2.5 rounded-xl border transition-all",
                    selectedAction === action.id
                      ? "border-[hsla(215,80%,60%,0.4)] bg-[hsla(215,80%,60%,0.08)]"
                      : disabled
                      ? "opacity-25 cursor-not-allowed border-transparent"
                      : "border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(215,80%,60%,0.2)]"
                  )}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5" style={{ background: action.color }}>
                    <span className="text-[hsl(0,0%,80%)]">{action.icon}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[hsl(0,0%,80%)] block leading-tight">{action.name}</span>
                  <span className="text-[8px] text-[hsl(0,0%,42%)] leading-tight block mt-0.5">{action.description}</span>
                </button>
              );
            })}
          </div>

          {/* Duration selector */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Duration</span>
            <div className="flex gap-1 flex-1">
              {[5, 10, 15].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  disabled={isWorking}
                  className={cn(
                    "flex-1 h-7 rounded-lg text-[10px] font-bold transition-all",
                    duration === d
                      ? "bg-[hsl(215,100%,50%)] text-white"
                      : "bg-[hsla(0,0%,100%,0.04)] text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,70%)]"
                  )}
                >
                  {d}s
                </button>
              ))}
            </div>
            <span className="text-[8px] text-[hsl(0,0%,40%)]">
              {duration > 10 ? "75" : "50"} credits
            </span>
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isWorking}
              placeholder={
                selectedAction === "extend-clip" ? "Describe how to continue the scene..."
                : selectedAction === "remix-scene" ? "Describe the new style or mood..."
                : "Describe the scene you want to create..."
              }
              className="w-full h-20 text-[11px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2.5 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(215,80%,60%,0.4)] transition-colors disabled:opacity-40"
            />

            {/* Generate button */}
            <button
              onClick={() => handleGenerate()}
              disabled={isWorking || !prompt.trim()}
              className={cn(
                "w-full h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all",
                isWorking
                  ? "bg-[hsla(215,80%,55%,0.15)] text-[hsl(215,80%,65%)] cursor-wait"
                  : prompt.trim()
                  ? "bg-[hsl(215,100%,50%)] text-white hover:bg-[hsl(215,100%,55%)] active:scale-[0.98] shadow-lg shadow-[hsla(215,100%,50%,0.25)]"
                  : "bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,40%)] cursor-not-allowed"
              )}
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {genState === "enhancing" && "Enhancing prompt…"}
                  {genState === "generating" && "Submitting to Kling V3…"}
                  {genState === "polling" && `Generating video… ${Math.round(progress)}%`}
                </>
              ) : genState === "failed" ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Retry Generation
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate Video Clip
                </>
              )}
            </button>

            {/* Progress bar */}
            <AnimatePresence>
              {isWorking && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="h-1.5 rounded-full bg-[hsla(0,0%,100%,0.06)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, hsl(215, 100%, 50%), hsl(160, 70%, 50%))" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-[8px] text-[hsl(0,0%,40%)] mt-1">
                    {genState === "polling" && "Video generation typically takes 60-120 seconds"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI Result Preview */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl p-3 space-y-2"
                style={{
                  background: "linear-gradient(135deg, hsla(215,100%,55%,0.06) 0%, hsla(215,100%,55%,0.015) 100%)",
                  boxShadow: "inset 0 1px 0 hsla(215,100%,80%,0.08), inset 0 0 0 1px hsla(215,100%,55%,0.14)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
                  <span className="text-[9px] font-light tracking-[0.18em] uppercase text-[hsl(215,100%,75%)]">
                    {genState === "completed" ? "Clip Added to Timeline" : "Prompt Enhanced"}
                  </span>
                </div>
                {lastResult.enhancedPrompt && (
                  <p className="text-[9px] text-[hsl(0,0%,60%)] leading-relaxed line-clamp-3">
                    {lastResult.enhancedPrompt}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {lastResult.mood && (
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,50%)]">
                      {lastResult.mood}
                    </span>
                  )}
                  {lastResult.cameraWork && (
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,50%)]">
                      📷 {lastResult.cameraWork}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick scene templates */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold text-[hsl(0,0%,50%)] uppercase tracking-wider">Quick Templates</p>
            {SCENE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setPrompt(template.prompt);
                  setDuration(template.duration);
                  setSelectedAction("generate-scene");
                }}
                disabled={isWorking}
                className="w-full text-left p-2.5 rounded-xl border border-[hsla(0,0%,100%,0.05)] hover:border-[hsla(215,80%,60%,0.2)] hover:bg-[hsla(0,0%,100%,0.02)] transition-all group active:scale-[0.98] disabled:opacity-40"
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

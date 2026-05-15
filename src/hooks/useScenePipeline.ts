import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SceneDraft, StudioDraft } from "@/components/studio/v2/types";
import { engineToBackend, getQualityProfile, creditsForScene, ENGINES } from "@/lib/video/engines";

/**
 * Per-scene generate / poll. Server-side does the actual credit deduction
 * via the existing edge functions (generate-single-clip → poll-replicate-prediction).
 */
export function useScenePipeline(
  draft: StudioDraft,
  patchScene: (id: string, patch: Partial<SceneDraft>) => void,
  ensureProjectId: () => Promise<string>,
) {
  const polling = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const stopPoll = (id: string) => {
    const t = polling.current.get(id);
    if (t) {
      clearInterval(t);
      polling.current.delete(id);
    }
  };

  const pollPrediction = useCallback((sceneId: string, predictionId: string) => {
    stopPoll(sceneId);
    const t = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("poll-replicate-prediction", {
          body: { predictionId },
        });
        if (error) return;
        const status = (data as any)?.status;
        const url = (data as any)?.output?.video || (data as any)?.output;
        if (status === "succeeded" && url) {
          patchScene(sceneId, { status: "done", clipUrl: typeof url === "string" ? url : url[0] });
          stopPoll(sceneId);
        } else if (status === "failed" || status === "canceled") {
          patchScene(sceneId, { status: "failed" });
          toast.error("Generation failed");
          stopPoll(sceneId);
        }
      } catch {
        // keep polling until the backend reports a terminal state
      }
    }, 5000);
    polling.current.set(sceneId, t);
  }, [patchScene]);

  const generateSceneFromDraft = useCallback(async (sceneId: string, sourceDraft: StudioDraft = draft) => {
    const scene = sourceDraft.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    if (!scene.beat && !scene.dialogue && !sourceDraft.brief.logline) {
      toast.error("Add a brief, beat, or dialogue first");
      return;
    }

    patchScene(sceneId, { status: "queued" });
    try {
      // ── Ensure backend project exists (engine lock, mutex, credits) ──
      const projectId = await ensureProjectId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to render");

      const cast = scene.speakerId ? sourceDraft.cast.find(c => c.id === scene.speakerId) : sourceDraft.cast[0];
      const engineId = scene.engine || sourceDraft.defaults.engine;
      const engineSpec = ENGINES[engineId];
      const backendEngine = engineToBackend(engineId);
      const profile = getQualityProfile(engineId, sourceDraft.defaults.qualityProfileId);
      const isAvatarMode = !!cast?.imageUrl;

      const promptParts = [
        scene.location,
        scene.beat || sourceDraft.brief.logline,
        sourceDraft.brief.style ? `Style: ${sourceDraft.brief.style}` : "",
        sourceDraft.brief.styleModifier ? sourceDraft.brief.styleModifier : "",
        scene.dialogue ? `Dialogue: "${scene.dialogue}"` : "",
      ].filter(Boolean);

      const { data, error } = await supabase.functions.invoke("generate-single-clip", {
        body: {
          projectId,
          userId: user.id,
          shotIndex: scene.index,
          totalClips: sourceDraft.scenes.length,
          prompt: promptParts.join(". "),
          dialogue: scene.dialogue,
          durationSeconds: scene.duration,
          aspectRatio: sourceDraft.defaults.aspect,
          videoEngine: backendEngine,
          isAvatarMode,
          qualityOptions: profile.options,
          qualityProfileId: profile.id,
          estimatedCredits: (() => { try { return creditsForScene(engineId, scene.duration, profile.id); } catch { return engineSpec.baseCreditsFor(engineSpec.durations[0]); } })(),
          startImageUrl: scene.refImageUrl || sourceDraft.brief.refImageUrl || cast?.imageUrl,
          voiceId: cast?.voiceId || sourceDraft.defaults.voiceId,
          characterName: cast?.name,
          lens: scene.lens,
          cameraMove: scene.move,
          mode: isAvatarMode ? "avatar" : sourceDraft.brief.refImageUrl ? "image-to-video" : "text-to-video",
          source: "studio-v2",
        },
      });
      if (error) throw error;
      const predictionId = (data as any)?.predictionId || (data as any)?.id;
      const directUrl = (data as any)?.videoUrl;
      if (directUrl) {
        patchScene(sceneId, { status: "done", clipUrl: directUrl });
      } else if (predictionId) {
        patchScene(sceneId, { status: "generating", predictionId });
        pollPrediction(sceneId, predictionId);
      } else {
        patchScene(sceneId, { status: "generating" });
      }
    } catch (e: any) {
      patchScene(sceneId, { status: "failed" });
      toast.error(e?.message || "Failed to start generation");
    }
  }, [draft, patchScene, pollPrediction, ensureProjectId]);

  const generateScene = useCallback((sceneId: string) => generateSceneFromDraft(sceneId, draft), [draft, generateSceneFromDraft]);

  return { generateScene, generateSceneFromDraft };
}

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

  /**
   * Poll the `video_clips` row directly. Used when the server parks a
   * chained scene in the queue — we lose the predictionId hand-off, so we
   * watch the row's status/video_url instead. The drain step on the
   * predecessor's completion re-fires the parked request, which writes its
   * predictionId + eventual video_url into the same row.
   */
  const pollClipRow = useCallback((sceneId: string, projectId: string, shotIndex: number) => {
    stopPoll(sceneId);
    const t = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("video_clips")
          .select("status, video_url, error_message")
          .eq("project_id", projectId)
          .eq("shot_index", shotIndex)
          .maybeSingle();
        if (error) return;
        const status = (data as any)?.status;
        const url = (data as any)?.video_url;
        if (status === "completed" && url) {
          patchScene(sceneId, { status: "done", clipUrl: url });
          stopPoll(sceneId);
        } else if (status === "failed") {
          patchScene(sceneId, { status: "failed" });
          toast.error((data as any)?.error_message || "Generation failed");
          stopPoll(sceneId);
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
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
      const cast = scene.speakerId ? sourceDraft.cast.find(c => c.id === scene.speakerId) : sourceDraft.cast[0];
      const engineId = scene.engine || sourceDraft.defaults.engine;
      const engineSpec = ENGINES[engineId];
      const backendEngine = engineToBackend(engineId);
      const profile = getQualityProfile(engineId, sourceDraft.defaults.qualityProfileId);
      const isAvatarMode = !!cast?.imageUrl;
      // Continuity: independent scenes (chainFromPrevious === false) break the
      // frame + identity chain. We omit the brief-level reference image so the
      // renderer can't silently inherit the prior environment, and we signal
      // the backend to disable last-frame/identity carry-over.
      const chainFromPrevious = scene.chainFromPrevious !== false;

      // ── Ensure backend project exists, then hard-sync its engine lock to
      // the actual scene being rendered. The renderer intentionally trusts
      // movie_projects.video_engine to prevent stale fallback loops, so this
      // prevents avatar Seedance/Runway/Veo/Sora choices from reverting to Kling.
      const projectId = await ensureProjectId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to render");
      const { error: lockError } = await supabase
        .from("movie_projects")
        .update({
          video_engine: backendEngine,
          engine: engineId,
          mode: isAvatarMode ? "avatar" : sourceDraft.brief.refImageUrl ? "image-to-video" : "text-to-video",
          aspect_ratio: sourceDraft.defaults.aspect,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (lockError) throw new Error(`Could not lock render to ${engineId}`);

      // ── Reserve credits server-side BEFORE invoking the renderer. The
      // reservation reduces the user's effective balance for any concurrent
      // render (other tab, other scene), eliminating pre-flight drift.
      let holdId: string | null = null;
      try {
        const estimated = creditsForScene(engineId, scene.duration, profile.id);
        const { data: hold, error: holdErr } = await supabase.functions.invoke("reserve-credits", {
          body: {
            action: "reserve",
            amount: estimated,
            projectId,
            description: `Scene ${scene.index + 1} (${engineId})`,
            idempotencyKey: `scene:${projectId}:${scene.index}:${Date.now()}`,
            ttlSeconds: 900,
          },
        });
        if (holdErr || (hold as any)?.success !== true) {
          const reserved = (hold as any)?.reserved ?? 0;
          const balance = (hold as any)?.balance ?? 0;
          const eff = (hold as any)?.effectiveBalance ?? balance - reserved;
          patchScene(sceneId, { status: "failed" });
          toast.error(`Insufficient credits — ${estimated} required, ${eff} available`);
          return;
        }
        holdId = (hold as any).holdId as string;
      } catch (e) {
        patchScene(sceneId, { status: "failed" });
        toast.error("Could not reserve credits");
        return;
      }

      const promptParts = [
        scene.location,
        scene.beat || sourceDraft.brief.logline,
        sourceDraft.brief.style ? `Style: ${sourceDraft.brief.style}` : "",
        sourceDraft.brief.styleModifier ? sourceDraft.brief.styleModifier : "",
        scene.dialogue ? `Dialogue: "${scene.dialogue}"` : "",
        chainFromPrevious ? "" : "Standalone shot — fresh scene, do not inherit prior frame, character, or environment.",
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
          holdId,
          startImageUrl: chainFromPrevious
            ? (scene.refImageUrl || sourceDraft.brief.refImageUrl || cast?.imageUrl)
            : (scene.refImageUrl || cast?.imageUrl),
          chainFromPrevious,
          independentScene: !chainFromPrevious,
          voiceId: cast?.voiceId || sourceDraft.defaults.voiceId,
          characterName: cast?.name,
          lens: scene.lens,
          cameraMove: scene.move,
          mode: isAvatarMode ? "avatar" : sourceDraft.brief.refImageUrl ? "image-to-video" : "text-to-video",
          source: "studio-v2",
        },
      });
      if (error) {
        // Renderer errored before consume_credit_hold ran — release the hold
        // so the user isn't billed.
        if (holdId) {
          await supabase.functions.invoke("reserve-credits", {
            body: { action: "release", holdId, reason: "invoke_error" },
          }).catch(() => {});
        }
        throw error;
      }
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

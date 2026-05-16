import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SceneDraft, StudioDraft } from "@/components/studio/v2/types";
import { engineToBackend, getQualityProfile, creditsForScene, ENGINES } from "@/lib/video/engines";
import { extractAndUploadTailFrame } from "@/lib/video/extractTailFrame";

/**
 * Per-scene generate / poll. Server-side does the actual credit deduction
 * via the existing edge functions (generate-single-clip → poll-replicate-prediction).
 */
export function useScenePipeline(
  draft: StudioDraft,
  patchScene: (id: string, patch: Partial<SceneDraft>) => void,
  ensureProjectId: () => Promise<string>,
  getLatestDraft?: () => StudioDraft,
) {
  const polling = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Tracks scenes parked client-side waiting on a predecessor. Keyed by
  // sceneId so we can cancel the watcher if the user manually retries /
  // edits / removes the scene.
  const gateWatchers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const stopGate = (id: string) => {
    const t = gateWatchers.current.get(id);
    if (t) {
      clearInterval(t);
      gateWatchers.current.delete(id);
    }
  };

  const stopPoll = (id: string) => {
    const t = polling.current.get(id);
    if (t) {
      clearInterval(t);
      polling.current.delete(id);
    }
  };

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
          patchScene(sceneId, { status: "done", clipUrl: url, errorReason: undefined });
          stopPoll(sceneId);
        } else if (status === "failed") {
          const reason = (data as any)?.error_message || "Generation failed";
          patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
          toast.error(String(reason).slice(0, 200));
          stopPoll(sceneId);
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
    polling.current.set(sceneId, t);
  }, [patchScene]);

  const pollPrediction = useCallback((
    sceneId: string,
    predictionId: string,
    projectId: string,
    shotIndex: number,
    totalClips: number,
  ) => {
    stopPoll(sceneId);
    const t = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("poll-replicate-prediction", {
          body: { predictionId, projectId, shotIndex, totalClips },
        });
        if (error) return;
        const status = (data as any)?.status;
        const url = (data as any)?.output?.video || (data as any)?.output;
        if (status === "succeeded" && url) {
          patchScene(sceneId, { status: "done", clipUrl: typeof url === "string" ? url : url[0], errorReason: undefined });
          stopPoll(sceneId);
        } else if (status === "failed" || status === "canceled") {
          const reason = (data as any)?.error || (data as any)?.detail || `Generation ${status}`;
          patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
          toast.error(String(reason).slice(0, 200));
          stopPoll(sceneId);
        } else if ((data as any)?.alreadyCompleted) {
          // Backend confirmed clip already completed — switch to row poll to fetch URL
          stopPoll(sceneId);
          pollClipRow(sceneId, projectId, shotIndex);
        }
      } catch {
        // keep polling until the backend reports a terminal state
      }
    }, 5000);
    polling.current.set(sceneId, t);
  }, [patchScene, pollClipRow]);

  const generateSceneFromDraft = useCallback(async (sceneId: string, sourceDraft: StudioDraft = draft) => {
    const scene = sourceDraft.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    if (!scene.beat && !scene.dialogue && !sourceDraft.brief.logline) {
      const reason = "Add a brief, beat, or dialogue first";
      patchScene(sceneId, { status: "failed", errorReason: reason });
      toast.error(reason);
      return;
    }

    // ── Predecessor gate ──────────────────────────────────────────────────
    // If this scene chains from the previous one and the predecessor is not
    // yet completed, park this scene client-side and watch the predecessor.
    // The watcher resumes generation automatically the moment the prior
    // scene reaches a terminal state, inheriting its tail frame.
    const sceneIdx = sourceDraft.scenes.findIndex(s => s.id === sceneId);
    const wantsChain = scene.chainFromPrevious !== false;
    if (sceneIdx > 0 && wantsChain) {
      const predecessor = sourceDraft.scenes[sceneIdx - 1];
      const predReady = predecessor?.status === "done" && !!predecessor.clipUrl;
      if (predecessor && !predReady && predecessor.status !== "failed") {
        stopGate(sceneId);
        patchScene(sceneId, { status: "queued", waitingOnSceneId: predecessor.id });
        toast.message(`Scene ${scene.index + 1} waiting on scene ${predecessor.index + 1}`, { duration: 2500 });
        const t = setInterval(() => {
          const latest = getLatestDraft ? getLatestDraft() : sourceDraft;
          const live = latest.scenes.find(s => s.id === predecessor.id);
          if (!live) { stopGate(sceneId); return; }
          if (live.status === "failed") {
            stopGate(sceneId);
            const reason = `Skipped — scene ${predecessor.index + 1} failed (${predecessor.errorReason || "no detail"})`;
            patchScene(sceneId, { status: "failed", waitingOnSceneId: undefined, errorReason: reason });
            toast.error(`Scene ${scene.index + 1} skipped — predecessor failed`);
            return;
          }
          if (live.status === "done" && live.clipUrl) {
            stopGate(sceneId);
            patchScene(sceneId, { waitingOnSceneId: undefined });
            // Extract the predecessor's actual tail frame so the resumed
            // render anchors on a real last-frame, not the static brief ref.
            (async () => {
              try {
                const projectId = await ensureProjectId();
                const { data: { user } } = await supabase.auth.getUser();
                const tailUrl = await extractAndUploadTailFrame(live.clipUrl!, {
                  userId: user?.id || "",
                  projectId,
                  sceneIndex: scene.index,
                }).catch(() => null);
                const fresh = getLatestDraft ? getLatestDraft() : sourceDraft;
                const me = fresh.scenes.find(s => s.id === sceneId);
                if (me && tailUrl) {
                  patchScene(sceneId, { refImageUrl: tailUrl });
                }
                const resumedDraft: StudioDraft = {
                  ...fresh,
                  scenes: fresh.scenes.map(s =>
                    s.id === sceneId && tailUrl ? { ...s, refImageUrl: tailUrl } : s,
                  ),
                };
                await generateSceneFromDraft(sceneId, resumedDraft);
              } catch (err) {
                patchScene(sceneId, { status: "failed", waitingOnSceneId: undefined, errorReason: (err as any)?.message || "Resume failed after predecessor completed" });
                toast.error(`Scene ${scene.index + 1} resume failed`);
              }
            })();
          }
        }, 2000);
        gateWatchers.current.set(sceneId, t);
        return;
      }
    }

    patchScene(sceneId, { status: "queued", errorReason: undefined });
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
          const reason = `Insufficient credits — ${estimated} required, ${eff} available`;
          patchScene(sceneId, { status: "failed", errorReason: reason });
          toast.error(reason);
          return;
        }
        holdId = (hold as any).holdId as string;
      } catch (e) {
        const reason = (e as any)?.message || "Could not reserve credits";
        patchScene(sceneId, { status: "failed", errorReason: reason });
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
          // Return immediately after dispatch; poll-replicate-prediction handles
          // completion durably. Avoids the 60s edge-function timeout that was
          // surfacing "failed" in the UI even when Replicate succeeded.
          skipPolling: true,
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
      const queued = (data as any)?.queued === true;
      if (queued) {
        // Server parked us behind the predecessor. Surface the wait in the
        // UI and switch to row-polling — the drain will re-fire this scene
        // and stamp its prediction onto the same video_clips row.
        patchScene(sceneId, { status: "generating" });
        toast.message(`Scene ${scene.index + 1} queued — waiting on scene ${((data as any)?.waitingOnShot ?? scene.index - 1) + 1}`, { duration: 2500 });
        pollClipRow(sceneId, projectId, scene.index);
      } else if (directUrl) {
        patchScene(sceneId, { status: "done", clipUrl: directUrl });
      } else if (predictionId) {
        patchScene(sceneId, { status: "generating", predictionId });
        pollPrediction(sceneId, predictionId, projectId, scene.index, sourceDraft.scenes.length);
      } else {
        patchScene(sceneId, { status: "generating" });
        // Fallback: no predictionId and not queued — poll the row anyway in
        // case the renderer wrote it asynchronously (defensive).
        pollClipRow(sceneId, projectId, scene.index);
      }
    } catch (e: any) {
      const reason = e?.message || e?.error || "Failed to start generation";
      patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
      toast.error(String(reason).slice(0, 200));
    }
  }, [draft, patchScene, pollPrediction, pollClipRow, ensureProjectId]);

  const generateScene = useCallback((sceneId: string) => generateSceneFromDraft(sceneId, draft), [draft, generateSceneFromDraft]);

  return { generateScene, generateSceneFromDraft };
}

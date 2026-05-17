import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SceneDraft, SceneEvent, SceneEventKind, StudioDraft } from "@/components/studio/v2/types";
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

  // Append an event to a scene's timeline. Keeps the last 40 entries so the
  // monitor stays responsive even for long-running renders that retry.
  const logEvent = useCallback((sceneId: string, kind: SceneEventKind, message: string, extra: Partial<SceneEvent> = {}) => {
    const latest = getLatestDraft ? getLatestDraft() : draft;
    const me = latest.scenes.find(s => s.id === sceneId);
    const prev = me?.events ?? [];
    const next: SceneEvent[] = [
      ...prev,
      { ts: new Date().toISOString(), kind, message, ...extra },
    ].slice(-40);
    patchScene(sceneId, { events: next });
    // Best-effort console breadcrumb for forensics — suppressed by
    // production-console-shield in builds.
    try { console.info(`[pipeline][${kind}] scene=${me?.index ?? "?"} ${message}`, extra); } catch { /* noop */ }
  }, [draft, getLatestDraft, patchScene]);

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
      const clearFn = (t as any)._clear;
      if (typeof clearFn === "function") clearFn();
      else clearInterval(t);
      polling.current.delete(id);
    }
  };

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.id) {
      throw new Error("Sign in to generate video");
    }
    return { user: session.user, headers: { Authorization: `Bearer ${session.access_token}` } };
  };

  const reserveFailureReason = (estimated: number, hold: unknown, err?: unknown) => {
    const payload = (hold || {}) as any;
    const raw = String((err as any)?.message || payload?.error || payload?.detail || "");
    if (/authorization|invalid_token|jwt|401|sign/i.test(raw)) return "Your session expired — sign in again before generating";
    if (payload?.error === "profile_not_found") return "Your credit profile is not ready yet — refresh after onboarding";
    if (payload?.error && payload.error !== "insufficient_credits") return `Credit reservation failed — ${payload.error}`;
    const reserved = payload?.reserved ?? 0;
    const balance = payload?.balance ?? 0;
    const eff = payload?.effectiveBalance ?? balance - reserved;
    return `Insufficient credits — ${estimated} required, ${eff} available`;
  };

  /**
   * Release a server-side credit hold and clear it from the scene draft.
   * Safe to call repeatedly — server is idempotent and we no-op without an id.
   * Always call this on terminal failure paths so failed retries don't leave
   * phantom holds that drain effective balance until they expire.
   */
  const releaseSceneHold = async (sceneId: string, reason: string) => {
    const latest = getLatestDraft ? getLatestDraft() : draft;
    const me = latest.scenes.find(s => s.id === sceneId);
    const holdId = me?.creditHoldId;
    if (!holdId) return;
    try {
      const { headers } = await getAuthHeader();
      await supabase.functions.invoke("reserve-credits", {
        body: { action: "release", holdId, reason },
        headers,
      });
      logEvent(sceneId, "released", `Credit hold released (${reason})`);
    } catch { /* best-effort */ }
    patchScene(sceneId, { creditHoldId: undefined });
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
    // Realtime channel: react to video_clips inserts/updates for this project
    // and resolve immediately on terminal state. A 15s safety re-fetch covers
    // the rare missed event (network blip, channel resubscribe gap).
    const channelName = `clip:${projectId}:${shotIndex}:${sceneId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "video_clips", filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          const row = (payload?.new ?? payload?.record) as any;
          if (!row || row.shot_index !== shotIndex) return;
          if (row.status === "completed" && row.video_url) {
            patchScene(sceneId, { status: "done", clipUrl: row.video_url, errorReason: undefined });
            logEvent(sceneId, "completed", "Clip ready (realtime)", { detail: row.video_url });
            stopPoll(sceneId);
          } else if (row.status === "failed") {
            const reason = row.error_message || "Generation failed";
            patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
            logEvent(sceneId, "failed", `Terminal failure (realtime): ${String(reason).slice(0, 160)}`);
            toast.error(String(reason).slice(0, 200));
            stopPoll(sceneId);
            void releaseSceneHold(sceneId, "clip_row_failed");
          }
        },
      )
      .subscribe();
    const checkOnce = async () => {
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
          logEvent(sceneId, "completed", "Clip ready (poll)", { detail: url });
          stopPoll(sceneId);
        } else if (status === "failed") {
          const reason = (data as any)?.error_message || "Generation failed";
          patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
          logEvent(sceneId, "failed", `Terminal failure (poll): ${String(reason).slice(0, 160)}`);
          toast.error(String(reason).slice(0, 200));
          stopPoll(sceneId);
          void releaseSceneHold(sceneId, "clip_row_failed");
        }
      } catch { /* transient */ }
    };
    // Immediate fetch (race against the realtime event for already-completed rows)
    void checkOnce();
    const t = setInterval(checkOnce, 15000);
    // Wrap interval handle so stopPoll() also tears down the realtime channel.
    const composite = {
      [Symbol.toPrimitive]: () => Number(t),
      _clear: () => { clearInterval(t); try { supabase.removeChannel(channel); } catch { /* noop */ } },
    } as unknown as ReturnType<typeof setInterval>;
    (composite as any).unref = (t as any).unref?.bind(t);
    polling.current.set(sceneId, composite);
  }, [patchScene]);

  const pollPrediction = useCallback((
    sceneId: string,
    predictionId: string,
    projectId: string,
    shotIndex: number,
    totalClips: number,
  ) => {
    stopPoll(sceneId);
    logEvent(sceneId, "polling", `Polling Replicate prediction every 10s`, { predictionId });
    // Realtime path: terminal status is also written to video_clips by the
    // worker / replicate-webhook. Subscribe so the UI resolves the moment the
    // row updates, and back the predictionId-driven poll off to 10s.
    const channel = supabase
      .channel(`pred:${projectId}:${shotIndex}:${sceneId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "video_clips", filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          const row = (payload?.new ?? payload?.record) as any;
          if (!row || row.shot_index !== shotIndex) return;
          if (row.status === "completed" && row.video_url) {
            patchScene(sceneId, { status: "done", clipUrl: row.video_url, errorReason: undefined });
            logEvent(sceneId, "completed", "Replicate returned clip", { predictionId, detail: row.video_url });
            stopPoll(sceneId);
          } else if (row.status === "failed") {
            const reason = row.error_message || "Generation failed";
            patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
            logEvent(sceneId, "failed", `Replicate failure: ${String(reason).slice(0, 160)}`, { predictionId });
            toast.error(String(reason).slice(0, 200));
            stopPoll(sceneId);
            void releaseSceneHold(sceneId, "prediction_row_failed");
          }
        },
      )
      .subscribe();
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
          logEvent(sceneId, "completed", "Replicate returned clip (poll)", { predictionId, detail: url });
          stopPoll(sceneId);
        } else if (status === "failed") {
          const reason = (data as any)?.error_message || "Generation failed";
          patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
          logEvent(sceneId, "failed", `Replicate failure (poll): ${String(reason).slice(0, 160)}`, { predictionId });
          toast.error(String(reason).slice(0, 200));
          stopPoll(sceneId);
          void releaseSceneHold(sceneId, "prediction_row_failed");
        }
      } catch {
        // keep polling until the backend writes a terminal video_clips state
      }
    }, 10000);
    const composite = {
      [Symbol.toPrimitive]: () => Number(t),
      _clear: () => { clearInterval(t); try { supabase.removeChannel(channel); } catch { /* noop */ } },
    } as unknown as ReturnType<typeof setInterval>;
    polling.current.set(sceneId, composite);
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
        logEvent(sceneId, "waiting", `Waiting on scene ${predecessor.index + 1} (continuity chain)`);
        toast.message(`Scene ${scene.index + 1} waiting on scene ${predecessor.index + 1}`, { duration: 2500 });
        const t = setInterval(() => {
          const latest = getLatestDraft ? getLatestDraft() : sourceDraft;
          const live = latest.scenes.find(s => s.id === predecessor.id);
          if (!live) { stopGate(sceneId); return; }
          if (live.status === "failed") {
            stopGate(sceneId);
            const reason = `Skipped — scene ${predecessor.index + 1} failed (${predecessor.errorReason || "no detail"})`;
            patchScene(sceneId, { status: "failed", waitingOnSceneId: undefined, errorReason: reason });
            logEvent(sceneId, "failed", reason);
            toast.error(`Scene ${scene.index + 1} skipped — predecessor failed`);
            void releaseSceneHold(sceneId, "predecessor_failed");
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
    logEvent(sceneId, "queued", `Preparing render`, { engine: scene.engine || sourceDraft.defaults.engine });
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
      logEvent(sceneId, "dispatching", `Engine locked to ${engineId} on project ${projectId.slice(0, 8)}`, { engine: engineId });

      // ── Reserve credits server-side BEFORE invoking the renderer. The
      // reservation reduces the user's effective balance for any concurrent
      // render (other tab, other scene), eliminating pre-flight drift.
      let holdId: string | null = null;
      try {
        const estimated = creditsForScene(engineId, scene.duration, profile.id);
        logEvent(sceneId, "reserving", `Reserving ${estimated} credits`);
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
          logEvent(sceneId, "failed", reason);
          toast.error(reason);
          return;
        }
        holdId = (hold as any).holdId as string;
        patchScene(sceneId, { creditHoldId: holdId });
        logEvent(sceneId, "reserved", `Hold ${holdId?.slice(0, 8)} placed for ${estimated} cr`);
      } catch (e) {
        const reason = (e as any)?.message || "Could not reserve credits";
        patchScene(sceneId, { status: "failed", errorReason: reason });
        logEvent(sceneId, "failed", `Reserve threw: ${reason}`);
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
          patchScene(sceneId, { creditHoldId: undefined });
        }
        logEvent(sceneId, "failed", `Edge function rejected: ${(error as any)?.message || "unknown"}`, { detail: JSON.stringify(error).slice(0, 240) });
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
        logEvent(sceneId, "queued", `Server parked behind shot ${((data as any)?.waitingOnShot ?? scene.index - 1) + 1}`);
        toast.message(`Scene ${scene.index + 1} queued — waiting on scene ${((data as any)?.waitingOnShot ?? scene.index - 1) + 1}`, { duration: 2500 });
        pollClipRow(sceneId, projectId, scene.index);
      } else if (directUrl) {
        patchScene(sceneId, { status: "done", clipUrl: directUrl });
        logEvent(sceneId, "completed", `Direct return from renderer`, { detail: directUrl });
      } else if (predictionId) {
        patchScene(sceneId, { status: "generating", predictionId });
        logEvent(sceneId, "dispatched", `Replicate prediction accepted`, { predictionId, engine: engineId });
        pollPrediction(sceneId, predictionId, projectId, scene.index, sourceDraft.scenes.length);
      } else {
        patchScene(sceneId, { status: "generating" });
        logEvent(sceneId, "dispatched", `Renderer accepted (no predictionId — row polling)`);
        // Fallback: no predictionId and not queued — poll the row anyway in
        // case the renderer wrote it asynchronously (defensive).
        pollClipRow(sceneId, projectId, scene.index);
      }
    } catch (e: any) {
      const reason = e?.message || e?.error || "Failed to start generation";
      patchScene(sceneId, { status: "failed", errorReason: String(reason).slice(0, 240) });
      logEvent(sceneId, "failed", `Dispatch threw: ${String(reason).slice(0, 160)}`);
      toast.error(String(reason).slice(0, 200));
      void releaseSceneHold(sceneId, "dispatch_threw");
    }
  }, [draft, patchScene, pollPrediction, pollClipRow, ensureProjectId, logEvent]);

  const generateScene = useCallback((sceneId: string) => generateSceneFromDraft(sceneId, draft), [draft, generateSceneFromDraft]);

  return { generateScene, generateSceneFromDraft };
}

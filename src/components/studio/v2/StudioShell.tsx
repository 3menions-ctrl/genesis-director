import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Activity,
  Box,
  Bot,
  Check,
  ChevronRight,
  Clapperboard,
  Cpu,
  Edit3,
  Film,
  Hash,
  Image as ImageIcon,
  Images,
  Languages,
  Loader2,
  Minus,
  Mic2,
  Music2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useStudioDraft } from "@/hooks/useStudioDraft";
import { useScenePipeline } from "@/hooks/useScenePipeline";
import { useTemplateEnvironment } from "@/hooks/useTemplateEnvironment";
import { ENGINES, listEngines, clampDurationForEngine, defaultQualityProfile, creditsForScene, engineToBackend, getQualityProfile, type EngineId } from "@/lib/video/engines";
import { useCinemaEntitlement } from "@/hooks/useCinemaEntitlement";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { StudioDrawer } from "./StudioDrawer";
import { AvatarsDrawerContent } from "./drawers/AvatarsDrawer";
import { EnginesDrawerContent } from "./drawers/EnginesDrawer";
import { EnvironmentsDrawerContent } from "./drawers/EnvironmentsDrawer";
import { MusicDrawerContent } from "./drawers/MusicDrawer";
import { TemplatesDrawerContent, type TemplatePick } from "./drawers/TemplatesDrawer";
import { VoicesDrawerContent } from "./drawers/VoicesDrawer";
import { StylesDrawerContent } from "./drawers/StylesDrawer";
import { newScene, type CastMember, type SceneDraft, type StudioDraft } from "./types";
import { ScriptBuilder } from "./ScriptBuilder";
import { ContinuitySimulator } from "./ContinuitySimulator";
import { extractAndUploadTailFrame } from "@/lib/video/extractTailFrame";
import { DiagnosticsDrawer } from "./DiagnosticsDrawer";


type DrawerKey = null | "templates" | "avatars" | "engines" | "envs" | "voices" | "music" | "styles";
type StepId = "start" | "cast" | "script" | "clips";

const STEPS: Array<{ id: StepId; label: string; icon: LucideIcon }> = [
  { id: "start", label: "Start", icon: Sparkles },
  { id: "cast", label: "Cast", icon: Users },
  { id: "script", label: "Script", icon: Edit3 },
  { id: "clips", label: "Clips", icon: Clapperboard },
];

function makeScenesFromResponse(data: any, draft: StudioDraft): SceneDraft[] {
  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  if (!scenes.length) {
    return [0, 1, 2].map((_, index) => ({
      ...newScene(index),
      location: index === 0 ? "OPENING" : `SCENE ${index + 1}`,
      beat: index === 0 ? draft.brief.logline : `${draft.brief.logline} — story beat ${index + 1}`,
      speakerId: draft.cast[0]?.id,
      refImageUrl: draft.brief.refImageUrl,
      duration: draft.defaults.duration,
    }));
  }

  return scenes.map((s: any, index: number) => ({
    ...newScene(index),
    location: s.location || s.heading || `SCENE ${index + 1}`,
    beat: s.beat || s.action || s.description || draft.brief.logline || "",
    dialogue: s.dialogue || "",
    duration: (s.duration && [5, 10, 15].includes(Number(s.duration)) ? Number(s.duration) : draft.defaults.duration) as 5 | 10 | 12 | 15,
    lens: s.lens || "medium",
    move: s.move || "dolly",
    speakerId: draft.cast[0]?.id,
    refImageUrl: draft.brief.refImageUrl,
    engine: draft.defaults.engine,
  }));
}

function sceneCost(scene: SceneDraft, fallbackEngine: EngineId, qualityProfileId?: string): number {
  const engineId = scene.engine || fallbackEngine;
  try { return creditsForScene(engineId, scene.duration, qualityProfileId); }
  catch { return ENGINES[engineId].baseCreditsFor(ENGINES[engineId].durations[0]); }
}

function sceneApprovalSignature(draft: StudioDraft): string {
  return JSON.stringify({
    engine: draft.defaults.engine,
    aspect: draft.defaults.aspect,
    quality: draft.defaults.qualityProfileId || "hd24",
    scenes: draft.scenes.map(s => ({
      i: s.index, loc: s.location, beat: s.beat, dialogue: s.dialogue,
      lens: s.lens, move: s.move, duration: s.duration, engine: s.engine || draft.defaults.engine,
      chain: s.chainFromPrevious !== false,
    })),
  });
}

type CreditState = { balance: number; held: number; available: number };

async function readCreditState(userId: string): Promise<CreditState> {
  const { data, error } = await (supabase.rpc as any)("get_credit_state", { p_user_id: userId });
  const payload = (data || {}) as any;
  if (!error && payload?.success) {
    return {
      balance: Number(payload.balance || 0),
      held: Number(payload.held || 0),
      available: Number(payload.available || 0),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .maybeSingle();
  const balance = Number((profile as any)?.credits_balance || 0);
  return { balance, held: 0, available: balance };
}

function scenesFromTemplatePick(pick: TemplatePick, draft: StudioDraft): SceneDraft[] {
  const shotSequence = pick.settings?.shotSequence || [];
  const lensMap: Record<string, SceneDraft["lens"]> = {
    wide: "wide",
    medium: "medium",
    close: "close",
    macro: "macro",
    aerial: "aerial",
    establishing: "wide",
    closeup: "close",
    "close-up": "close",
  };
  const moveMap: Record<string, SceneDraft["move"]> = {
    static: "static",
    dolly: "dolly",
    push: "dolly",
    tracking: "dolly",
    pan: "pan",
    tilt: "tilt",
    handheld: "handheld",
    crane: "crane",
    orbit: "pan",
  };

  if (shotSequence.length) {
    return shotSequence.map((shot, index) => {
      const cameraScale = String(shot.cameraScale || "medium").toLowerCase();
      const movement = String(shot.movementType || "dolly").toLowerCase();
      return {
        ...newScene(index),
        location: shot.title || `SCENE ${index + 1}`,
        beat: shot.description || pick.logline,
        dialogue: shot.dialogue || "",
        duration: ([5, 10, 15].includes(Number(shot.durationSeconds)) ? Number(shot.durationSeconds) : draft.defaults.duration) as 5 | 10 | 12 | 15,
        lens: lensMap[cameraScale] || "medium",
        move: moveMap[movement] || "dolly",
        speakerId: draft.cast[0]?.id,
        refImageUrl: pick.thumbnailUrl || pick.settings?.startImageUrl || draft.brief.refImageUrl,
        engine: draft.defaults.engine,
      };
    });
  }

  const count = Math.max(3, Math.min(10, pick.settings?.clipCount || 4));
  return Array.from({ length: count }, (_, index) => ({
    ...newScene(index),
    location: `${pick.name.toUpperCase()} — BEAT ${index + 1}`,
    beat: index === 0 ? pick.logline : `${pick.name}: ${pick.logline} — beat ${index + 1}`,
    duration: draft.defaults.duration,
    speakerId: draft.cast[0]?.id,
    refImageUrl: pick.thumbnailUrl || pick.settings?.startImageUrl || draft.brief.refImageUrl,
    engine: draft.defaults.engine,
  }));
}

export default function StudioShell() {
  const { draft, setDraft, loading, saving, addScene, removeScene, patchScene, reorderScene, duplicateScene, setActive, clearDraft, ensureProjectId } = useStudioDraft();
  const { appliedSettings, templateId, clearAppliedSettings } = useTemplateEnvironment();
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const { generateScene, generateSceneFromDraft } = useScenePipeline(
    draft,
    patchScene,
    ensureProjectId,
    () => draftRef.current,
  );
  const { data: cinemaEntitlement } = useCinemaEntitlement();
  const hasCinema = !!cinemaEntitlement?.hasEntitlement;
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [step, setStep] = useState<StepId>("start");
  const [autoBusy, setAutoBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalCreditState, setApprovalCreditState] = useState<CreditState | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsFocusId, setDiagnosticsFocusId] = useState<string | undefined>(undefined);
  const [createMode, setCreateMode] = useState<"text" | "image" | "template">(() => {
    if (draft.brief.templateId) return "template";
    if (draft.brief.refImageUrl) return "image";
    return "text";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmDialog = useConfirmDialog();
  const navigate = useNavigate();

  // Sequential gate + simulator need to read the FRESHEST scene state without
  // re-binding renderAll on every patch. A draftRef mirrors the latest draft.
  // (draftRef declared above where the pipeline hook is constructed.)

  const activeScene = useMemo(
    () => draft.scenes.find(s => s.id === draft.activeSceneId) || draft.scenes[0],
    [draft.scenes, draft.activeSceneId],
  );

  const renderedCount = draft.scenes.filter(s => s.clipUrl).length;
  const totalCost = useMemo(() => draft.scenes.reduce((acc, scene) => {
    const engineId = scene.engine || draft.defaults.engine;
    try {
      return acc + creditsForScene(engineId, scene.duration, draft.defaults.qualityProfileId);
    } catch {
      return acc;
    }
  }, 0), [draft.scenes, draft.defaults.engine, draft.defaults.qualityProfileId]);

  const canGenerateScript = Boolean(draft.brief.logline.trim() || draft.brief.refImageUrl || draft.brief.templateId);
  const canRender = draft.scenes.length > 0 && (draft.brief.logline.trim() || draft.scenes.some(s => s.beat || s.dialogue));

  // ── Script + Credit approval gate ────────────────────────────────────────
  // Customer must explicitly approve BOTH the current script AND the credit
  // estimate before any render dispatches. The signature is recomputed every
  // render and compared against the stored approvedSceneSignature — any edit
  // (scene order, dialogue, duration, engine, aspect) invalidates approval
  // and forces a fresh confirmation.
  const currentApprovalSignature = useMemo(() => sceneApprovalSignature(draft), [draft]);
  const isApprovalCurrent = Boolean(
    draft.scriptApprovedAt &&
    draft.creditEstimateApprovedAt &&
    draft.approvedSceneSignature === currentApprovalSignature &&
    draft.approvedCreditTotal === totalCost,
  );

  const openApprovalGate = useCallback(async () => {
    setApprovalOpen(true);
    setApprovalLoading(true);
    setApprovalCreditState(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setApprovalCreditState(await readCreditState(user.id));
      }
    } catch { setApprovalCreditState(null); }
    finally { setApprovalLoading(false); }
  }, []);

  const approveAndStamp = useCallback(() => {
    const stamp = new Date().toISOString();
    setDraft(d => ({
      ...d,
      scriptApprovedAt: stamp,
      creditEstimateApprovedAt: stamp,
      approvedSceneSignature: sceneApprovalSignature(d),
      approvedCreditTotal: d.scenes.reduce((acc, s) => {
        const eid = s.engine || d.defaults.engine;
        try { return acc + creditsForScene(eid, s.duration, d.defaults.qualityProfileId); }
        catch { return acc; }
      }, 0),
    }));
  }, [setDraft]);

  useEffect(() => {
    if (!appliedSettings) return;

    const pick: TemplatePick = {
      id: templateId || appliedSettings.templateName || "template",
      name: appliedSettings.templateName || "Template",
      logline: appliedSettings.concept,
      style: [appliedSettings.genre, appliedSettings.mood, appliedSettings.colorGrading].filter(Boolean).join(" · ") || "Cinematic",
      thumbnailUrl: appliedSettings.startImageUrl,
      settings: appliedSettings,
    };

    setDraft(d => {
      if (d.brief.templateId === pick.id) return d;
      const scenes = scenesFromTemplatePick(pick, d);
      return {
        ...d,
        brief: {
          ...d.brief,
          title: d.brief.title || pick.name,
          logline: pick.logline || d.brief.logline,
          style: pick.style || d.brief.style,
          templateId: pick.id,
          refImageUrl: pick.thumbnailUrl || d.brief.refImageUrl,
          environmentId: appliedSettings.environmentName || d.brief.environmentId,
        },
        scenes,
        activeSceneId: scenes[0]?.id,
      };
    });
    setStep("cast");
    clearAppliedSettings();
  }, [appliedSettings, clearAppliedSettings, setDraft, templateId]);

  const uploadReferenceImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Upload an image file");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to upload images");

      const extension = file.name.split(".").pop() || "png";
      const path = `${user.id}/create/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("scene-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("scene-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setDraft(d => ({
        ...d,
        brief: { ...d.brief, refImageUrl: publicUrl },
        scenes: d.scenes.map(scene => scene.refImageUrl ? scene : { ...scene, refImageUrl: publicUrl }),
      }));
      toast.success("Reference image added");
    } catch (error: any) {
      toast.error(error?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  }, [setDraft]);

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadReferenceImage(file);
  }, [uploadReferenceImage]);

  const runAutoScript = useCallback(async ({ renderAfter = false } = {}) => {
    if (!canGenerateScript) {
      toast.error("Add a prompt, upload an image, or pick a template first");
      setStep("start");
      return;
    }

    setAutoBusy(true);
    try {
      // ── Resolve mode from current draft state ──
      const hasAvatar = draft.cast.length > 0;
      const hasImage = !!draft.brief.refImageUrl;
      const mode: "avatar" | "image-to-video" | "text-to-video" =
        hasAvatar ? "avatar" : hasImage ? "image-to-video" : "text-to-video";

      // ── Image-to-video: extract Scene Identity DNA so the script ADHERES
      //    to the uploaded frame (character + environment + lighting + color).
      //    Cached on the project's pro_features_data so we only charge once.
      let referenceImageAnalysis: any = undefined;
      let sceneIdentityContext: any = undefined;
      if (mode === "image-to-video" && draft.brief.refImageUrl) {
        try {
          const projectId = await ensureProjectId();
          const { data: existing } = await supabase
            .from("movie_projects")
            .select("pro_features_data")
            .eq("id", projectId)
            .maybeSingle();
          const cachedIdentity = (existing as any)?.pro_features_data?.sceneIdentity;
          let identity = cachedIdentity;
          if (!identity) {
            toast.message("Reading the image…", { description: "Extracting character + scene DNA (5 cr)" });
            const { data: idData, error: idErr } = await supabase.functions.invoke("extract-scene-identity", {
              body: { imageUrl: draft.brief.refImageUrl, projectId },
            });
            if (idErr) console.warn("extract-scene-identity failed:", idErr);
            if ((idData as any)?.success) {
              identity = {
                characterDNA: (idData as any).characterDNA,
                environmentDNA: (idData as any).environmentDNA,
                lightingProfile: (idData as any).lightingProfile,
                colorScience: (idData as any).colorScience,
                cinematicStyle: (idData as any).cinematicStyle,
                masterConsistencyPrompt: (idData as any).masterConsistencyPrompt,
                allNegatives: (idData as any).allNegatives,
              };
            }
          }
          if (identity?.characterDNA || identity?.environmentDNA) {
            const c = identity.characterDNA || {};
            const e = identity.environmentDNA || {};
            const l = identity.lightingProfile || {};
            referenceImageAnalysis = {
              characterIdentity: c.facialFeatures ? {
                description: c.description || c.identitySummary || "",
                facialFeatures: [c.facialFeatures.faceShape, c.facialFeatures.eyes, c.facialFeatures.jawline].filter(Boolean).join(", "),
                clothing: c.clothingSignature ? [c.clothingSignature.topwear, c.clothingSignature.bottomwear].filter(Boolean).join(", ") : "",
                bodyType: c.bodyProfile?.build || "",
                distinctiveMarkers: c.distinctiveMarkers || [],
                hairColor: c.hairProfile?.color,
                skinTone: c.facialFeatures?.skinTone,
              } : undefined,
              environment: e.setting ? {
                setting: e.setting,
                geometry: typeof e.geometry === "string" ? e.geometry : JSON.stringify(e.geometry || {}),
                keyObjects: (e.keyProps || []).map((p: any) => p.object || p).filter(Boolean),
                backgroundElements: e.backgroundElements || [],
              } : undefined,
              lighting: l.style ? {
                style: l.style,
                direction: l.shadows?.direction || "",
                quality: l.mood || "",
                timeOfDay: l.colorTemperature || "",
              } : undefined,
              consistencyPrompt: identity.masterConsistencyPrompt,
            };
            sceneIdentityContext = {
              characterAnchor: c.identitySummary || "",
              environmentAnchor: e.setting || "",
              lightingAnchor: l.style || "",
              colorAnchor: identity.colorScience?.gradingStyle || "",
              cinematicAnchor: identity.cinematicStyle?.lensFeel || "",
              masterConsistencyPrompt: identity.masterConsistencyPrompt || "",
              allNegatives: identity.allNegatives || [],
              environmentDNA: e,
              lightingProfile: l,
              colorScience: identity.colorScience,
            };
          }
        } catch (visionErr) {
          console.warn("[runAutoScript] vision pre-pass failed (continuing without DNA):", visionErr);
        }
      }

      // ── Avatar mode: send the cast so the script writes lines for THEM,
      //    keyed to the right speakerId per scene.
      const characterCast = hasAvatar ? draft.cast.map((c) => ({
        id: c.id,
        name: c.name,
        appearance: c.name,
        voiceId: c.voiceId || draft.defaults.voiceId || "",
        role: "protagonist" as const,
        referenceImageUrl: c.imageUrl,
      })) : undefined;
      const sceneType: "monologue" | "dialogue" | "group" =
        !hasAvatar ? "monologue" : draft.cast.length === 1 ? "monologue" : draft.cast.length === 2 ? "dialogue" : "group";

      const engineSpec = ENGINES[draft.defaults.engine];
      const maxScenes = engineSpec?.maxScenesPerProject ?? 8;
      const desired = draft.defaults.sceneCount ?? engineSpec?.recommendedScenes ?? draft.scenes.length ?? 4;
      const sceneCount = Math.max(1, Math.min(maxScenes, desired));
      const clipDuration = draft.defaults.duration;

      const { data, error } = await supabase.functions.invoke("smart-script-generator", {
        body: {
          topic: draft.brief.logline || "Create a cinematic sequence from the uploaded reference image.",
          synopsis: draft.brief.title,
          style: draft.brief.style,
          targetDurationSeconds: sceneCount * clipDuration,
          clipCount: sceneCount,
          clipDuration,
          mode,
          videoEngine: engineToBackend(draft.defaults.engine),
          aspectRatio: draft.defaults.aspect,
          referenceImageUrl: draft.brief.refImageUrl,
          referenceImageAnalysis,
          sceneIdentityContext,
          multiCharacterMode: hasAvatar && draft.cast.length > 1,
          characterCast,
          sceneType,
          includeVoice: hasAvatar,
          preserveUserContent: true,
        },
      });
      if (error) throw error;

      const scenes = makeScenesFromResponse(data, draft);
      const nextDraft: StudioDraft = { ...draft, scenes, activeSceneId: scenes[0]?.id };
      setDraft(() => nextDraft);
      setStep(renderAfter ? "clips" : "script");
      toast.success(`${scenes.length} editable scenes created`);

      if (renderAfter) {
        for (const scene of scenes) {
          await generateSceneFromDraft(scene.id, nextDraft);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Auto script failed");
    } finally {
      setAutoBusy(false);
    }
  }, [canGenerateScript, draft, generateSceneFromDraft, setDraft]);

  const renderAllDispatch = useCallback(async () => {
    if (!canRender) {
      toast.error("Create or write scenes first");
      return;
    }
    // ── Cinema entitlement gate ──
    const blocking = draft.scenes.find(s => {
      const eid = s.engine || draft.defaults.engine;
      return ENGINES[eid].requiresEntitlement === "studio_cinema" && !hasCinema;
    });
    if (blocking) {
      toast.error("Cinema engine requires a Studio Cinema subscription", {
        description: "Switch to Kling V3 / Seedance, or upgrade to unlock Veo, Runway and Sora.",
        action: { label: "Upgrade", onClick: () => navigate("/credits") },
      });
      return;
    }
    // ── Pre-flight credit check ──
    // Scenes render one-at-a-time and each reserves credits server-side,
    // so we only need enough credits for the NEXT unrendered scene to start.
    // If the wallet can't cover the full project we warn but still allow
    // partial generation (user can top up mid-run).
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .maybeSingle();
        const balance = (profile as any)?.credits_balance ?? 0;
        const pending = draft.scenes.filter(s => !s.clipUrl);
        const nextCost = pending.length
          ? (() => {
              const s = pending[0];
              const eid = s.engine || draft.defaults.engine;
              try { return creditsForScene(eid, s.duration, draft.defaults.qualityProfileId); }
              catch { return ENGINES[eid].baseCreditsFor(ENGINES[eid].durations[0]); }
            })()
          : 0;
        if (balance < nextCost) {
          toast.error(`Insufficient credits — ${nextCost} required to render the next scene, ${balance} available`, {
            action: { label: "Buy credits", onClick: () => navigate("/credits") },
          });
          return;
        }
        if (balance < totalCost) {
          toast.warning(`Heads up — full project costs ${totalCost} credits, you have ${balance}. Rendering will stop when the wallet runs out.`);
        }
      }
    } catch { /* non-fatal — server enforces final deduct */ }
    setStep("clips");
    // ── Sequential continuity gate ─────────────────────────────────────────
    // For each scene we (a) wait for the prior continuous scene to finish,
    // (b) extract its tail frame and stamp it onto this scene's refImageUrl
    // so the renderer inherits a REAL last-frame anchor (not the static brief
    // ref or cast image), and only then (c) kick off generation and await
    // terminal state. Independent scenes skip the wait and the tail-stamp.
    const projectId = await ensureProjectId();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "";

    const waitForTerminal = (sceneId: string, timeoutMs = 8 * 60 * 1000) =>
      new Promise<"done" | "failed">((resolve) => {
        const started = Date.now();
        const tick = () => {
          const s = draftRef.current.scenes.find(x => x.id === sceneId);
          if (s?.status === "done" && s.clipUrl) return resolve("done");
          if (s?.status === "failed") return resolve("failed");
          if (Date.now() - started > timeoutMs) return resolve("failed");
          setTimeout(tick, 1000);
        };
        tick();
      });

    for (let i = 0; i < draftRef.current.scenes.length; i++) {
      const scene = draftRef.current.scenes[i];
      if (scene.clipUrl || scene.status === "generating") continue;

      // Tail-frame chain for continuous scenes (skip for the first scene).
      const chained = scene.chainFromPrevious !== false;
      if (i > 0 && chained) {
        const prev = draftRef.current.scenes[i - 1];
        if (prev?.clipUrl) {
          toast.message(`Extracting tail frame from scene ${prev.index + 1}…`, { duration: 1500 });
          const tailUrl = await extractAndUploadTailFrame(prev.clipUrl, {
            userId,
            projectId,
            sceneIndex: scene.index,
          });
          if (tailUrl) {
            patchScene(scene.id, { refImageUrl: tailUrl });
            // give state one tick so generateSceneFromDraft sees the update
            await new Promise(r => setTimeout(r, 60));
          }
        }
      }

      // Always use the latest draft snapshot so the patched refImageUrl flows
      // through to the edge function as startImageUrl.
      await generateSceneFromDraft(scene.id, draftRef.current);
      const outcome = await waitForTerminal(scene.id);
      if (outcome === "failed") {
        toast.error(`Scene ${scene.index + 1} failed — pausing batch render`);
        break;
      }
    }
  }, [canRender, draft.scenes, draft.defaults.engine, ensureProjectId, generateSceneFromDraft, hasCinema, navigate, patchScene, totalCost]);

  // Render entry point — enforces the approval gate. Opens the dialog when
  // approval is missing or stale; otherwise dispatches directly.
  const renderAll = useCallback(async () => {
    if (!canRender) {
      toast.error("Create or write scenes first");
      return;
    }
    if (!isApprovalCurrent) {
      void openApprovalGate();
      return;
    }
    await renderAllDispatch();
  }, [canRender, isApprovalCurrent, openApprovalGate, renderAllDispatch]);

  const autoCreate = useCallback(async () => {
    if (!draft.scenes.length) {
      // Generate script first, then require explicit approval before rendering.
      await runAutoScript({ renderAfter: false });
      setTimeout(() => { void openApprovalGate(); }, 80);
      return;
    }
    await renderAll();
  }, [draft.scenes.length, renderAll, runAutoScript, openApprovalGate]);

  const addCastMember = useCallback((member: CastMember) => {
    setDraft(d => d.cast.find(c => c.id === member.id) ? d : ({
      ...d,
      cast: [...d.cast, member],
      scenes: d.scenes.map(scene => scene.speakerId ? scene : { ...scene, speakerId: member.id }),
    }));
    setStep("cast");
  }, [setDraft]);

  const openInEditor = useCallback(() => {
    const clips = draft.scenes.filter(s => s.clipUrl);
    if (!clips.length) {
      toast.error("Render at least one clip first");
      setStep("clips");
      return;
    }
    try {
      sessionStorage.setItem("editor:hydrate", JSON.stringify({
        clips: clips.map(s => ({ url: s.clipUrl, title: s.location, duration: s.duration })),
        score: draft.audio.scoreUrl,
        source: "create",
      }));
    } catch {
      // non-blocking editor hydration
    }
    navigate("/editor");
  }, [draft, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-56px)] overflow-hidden bg-background text-foreground">
      {/* Quiet editorial ground — single soft halo, no grain or scanlines */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-20%,hsl(var(--accent)/0.07),transparent_70%)]" />
      </div>

      <header className="relative z-10 flex h-[72px] items-center gap-6 border-b border-border/40 bg-background/60 px-6 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/40">
            <Film className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <input
              value={draft.brief.title}
              onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, title: e.target.value } }))}
              placeholder="Untitled film"
              className="w-72 max-w-[30vw] bg-transparent font-display text-lg italic tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/50">Cinematic workflow</div>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1.5">
            {STEPS.map(({ id, label }, index) => {
              const active = step === id;
              const complete = id === "start" ? canGenerateScript : id === "cast" ? draft.cast.length > 0 : id === "script" ? draft.scenes.length > 0 : renderedCount > 0;
              return (
                <div key={id} className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(id)}
                    className="group flex h-9 items-center gap-2 px-2 transition-colors"
                  >
                    <span className={cn(
                      "font-mono text-[9px] tabular-nums transition-colors",
                      active ? "text-accent" : complete ? "text-foreground/60" : "text-muted-foreground/50",
                    )}>
                      {complete && !active ? <Check className="h-3 w-3" /> : String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("font-mono text-[10px] uppercase tracking-[0.24em]", active ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground")}>{label}</span>
                  </button>
                  {index < STEPS.length - 1 && <span className="h-px w-6 bg-border/40" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saving && (
            <span className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> saving
            </span>
          )}
          <button onClick={() => setDrawer("engines")} className="hidden h-9 items-center gap-1.5 px-2 text-foreground/80 transition-colors hover:text-foreground md:inline-flex" title={ENGINES[draft.defaults.engine].label}>
            <Cpu className="h-3.5 w-3.5 text-accent/80" strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{ENGINES[draft.defaults.engine].shortLabel}</span>
          </button>
          <button
            onClick={async () => {
              if (await confirmDialog.confirm({
                title: "Start fresh?",
                description: "This clears your title, cast, script, and all scenes. It cannot be undone.",
                confirmLabel: "Clear all",
                destructive: true,
              })) {
                await clearDraft();
                setStep("start");
                toast.success("Draft cleared — ready for a new story");
              }
            }}
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive md:inline-flex"
            title="Clear everything and start over"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden lg:inline">Start fresh</span>
          </button>
          <button
            onClick={() => { setDiagnosticsFocusId(undefined); setDiagnosticsOpen(true); }}
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground md:inline-flex"
            title="Open pipeline diagnostics"
          >
            <Activity className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden lg:inline">Diagnostics</span>
            {draft.scenes.some(s => s.status === "failed") && (
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            )}
          </button>
          <button
            onClick={autoCreate}
            disabled={autoBusy || uploading || !canGenerateScript}
            className="group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-full bg-accent px-5 text-[12px] font-medium tracking-[0.04em] text-accent-foreground transition-all hover:bg-[hsl(215_100%_52%)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {autoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>Auto create</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 grid h-[calc(100dvh-56px-72px)] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-y-auto p-4 premium-scroll md:p-6 xl:p-8">
          <AnimatePresence mode="wait">
            {step === "start" && (
              <StartHero
                key="start"
                draft={draft}
                setDraft={setDraft}
                createMode={createMode}
                setCreateMode={setCreateMode}
                fileInputRef={fileInputRef}
                onFileChange={onFileChange}
                uploading={uploading}
                autoBusy={autoBusy}
                canGenerateScript={Boolean(canGenerateScript)}
                canRender={Boolean(canRender)}
                totalCost={totalCost}
                renderedCount={renderedCount}
                hasCinema={hasCinema}
                onAutoCreate={autoCreate}
                onRunScript={runAutoScript}
                onRenderAll={renderAll}
                onSetStep={setStep}
                onOpenDrawer={setDrawer}
                onClearImage={() => setDraft(d => ({ ...d, brief: { ...d.brief, refImageUrl: undefined } }))}
                onInspectScene={(id) => { setDiagnosticsFocusId(id); setDiagnosticsOpen(true); }}
              />
            )}

            {step === "cast" && (
              <FlowPanel key="cast" eyebrow="Step 2" title="Pick the avatars that will appear" icon={Users}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-2xl border border-border bg-card/55 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Cast picker</div>
                        <p className="mt-1 text-sm text-muted-foreground">Saved characters, template gallery, and generated avatars all connect here.</p>
                      </div>
                      <button onClick={() => setDrawer("avatars")} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
                        <Plus className="h-4 w-4" /> Pick avatar
                      </button>
                    </div>

                    {draft.cast.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {draft.cast.map(member => (
                          <CastCard key={member.id} member={member} onRemove={() => setDraft(d => ({ ...d, cast: d.cast.filter(c => c.id !== member.id) }))} />
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => setDrawer("avatars")} className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background/35 p-8 text-center transition-colors hover:border-accent/50 hover:bg-accent/[0.03]">
                        <Users className="mb-4 h-10 w-10 text-accent" />
                        <div className="text-xl font-medium text-foreground">Pick avatars here</div>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">Choose from your saved characters, browse the avatar template gallery, or generate a new avatar.</p>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <ActionTile icon={Mic2} title="Default voice" body={draft.defaults.voiceId || "Choose voice for dialogue"} onClick={() => setDrawer("voices")} />
                    <ActionTile icon={Bot} title="Auto-cast allowed" body="If no avatar is picked, Auto will still render text/image video." onClick={() => setDrawer("avatars")} />
                    <button onClick={() => setStep("script")} className="flex w-full items-center justify-between rounded-xl bg-accent px-4 py-4 text-left text-accent-foreground transition-colors hover:bg-accent/90">
                      <span className="font-medium">Continue to script</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </FlowPanel>
            )}

            {step === "script" && (
              <FlowPanel key="script" eyebrow="Step 3" title="Auto-script, then edit anything" icon={Edit3}>
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <CommandCard icon={Wand2} title="Auto-script" body="Generate editable scenes from your prompt, image, template, and cast." busy={autoBusy} onClick={() => runAutoScript()} disabled={!canGenerateScript || autoBusy} />
                  <CommandCard icon={Play} title="Auto-shoot" body="Render every scene through the selected pipeline." onClick={renderAll} disabled={!canRender} />
                  <CommandCard icon={Music2} title="Score / voice" body="Generate music or select voices before render." onClick={() => setDrawer("music")} />
                </div>

                <div className="space-y-3">
                  {draft.scenes.length > 0 ? (
                    <>
                    <ContinuitySimulator
                      scenes={draft.scenes}
                      cast={draft.cast}
                      brief={draft.brief}
                    />
                    <ScriptBuilder
                      scenes={draft.scenes}
                      cast={draft.cast}
                      title={draft.brief.title}
                      activeId={activeScene?.id}
                      onSelect={setActive}
                      onPatch={patchScene}
                      onRemove={removeScene}
                      onRender={generateScene}
                      onReorder={reorderScene}
                      onDuplicate={duplicateScene}
                      onAddScene={addScene}
                      onAutoAssign={(assignments) => {
                        assignments.forEach(a => patchScene(a.id, { speakerId: a.speakerId }));
                      }}
                    />
                    </>
                  ) : (
                    <button onClick={() => runAutoScript()} disabled={!canGenerateScript || autoBusy} className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/35 p-8 text-center transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40">
                      {autoBusy ? <Loader2 className="mb-3 h-8 w-8 animate-spin text-accent" /> : <Wand2 className="mb-3 h-8 w-8 text-accent" />}
                      <div className="text-lg font-medium text-foreground">Generate the full script</div>
                      <p className="mt-2 text-sm text-muted-foreground">Auto restores script generation into editable scene cards.</p>
                    </button>
                  )}
                  <button onClick={addScene} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card/60 px-4 text-sm text-foreground hover:bg-card">
                    <Plus className="h-4 w-4" /> Add scene manually
                  </button>
                </div>
              </FlowPanel>
            )}

            {step === "clips" && (
              <FlowPanel key="clips" eyebrow="Step 4" title="Watch clips, regenerate, then send to editor" icon={Clapperboard}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="grid gap-3 md:grid-cols-2">
                    {draft.scenes.map(scene => (
                      <ClipCard key={scene.id} scene={scene} active={activeScene?.id === scene.id} onSelect={() => setActive(scene.id)} onRender={() => generateScene(scene.id)} />
                    ))}
                    {!draft.scenes.length && (
                      <button onClick={() => setStep("script")} className="min-h-[260px] rounded-2xl border-2 border-dashed border-border bg-card/35 p-8 text-center text-muted-foreground hover:border-accent/50">
                        Create scenes first
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border bg-card/55 p-5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Render status</div>
                      <div className="mt-3 text-4xl font-semibold text-foreground">{renderedCount}<span className="text-muted-foreground">/{draft.scenes.length}</span></div>
                      <p className="mt-2 text-sm text-muted-foreground">Rendered clips can be reviewed here before editing.</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${draft.scenes.length ? (renderedCount / draft.scenes.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <button onClick={renderAll} disabled={!canRender} className="flex w-full items-center justify-between rounded-xl bg-accent px-4 py-4 text-left text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40">
                      <span className="font-medium">Render missing clips</span>
                      <Play className="h-4 w-4" />
                    </button>
                    <button onClick={openInEditor} disabled={!renderedCount} className="flex w-full items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-4 text-left text-foreground transition-colors hover:bg-card disabled:opacity-40">
                      <span className="font-medium">Open in editor</span>
                      <Send className="h-4 w-4 text-accent" />
                    </button>
                  </div>
                </div>
              </FlowPanel>
            )}
          </AnimatePresence>
        </section>

        <aside className="relative hidden border-l border-border/30 bg-transparent p-6 lg:block">
          <StagePreview scene={activeScene} draft={draft} renderedCount={renderedCount} totalCost={totalCost} onRender={() => activeScene && generateScene(activeScene.id)} onOpenEditor={openInEditor} />
        </aside>
      </main>

      <StudioDrawer open={drawer === "templates"} onClose={() => setDrawer(null)} title="Template gallery" subtitle="Pick a structure, then continue the same flow" width="lg">
        <TemplatesDrawerContent onPick={(pick) => {
          setDraft(d => {
            const scenes = scenesFromTemplatePick(pick, d);
            return {
              ...d,
              brief: {
                ...d.brief,
                title: d.brief.title || pick.name,
                logline: pick.logline || d.brief.logline,
                style: pick.style || d.brief.style,
                templateId: pick.id,
                refImageUrl: pick.thumbnailUrl || pick.settings?.startImageUrl || d.brief.refImageUrl,
              },
              defaults: {
                ...d.defaults,
                duration: pick.targetDurationMinutes && pick.targetDurationMinutes <= 1 ? 5 : d.defaults.duration,
              },
              scenes,
              activeSceneId: scenes[0]?.id,
            };
          });
          setDrawer(null);
          setStep("cast");
          toast.success(`${pick.name} template loaded`);
        }} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "avatars"} onClose={() => setDrawer(null)} title="Avatar picker" subtitle="Saved characters, avatar gallery, or generate a new avatar" width="xl">
        <AvatarsDrawerContent selectedIds={draft.cast.map(c => c.id)} onSelect={addCastMember} onClose={() => setDrawer(null)} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "engines"} onClose={() => setDrawer(null)} title="Engine" subtitle="Choose the render pipeline for this creation" width="lg">
        <EnginesDrawerContent
          selected={draft.defaults.engine}
          duration={draft.defaults.duration}
          hasCinema={hasCinema}
          onSelect={(id) => {
            const target = ENGINES[id];
            if (target.requiresEntitlement === "studio_cinema" && !hasCinema) {
              toast.error(`${target.shortLabel} requires Studio Cinema`, {
                description: "Upgrade to unlock Veo, Runway and Sora.",
                action: { label: "Upgrade", onClick: () => navigate("/credits") },
              });
              return;
            }
            setDraft(d => {
              const spec = ENGINES[id];
              const newDuration = clampDurationForEngine(id, d.defaults.duration) as 5 | 10 | 12 | 15;
              const profile = defaultQualityProfile(id);
              // Clamp scenes to engine's per-project cap and re-clamp each scene's duration.
              const clampedScenes = d.scenes
                .slice(0, spec.maxScenesPerProject)
                .map(scene => ({
                  ...scene,
                  engine: id,
                  duration: clampDurationForEngine(id, scene.duration) as 5 | 10 | 12 | 15,
                }));
              return {
                ...d,
                defaults: { ...d.defaults, engine: id, duration: newDuration, sceneCount: Math.min(d.defaults.sceneCount ?? spec.recommendedScenes, spec.maxScenesPerProject), qualityProfileId: profile.id },
                scenes: clampedScenes,
              };
            });
            setDrawer(null);
            const spec = ENGINES[id];
            toast.success(`${spec.shortLabel} · ${spec.pipelineId} · up to ${spec.maxScenesPerProject} scenes`);
          }}
        />
      </StudioDrawer>

      <StudioDrawer open={drawer === "envs"} onClose={() => setDrawer(null)} title="Environments" subtitle="Pick a world or visual anchor" width="lg">
        <EnvironmentsDrawerContent selectedId={draft.brief.environmentId} onSelect={(env) => {
          setDraft(d => ({ ...d, brief: { ...d.brief, environmentId: env.id, refImageUrl: env.thumbnail_url || d.brief.refImageUrl } }));
          setDrawer(null);
          toast.success("Environment applied");
        }} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "voices"} onClose={() => setDrawer(null)} title="Voices" subtitle="Assign the default voice for avatar dialogue" width="lg">
        <VoicesDrawerContent selectedId={draft.defaults.voiceId} onSelect={(id) => {
          setDraft(d => ({ ...d, defaults: { ...d.defaults, voiceId: id } }));
          setDrawer(null);
        }} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "music"} onClose={() => setDrawer(null)} title="Music" subtitle="Generate a score for the rendered clips" width="lg">
        <MusicDrawerContent current={draft.audio.scorePrompt} onSelect={(url, prompt) => {
          setDraft(d => ({ ...d, audio: { ...d.audio, scoreUrl: url, scorePrompt: prompt } }));
          setDrawer(null);
        }} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "styles"} onClose={() => setDrawer(null)} title="Visual style" subtitle="Lock the look — color, lensing, era, and mood" width="xl">
        <StylesDrawerContent selectedId={draft.brief.styleId} onSelect={(style) => {
          setDraft(d => ({
            ...d,
            brief: {
              ...d.brief,
              styleId: style.id,
              style: style.name,
              styleModifier: style.modifier,
            },
          }));
          setDrawer(null);
          toast.success(`${style.name} style applied`);
        }} />
      </StudioDrawer>
      <confirmDialog.Dialog />

      {/* ===== Script + Credit Approval Gate ===== */}
      <ApprovalGate
        open={approvalOpen}
        loading={approvalLoading}
        scenes={draft.scenes}
        cast={draft.cast}
        defaults={draft.defaults}
        totalCost={totalCost}
        creditState={approvalCreditState}
        onClose={() => setApprovalOpen(false)}
        onApprove={async () => {
          approveAndStamp();
          setApprovalOpen(false);
          // Defer to next tick so the stamped draft is committed before dispatch.
          setTimeout(() => { void renderAllDispatch(); }, 60);
        }}
        onEditScript={() => { setApprovalOpen(false); setStep("script"); }}
        onBuyCredits={() => { setApprovalOpen(false); navigate("/credits"); }}
      />

      {/* ===== Pipeline diagnostics — scene_id × prediction_id × hold_id ===== */}
      <DiagnosticsDrawer
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        scenes={draft.scenes}
        projectId={draft.projectId}
        focusSceneId={diagnosticsFocusId}
      />
    </div>
  );
}

function FlowPanel({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: React.ReactNode; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="relative">
      <div className="relative mb-12 flex items-end justify-between gap-6">
        <div className="flex-1">
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">
            <span>{new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase()}</span>
            <span className="h-px w-8 bg-border/60" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="max-w-3xl font-display text-[34px] font-light leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[42px] md:text-[52px] xl:text-[60px]">{title}</h1>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function ReferenceUploader({ imageUrl, uploading, onUploadClick, onClear }: { imageUrl?: string; uploading: boolean; onUploadClick: () => void; onClear: () => void }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/60 via-card/30 to-background/40 shadow-[0_24px_80px_-30px_hsl(var(--accent)/0.4)]">
      {/* Cinema corner brackets */}
      <span className="pointer-events-none absolute left-3 top-3 z-20 h-5 w-5 border-l-2 border-t-2 border-accent/60" />
      <span className="pointer-events-none absolute right-3 top-3 z-20 h-5 w-5 border-r-2 border-t-2 border-accent/60" />
      <span className="pointer-events-none absolute bottom-3 left-3 z-20 h-5 w-5 border-b-2 border-l-2 border-accent/60" />
      <span className="pointer-events-none absolute bottom-3 right-3 z-20 h-5 w-5 border-b-2 border-r-2 border-accent/60" />

      <div className="aspect-[21/9] min-h-[320px]">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Uploaded reference" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          </>
        ) : (
          <button onClick={onUploadClick} className="relative flex h-full w-full flex-col items-center justify-center p-10 text-center transition-colors">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.08),transparent_60%)] opacity-60 transition-opacity group-hover:opacity-100" />
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 shadow-[0_0_40px_hsl(var(--accent)/0.35)]">
              <Upload className="h-6 w-6 text-accent" />
            </div>
            <div className="font-display text-3xl italic text-foreground">Drop your first frame</div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">A single still becomes the visual DNA — image-to-video, avatar continuity, and the opening scene all start here.</p>
            <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/60">PNG · JPG · WEBP</div>
          </button>
        )}
      </div>
      <div className="absolute bottom-5 left-5 right-5 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onUploadClick} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground shadow-[0_0_24px_hsl(var(--accent)/0.4)] hover:bg-accent/90 disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {imageUrl ? "Replace" : "Upload image"}
          </button>
          {imageUrl && <button onClick={onClear} className="h-10 rounded-full border border-border/60 bg-background/70 px-4 text-sm text-foreground backdrop-blur hover:bg-card">Remove</button>}
        </div>
        {imageUrl && <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/80">REF · 01</span>}
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, title, body, onClick }: { icon: typeof Sparkles; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group relative flex w-full items-center justify-between gap-4 border-b border-border/30 py-4 text-left transition-colors hover:border-accent/40">
      <div className="flex items-start gap-4">
        <Icon className="mt-0.5 h-4 w-4 text-accent/80 transition-colors group-hover:text-accent" strokeWidth={1.5} />
        <div>
          <div className="text-[13px] font-medium text-foreground/95">{title}</div>
          <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground/75">{body}</p>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-accent" />
    </button>
  );
}

function CommandCard({ icon: Icon, title, body, busy, disabled, onClick }: { icon: typeof Sparkles; title: string; body: string; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="group relative w-full rounded-xl border border-border/40 bg-card/30 p-5 text-left transition-all hover:border-accent/40 hover:bg-card/50 disabled:cursor-not-allowed disabled:opacity-30">
      <div className="mb-3 flex items-center justify-between">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Icon className="h-4 w-4 text-accent/80" strokeWidth={1.5} />}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-accent" />
      </div>
      <div className="text-[14px] font-medium text-foreground/95">{title}</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground/75">{body}</p>
    </button>
  );
}

function SegmentedSelect<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <div className="flex rounded-lg border border-border bg-background/60 p-1">
      {options.map(option => (
        <button key={option} onClick={() => onChange(option)} className={cn("h-8 rounded-md px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors", value === option ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{option}</button>
      ))}
    </div>
  );
}

function CastCard({ member, onRemove }: { member: CastMember; onRemove: () => void }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-background/50">
      <div className="relative aspect-[4/5] bg-muted">
        {member.imageUrl ? <img src={member.imageUrl} alt={member.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">{member.name.slice(0, 1)}</div>}
        <button onClick={onRemove} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100" aria-label="Remove avatar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-medium text-foreground">{member.name}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{member.source}</div>
      </div>
    </div>
  );
}

function SceneEditor({ scene, cast, active, onSelect, onPatch, onRemove, onRender, onPickEngine }: { scene: SceneDraft; cast: CastMember[]; active: boolean; onSelect: () => void; onPatch: (patch: Partial<SceneDraft>) => void; onRemove: () => void; onRender: () => void; onPickEngine: () => void }) {
  return (
    <div onClick={onSelect} className={cn("rounded-2xl border bg-card/55 p-4 transition-all", active ? "border-accent/60 shadow-[0_0_24px_hsl(var(--accent)/0.14)]" : "border-border hover:border-accent/25")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Scene {String(scene.index + 1).padStart(2, "0")}</span>
        <StatusPill status={scene.status} waiting={!!scene.waitingOnSceneId} />
        <div className="flex-1" />
        <button onClick={(e) => { e.stopPropagation(); onPickEngine(); }} className="h-8 rounded-lg border border-border bg-background/50 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">{ENGINES[scene.engine || "kling-v3"].shortLabel}</button>
        <button onClick={(e) => { e.stopPropagation(); onRender(); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-foreground hover:bg-accent/90">
          {scene.status === "generating" || scene.waitingOnSceneId ? <Loader2 className="h-3 w-3 animate-spin" /> : scene.clipUrl ? <RefreshCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {scene.waitingOnSceneId ? "Waiting" : scene.clipUrl ? "Regen" : "Render"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Remove scene"><Trash2 className="h-4 w-4" /></button>
      </div>
      <input value={scene.location} onChange={(e) => onPatch({ location: e.target.value })} onClick={(e) => e.stopPropagation()} className="mb-3 w-full bg-transparent font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground outline-none" />
      <textarea value={scene.beat} onChange={(e) => onPatch({ beat: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Action beat…" rows={3} className="w-full resize-none bg-transparent text-lg leading-relaxed text-foreground outline-none placeholder:text-muted-foreground" />
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
        <select value={scene.speakerId || ""} onChange={(e) => onPatch({ speakerId: e.target.value || undefined })} onClick={(e) => e.stopPropagation()} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none">
          <option value="">No speaker</option>
          {cast.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <textarea value={scene.dialogue} onChange={(e) => onPatch({ dialogue: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Dialogue / voiceover…" rows={2} className="resize-none rounded-lg border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <MiniSelect value={scene.lens} options={["wide", "medium", "close", "macro", "aerial"]} onChange={(v) => onPatch({ lens: v as SceneDraft["lens"] })} />
        <MiniSelect value={scene.move} options={["static", "dolly", "pan", "tilt", "handheld", "crane"]} onChange={(v) => onPatch({ move: v as SceneDraft["move"] })} />
        <MiniSelect
          value={String(scene.duration)}
          options={ENGINES[scene.engine || "kling-v3"].durations.map(String)}
          suffix="s"
          onChange={(v) => onPatch({ duration: Number(v) as 5 | 10 | 12 | 15 })}
        />
      </div>
    </div>
  );
}

function MiniSelect({ value, options, suffix, onChange }: { value: string; options: string[]; suffix?: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()} className="h-8 rounded-lg border border-border bg-background/70 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground outline-none">
      {options.map(option => <option key={option} value={option}>{option}{suffix}</option>)}
    </select>
  );
}

function StatusPill({ status, waiting }: { status: SceneDraft["status"]; waiting?: boolean }) {
  const styles: Record<SceneDraft["status"], string> = {
    idle: "bg-muted text-muted-foreground",
    queued: "bg-warning/15 text-warning",
    generating: "bg-accent/15 text-accent",
    done: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
  };
  const label = waiting ? "waiting" : status;
  const cls = waiting ? "bg-warning/15 text-warning" : styles[status];
  return <span className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", cls)}>{label}</span>;
}

function ClipCard({ scene, active, onSelect, onRender }: { scene: SceneDraft; active: boolean; onSelect: () => void; onRender: () => void }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card/55 transition-all", active ? "border-accent/60" : "border-border")}> 
      <button onClick={onSelect} className="relative block aspect-video w-full bg-muted text-left">
        {scene.clipUrl ? <video src={scene.clipUrl} muted playsInline className="h-full w-full object-cover" /> : scene.refImageUrl ? <img src={scene.refImageUrl} alt={scene.location} className="h-full w-full object-cover opacity-80" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-8 w-8 text-muted-foreground" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">{String(scene.index + 1).padStart(2, "0")}</span>
          <StatusPill status={scene.status} waiting={!!scene.waitingOnSceneId} />
        </div>
      </button>
      <div className="p-4">
        <div className="truncate text-sm font-medium text-foreground">{scene.location}</div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{scene.beat || scene.dialogue || "No description"}</p>
        {scene.status === "failed" && scene.errorReason && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-snug text-destructive">
            <div className="mb-0.5 font-mono uppercase tracking-[0.16em] opacity-80">Render blocked</div>
            <div className="text-destructive/90">{scene.errorReason}</div>
          </div>
        )}
        <button onClick={onRender} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground hover:bg-card">
          {scene.status === "generating" ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <RefreshCw className="h-4 w-4 text-accent" />}
          {scene.clipUrl ? "Regenerate" : "Render"}
        </button>
      </div>
    </div>
  );
}

function StagePreview({ scene, draft, renderedCount, totalCost, onRender, onOpenEditor }: { scene?: SceneDraft; draft: StudioDraft; renderedCount: number; totalCost: number; onRender: () => void; onOpenEditor: () => void }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Preview
          </div>
          <StatusPill status={scene?.status || "idle"} />
        </div>
        <div className="relative aspect-video overflow-hidden rounded-sm bg-[hsl(220_16%_5%)]">
          {scene?.clipUrl ? <video src={scene.clipUrl} controls playsInline className="h-full w-full object-cover" /> : scene?.refImageUrl || draft.brief.refImageUrl ? <img src={scene?.refImageUrl || draft.brief.refImageUrl} alt="Current reference" className="h-full w-full object-cover opacity-80" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.2} /></div>}
        </div>
        <div className="mt-4 space-y-2">
          <button onClick={onRender} disabled={!scene} className="flex w-full items-center justify-center gap-2 rounded-none bg-accent px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-foreground transition-colors hover:bg-[hsl(215_100%_52%)] disabled:opacity-30">
            <Play className="h-3.5 w-3.5" /> Render selected
          </button>
          <button onClick={onOpenEditor} disabled={!renderedCount} className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30">
            <Send className="h-3.5 w-3.5 text-accent" /> Send to editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-8 gap-x-4 pt-4">
        <Metric label="Scenes" value={String(draft.scenes.length)} />
        <Metric label="Rendered" value={String(renderedCount)} />
        <Metric label="Cast" value={String(draft.cast.length)} />
        <Metric label="Credits est." value={String(totalCost)} />
      </div>

      <div className="relative border-t border-border/40 pt-4">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-medium tracking-tight text-foreground/95">
          <BadgeCheck className="h-3.5 w-3.5 text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.6)]" strokeWidth={1.5} /> Pipeline connected
        </div>
        <div className="space-y-2 text-[12px] font-light text-muted-foreground/80">
          <div className="flex justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/55">Engine</span><span className="text-foreground/80 truncate">{ENGINES[draft.defaults.engine].label}</span></div>
          <div className="flex justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/55">Aspect</span><span className="text-foreground/80">{draft.defaults.aspect}</span></div>
          <div className="flex justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/55">Voice</span><span className="text-foreground/80 truncate">{draft.defaults.voiceId || "Auto / default"}</span></div>
          <div className="flex justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/55">Music</span><span className="text-foreground/80">{draft.audio.scoreUrl ? "Generated" : "Optional"}</span></div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/55">{label}</div>
      <div className="font-display text-[28px] font-light italic leading-none tracking-[-0.02em] text-foreground/95">{value}</div>
    </div>
  );
}

// ============================================================================
// EnginePillRail — Inline engine selector that exposes Kling, Seedance, Veo,
// Runway and Sora directly on Step 1 so users never have to hunt for the
// engine drawer. Each pill is glassmorphic with a tier dot and live cost.
// ============================================================================
function EnginePillRail({ selected, onSelect, onMore, hasCinema }: { selected: EngineId; onSelect: (id: EngineId) => void; onMore: () => void; hasCinema?: boolean }) {
  const engines = listEngines({ healthyOnly: false });
  const tierColor: Record<string, string> = {
    standard: "bg-foreground/40",
    pro: "bg-accent shadow-[0_0_8px_hsl(var(--accent))]",
    cinema: "bg-amber-400 shadow-[0_0_8px_hsl(45_90%_55%/0.7)]",
  };
  return (
    <div className="relative pt-8">
      <div className="mb-5 flex items-center justify-between border-t border-border/40 pt-6">
        <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
          <Cpu className="h-3 w-3" strokeWidth={1.5} />
          Render engine
        </div>
        <button onClick={onMore} className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground">
          Compare all →
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {engines.map((e) => {
          const active = selected === e.id;
          const locked = e.requiresEntitlement === "studio_cinema" && !hasCinema;
          let cost: number | null = null;
          try { cost = e.baseCreditsFor(e.durations[0]); } catch { cost = null; }
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              disabled={!e.healthy}
              title={locked ? `${e.shortLabel} requires Studio Cinema` : undefined}
              className={cn(
                "group relative inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm transition-all",
                active
                  ? "border-accent/60 bg-accent/[0.06] text-foreground"
                  : "border-border/50 bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                !e.healthy && "cursor-not-allowed opacity-30",
                locked && "opacity-60",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", tierColor[e.tier] || "bg-foreground/40")} />
              <span className="font-display text-[14px] italic">{e.shortLabel}</span>
              {locked && <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400/80">PRO</span>}
              {cost != null && (
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60 group-hover:text-foreground/60">
                  {cost}c
                </span>
              )}
              {active && <Check className="h-3 w-3 text-accent" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/50">
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-foreground/40" /> Standard</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-accent" /> Pro</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-amber-400" /> Cinema</span>
      </div>
    </div>
  );
}

// ============================================================================
// SceneRuntimeControls — explicit scene count stepper + per-scene duration
// segmented picker. Surfaces controls on Step 1 so users never have to guess
// total runtime. Bounds: engine.maxScenesPerProject and engine.durations.
// ============================================================================
function SceneRuntimeControls({
  engineId,
  sceneCount,
  duration,
  onSceneCountChange,
  onDurationChange,
}: {
  engineId: EngineId;
  sceneCount: number;
  duration: number;
  onSceneCountChange: (n: number) => void;
  onDurationChange: (seconds: number) => void;
}) {
  const engine = ENGINES[engineId];
  const maxScenes = engine?.maxScenesPerProject ?? 8;
  const durations = engine?.durations ?? [5, 10];
  const safeCount = Math.max(1, Math.min(maxScenes, sceneCount));
  const safeDuration = durations.includes(duration) ? duration : durations[0];
  const total = safeCount * safeDuration;
  return (
    <div className="relative pt-8">
      <div className="mb-5 flex items-center justify-between border-t border-border/40 pt-6">
        <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
          <Timer className="h-3 w-3" strokeWidth={1.5} />
          Scenes &amp; runtime
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          {safeCount} × {safeDuration}s · <span className="text-foreground">{total}s total</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scene count stepper */}
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">Scene count</div>
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => onSceneCountChange(Math.max(1, safeCount - 1))}
              disabled={safeCount <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-foreground transition-all hover:border-accent hover:text-accent disabled:opacity-30"
              aria-label="Decrease scene count"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-[72px] px-3 text-center">
              <div className="font-display text-2xl italic leading-none text-foreground">{safeCount}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50">/ {maxScenes} max</div>
            </div>
            <button
              onClick={() => onSceneCountChange(Math.min(maxScenes, safeCount + 1))}
              disabled={safeCount >= maxScenes}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-foreground transition-all hover:border-accent hover:text-accent disabled:opacity-30"
              aria-label="Increase scene count"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Per-scene duration picker */}
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">Seconds per scene</div>
          <div className="inline-flex flex-wrap items-center gap-4">
            {durations.map((d) => {
              const active = d === safeDuration;
              return (
                <button
                  key={d}
                  onClick={() => onDurationChange(d)}
                  className={cn(
                    "relative pb-1 text-sm transition-colors",
                    active ? "text-accent" : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  <span className="font-display italic">{d}s</span>
                  {active && <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-accent" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/50">
            {engine.shortLabel} supports {durations.join(" / ")}s
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// StartHero — Cinematic editorial canvas modeled after the landing-page
// Studio preview ("Tell me about your film"). Wraps the entire Step-01 flow
// in a single mac-window surface with chrome bar, hero composer, live cast
// + world preview, advanced engine/runtime controls and a CTA strip.
// ============================================================================
function StartHero({
  draft,
  setDraft,
  createMode,
  setCreateMode,
  fileInputRef,
  onFileChange,
  uploading,
  autoBusy,
  canGenerateScript,
  canRender,
  totalCost,
  renderedCount,
  hasCinema,
  onAutoCreate,
  onRunScript,
  onRenderAll,
  onSetStep,
  onOpenDrawer,
  onClearImage,
  onInspectScene,
}: {
  draft: StudioDraft;
  setDraft: (mut: (d: StudioDraft) => StudioDraft) => void;
  createMode: "text" | "image" | "template";
  setCreateMode: (m: "text" | "image" | "template") => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  autoBusy: boolean;
  canGenerateScript: boolean;
  canRender: boolean;
  totalCost: number;
  renderedCount: number;
  hasCinema: boolean;
  onAutoCreate: () => void;
  onRunScript: (opts?: { renderAfter?: boolean }) => void;
  onRenderAll: () => void;
  onSetStep: (id: "start" | "cast" | "script" | "clips") => void;
  onOpenDrawer: (key: DrawerKey) => void;
  onClearImage: () => void;
  onInspectScene: (sceneId: string) => void;
}) {
  const projectSlug = (draft.brief.title || "new-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "new-project";

  const briefLabel = createMode === "text" ? "Brief" : createMode === "image" ? "Image → Video" : "Template";
  const modeCopy = createMode === "text"
    ? "Tell me about your film."
    : createMode === "image"
      ? "One frame, the whole scene."
      : "Pick a structure, make it yours.";

  const placeholder = createMode === "text"
    ? "4th-wall break — Emma turns to camera and addresses the viewer"
    : createMode === "image"
      ? "Animate the uploaded frame — slow dolly forward, light bends through the scene"
      : "Describe the spin — tone, era, hero moment";

  const castPills = draft.cast.length ? `${draft.cast.length} avatar${draft.cast.length === 1 ? "" : "s"}` : "Auto-cast";
  const worldLabel = draft.brief.style || "Cinematic";
  const engineSpec = ENGINES[draft.defaults.engine];
  const envLabel = draft.brief.environmentId || "Auto world";
  const voiceLabel = draft.defaults.voiceId ? `Voice · ${draft.defaults.voiceId.slice(0, 12)}` : "Voice · auto";
  const scoreLabel = draft.audio.scoreUrl ? "Score · ready" : "Score · auto";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[1180px]"
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Ambient cinematic atmosphere */}
      <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10">
        <div className="absolute left-[8%] top-[10%] h-[420px] w-[420px] rounded-full bg-[hsl(215_100%_55%/0.18)] blur-[140px]" />
        <div className="absolute right-[4%] bottom-[8%] h-[360px] w-[360px] rounded-full bg-[hsl(215_100%_60%/0.10)] blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,hsl(var(--foreground)/0.06),transparent_60%)]" />
      </div>

      <div className="group/canvas relative overflow-hidden rounded-[28px] border border-border/40 bg-gradient-to-b from-card/50 via-card/20 to-card/5 backdrop-blur-2xl shadow-[0_80px_200px_-50px_hsl(0_0%_0%/0.7),0_30px_80px_-30px_hsl(215_100%_50%/0.18),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        {/* Subtle grain */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")" }} />
        {/* Inner luminous frame */}
        <div aria-hidden className="pointer-events-none absolute inset-px rounded-[27px] ring-1 ring-inset ring-[hsl(var(--foreground)/0.04)]" />
        {/* Corner registration marks */}
        <div aria-hidden className="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l border-t border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r border-t border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute left-4 bottom-4 h-3 w-3 border-l border-b border-accent/40" />
        <div aria-hidden className="pointer-events-none absolute right-4 bottom-4 h-3 w-3 border-r border-b border-accent/40" />

        {/* ===== Title bar — editorial slate ===== */}
        <div className="flex items-center gap-3 border-b border-border/30 bg-[hsl(var(--foreground)/0.015)] px-6 h-12">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="mx-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
            <span className="text-accent/80">◆</span>
            <span>apex</span>
            <span className="text-muted-foreground/30">·</span>
            <span>studio</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-foreground/85">{projectSlug}</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">REC · 01:01</div>
        </div>

        <div className="px-6 py-8 md:px-12 md:py-12 xl:px-16 xl:py-14">
          {/* ===== Mode switcher ===== */}
          <div className="mb-10 flex items-center justify-between gap-6 border-b border-border/30 pb-5">
            <div className="flex items-center gap-8">
              {([
                { id: "text", label: "Text", Icon: Wand2 },
                { id: "image", label: "Image", Icon: ImageIcon },
                { id: "template", label: "Template", Icon: Images },
              ] as const).map(({ id, label, Icon }) => {
                const active = createMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setCreateMode(id);
                      if (id === "image") setTimeout(() => fileInputRef.current?.click(), 60);
                      else if (id === "template") onOpenDrawer("templates");
                      else setDraft(d => ({ ...d, brief: { ...d.brief, refImageUrl: undefined, templateId: undefined } }));
                    }}
                    className={cn(
                      "relative inline-flex items-center gap-2 pb-4 text-[12px] uppercase tracking-[0.18em] transition-colors",
                      active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground/90",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 transition-colors", active ? "text-accent" : "text-muted-foreground/50")} strokeWidth={1.5} />
                    <span>{label}</span>
                    {active && (
                      <motion.span
                        layoutId="mode-underline"
                        className="absolute -bottom-[21px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="hidden items-center gap-3 font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/40 sm:flex">
              <span>SC.01</span>
              <span className="h-px w-6 bg-border/60" />
              <span>TAKE.01</span>
            </div>
          </div>

          {/* ===== Eyebrow + hero headline ===== */}
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-accent/80">
            <span className="h-px w-8 bg-accent/40" />
            <span>Step 01 · {briefLabel}</span>
          </div>
          <h1
            className="mt-5 font-display leading-[0.98] tracking-[-0.025em] text-foreground text-[42px] md:text-[64px] xl:text-[76px]"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
          >
            <span className="italic font-light bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
              {modeCopy}
            </span>
          </h1>
          <p className="mt-5 max-w-xl font-light text-[14px] leading-relaxed text-muted-foreground/70">
            Direct from a single prompt. We&rsquo;ll cast the actors, build the world, score the room, and render to film-grade clips.
          </p>

          {/* ===== Composer card ===== */}
          <div className="group/composer mt-10 relative rounded-[20px] border border-border/40 bg-gradient-to-b from-background/60 to-background/20 p-6 backdrop-blur-xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05),0_30px_80px_-40px_hsl(0_0%_0%/0.6)] transition-all focus-within:border-accent/40 focus-within:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05),0_0_0_1px_hsl(var(--accent)/0.25),0_40px_120px_-30px_hsl(var(--accent)/0.35)]">
            {/* Project title — required (also editable in header, mirrored here for prominence) */}
            <div className="mb-5 flex items-center gap-3 border-b border-border/30 pb-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/50">Title</span>
              <input
                value={draft.brief.title}
                onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, title: e.target.value } }))}
                placeholder="Name your film…"
                className="flex-1 bg-transparent text-[18px] md:text-[22px] italic tracking-tight text-foreground outline-none placeholder:text-muted-foreground/35"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
              />
              {draft.brief.title && (
                <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-accent/70">✓ saved</span>
              )}
            </div>

            <div className="flex items-start gap-5">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 ring-1 ring-inset ring-accent/30">
                <Wand2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <div className="absolute inset-0 rounded-xl bg-accent/20 blur-md -z-10" />
              </div>
              <textarea
                value={draft.brief.logline}
                onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, logline: e.target.value } }))}
                placeholder={placeholder}
                rows={2}
                className="flex-1 min-h-[68px] resize-none bg-transparent text-[17px] md:text-[19px] font-light leading-[1.55] tracking-[-0.005em] text-foreground outline-none placeholder:text-muted-foreground/40"
                style={{ fontFamily: "'Fraunces', serif" }}
              />
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <button
                  onClick={() => onOpenDrawer("voices")}
                  title="Voices"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-background/40 text-muted-foreground/80 transition-all hover:border-accent/40 hover:text-foreground hover:bg-background/60"
                >
                  <Mic2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Reference image"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-background/40 text-muted-foreground/80 transition-all hover:border-accent/40 hover:text-foreground hover:bg-background/60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" strokeWidth={1.5} />}
                </button>
                <button
                  onClick={() => onRunScript()}
                  disabled={!canGenerateScript || autoBusy}
                  className="group/gen relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-accent to-[hsl(215_100%_42%)] px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-accent-foreground shadow-[0_8px_24px_-8px_hsl(var(--accent)/0.6),inset_0_1px_0_0_hsl(var(--foreground)/0.2)] transition-all hover:shadow-[0_12px_36px_-8px_hsl(var(--accent)/0.8),inset_0_1px_0_0_hsl(var(--foreground)/0.25)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {autoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Generate <Send className="h-3.5 w-3.5" strokeWidth={1.75} /></>}
                </button>
              </div>
            </div>

            {/* Pill controls — live state */}
            <div className="mt-7 flex flex-wrap items-center gap-1.5 border-t border-border/30 pt-5">
              <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/40">Set</span>
              {[
                { Icon: Sparkles, label: draft.brief.style || "Cinematic", onClick: () => onOpenDrawer("styles") },
                { Icon: Users, label: castPills, onClick: () => onOpenDrawer("avatars") },
                { Icon: Box, label: envLabel, onClick: () => onOpenDrawer("envs") },
                { Icon: Music2, label: scoreLabel, onClick: () => onOpenDrawer("music") },
                { Icon: Languages, label: voiceLabel, onClick: () => onOpenDrawer("voices") },
                { Icon: Hash, label: draft.defaults.aspect, onClick: () => {
                  const order: StudioDraft["defaults"]["aspect"][] = ["16:9", "9:16", "1:1", "21:9"];
                  const next = order[(order.indexOf(draft.defaults.aspect) + 1) % order.length];
                  setDraft(d => ({ ...d, defaults: { ...d.defaults, aspect: next } }));
                } },
                { Icon: Cpu, label: engineSpec.shortLabel, onClick: () => onOpenDrawer("engines") },
                { Icon: Timer, label: `${draft.defaults.duration}s/scene`, onClick: () => {
                  const opts = [5, 10, 15] as const;
                  const next = opts[(opts.indexOf(draft.defaults.duration as 5|10|15) + 1) % opts.length];
                  const clamped = clampDurationForEngine(draft.defaults.engine, next) as 5 | 10 | 12 | 15;
                  setDraft(d => ({ ...d, defaults: { ...d.defaults, duration: clamped }, scenes: d.scenes.map(s => ({ ...s, duration: clamped })) }));
                } },
                { Icon: Film, label: `${draft.defaults.sceneCount ?? ENGINES[draft.defaults.engine].recommendedScenes} scenes`, onClick: () => {
                  const max = ENGINES[draft.defaults.engine].maxScenesPerProject;
                  const current = draft.defaults.sceneCount ?? ENGINES[draft.defaults.engine].recommendedScenes;
                  const next = current >= max ? 1 : current + 1;
                  setDraft(d => ({ ...d, defaults: { ...d.defaults, sceneCount: next }, scenes: d.scenes.slice(0, next) }));
                } },
              ].map(({ Icon, label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="group/pill inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/30 px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground/85 transition-all hover:border-accent/40 hover:bg-background/60 hover:text-foreground hover:shadow-[0_4px_12px_-4px_hsl(var(--accent)/0.3)]"
                >
                  <Icon className="h-3 w-3 text-accent/80 transition-colors group-hover/pill:text-accent" strokeWidth={1.75} /> {label}
                </button>
              ))}
            </div>

            {/* Empty-state seeds */}
            {!draft.brief.logline && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-border/30 pt-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/50">Try</span>
                {[
                  { label: "Tokyo neon", prompt: "A vintage car drifts through Tokyo neon at 3am" },
                  { label: "Espresso macro", prompt: "Slow-motion espresso pour, macro, golden light" },
                  { label: "Snow drone", prompt: "Drone over snow-capped peaks at dawn" },
                  { label: "Rainy walk", prompt: "Streetwear model walks toward camera, rain, slow-mo" },
                ].map(({ label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => setDraft(d => ({ ...d, brief: { ...d.brief, logline: prompt } }))}
                    className="h-7 rounded-full border border-border/30 px-3 text-[11px] italic text-muted-foreground/75 transition-all hover:border-accent/50 hover:bg-accent/[0.06] hover:text-foreground"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    "{label}"
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== Image-mode preview slot ===== */}
          {createMode === "image" && draft.brief.refImageUrl && (
            <div className="mt-8 relative overflow-hidden rounded-2xl border border-border/40 shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.7)]">
              <img src={draft.brief.refImageUrl} alt="Reference" className="aspect-[21/9] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.36em] text-foreground/80">◆ REF · 01</span>
                <button onClick={onClearImage} className="h-8 rounded-full border border-border/60 bg-background/70 px-3 text-[11px] text-foreground backdrop-blur hover:bg-card">Remove</button>
              </div>
            </div>
          )}

          {/* ===== Cast + World — blank slate, user fills in ===== */}
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {/* Cast */}
            <button
              onClick={() => onOpenDrawer("avatars")}
              className="group relative flex min-h-[160px] items-center gap-5 rounded-2xl border border-border/40 bg-card/30 p-5 text-left transition-colors hover:border-accent/50 hover:bg-card/50"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border/70 text-muted-foreground/70 transition-colors group-hover:border-accent group-hover:text-accent">
                <Users className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">Cast</div>
                <div className="mt-1.5 font-display text-[18px] leading-tight text-foreground" style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}>
                  {draft.cast.length
                    ? `${draft.cast.length} ${draft.cast.length === 1 ? "actor" : "actors"} cast`
                    : "Add an actor"}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  {draft.cast.length ? draft.cast.map(c => c.name).filter(Boolean).slice(0, 3).join(" · ") || "Cast set" : "Library, upload, or generate"}
                </div>
              </div>
              {draft.cast.length > 0 && (
                <div className="flex -space-x-2">
                  {draft.cast.slice(0, 3).map((c, i) => (
                    <div key={i} className="h-9 w-9 overflow-hidden rounded-full border-2 border-card ring-1 ring-border/60">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                        : <div className="h-full w-full bg-muted" />}
                    </div>
                  ))}
                </div>
              )}
            </button>

            {/* World */}
            <button
              onClick={() => onOpenDrawer("envs")}
              className="group relative flex min-h-[160px] items-center gap-5 rounded-2xl border border-border/40 bg-card/30 p-5 text-left transition-colors hover:border-accent/50 hover:bg-card/50"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border/70 text-muted-foreground/70 transition-colors group-hover:border-accent group-hover:text-accent">
                <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">World</div>
                <div className="mt-1.5 font-display text-[18px] leading-tight text-foreground" style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}>
                  {draft.brief.environmentId || "Set the location"}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  {draft.brief.environmentId ? "Tap to change" : "Pick a world or upload a still"}
                </div>
              </div>
            </button>
          </div>

          {/* ===== Engine pill rail ===== */}
          <div className="mt-14 border-t border-border/30 pt-10">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-muted-foreground/60">
              <span className="h-px w-8 bg-border" />
              <span>Engine</span>
            </div>
            <EnginePillRail
              selected={draft.defaults.engine}
              hasCinema={hasCinema}
              onSelect={(id) => setDraft(d => {
                const spec = ENGINES[id];
                const newDuration = clampDurationForEngine(id, d.defaults.duration) as 5 | 10 | 12 | 15;
                return {
                  ...d,
                  defaults: { ...d.defaults, engine: id, duration: newDuration, sceneCount: Math.min(d.defaults.sceneCount ?? spec.recommendedScenes, spec.maxScenesPerProject), qualityProfileId: defaultQualityProfile(id).id },
                  scenes: d.scenes.slice(0, spec.maxScenesPerProject).map(scene => ({
                    ...scene,
                    engine: id,
                    duration: clampDurationForEngine(id, scene.duration) as 5 | 10 | 12 | 15,
                  })),
                };
              })}
              onMore={() => onOpenDrawer("engines")}
            />
          </div>

          {/* ===== Scene / runtime controls ===== */}
          <div className="mt-4">
            <SceneRuntimeControls
              engineId={draft.defaults.engine}
              sceneCount={draft.defaults.sceneCount ?? ENGINES[draft.defaults.engine].recommendedScenes}
              duration={draft.defaults.duration}
              onSceneCountChange={(n) => setDraft(d => {
                const maxScenes = ENGINES[d.defaults.engine].maxScenesPerProject;
                const sceneCount = Math.max(1, Math.min(maxScenes, n));
                return { ...d, defaults: { ...d.defaults, sceneCount }, scenes: d.scenes.slice(0, sceneCount) };
              })}
              onDurationChange={(s) => setDraft(d => ({
                ...d,
                defaults: { ...d.defaults, duration: s as 5 | 10 | 12 | 15 },
                scenes: d.scenes.map(scene => ({ ...scene, duration: s as 5 | 10 | 12 | 15 })),
              }))}
            />
          </div>

          {/* ===== Advanced action tiles ===== */}
          <div className="mt-12 border-t border-border/30 pt-10">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-muted-foreground/60">
              <span className="h-px w-8 bg-border" />
              <span>Craft</span>
            </div>
            <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
            <ActionTile icon={Images} title="Templates" body="Hand-crafted blueprints, fully editable." onClick={() => { setCreateMode("template"); onOpenDrawer("templates"); }} />
            <ActionTile icon={ImageIcon} title="Environments" body="Anchor a world or location." onClick={() => onOpenDrawer("envs")} />
            <ActionTile icon={Sparkles} title="Visual style" body={draft.brief.style || "Noir, anime, neon, golden hour…"} onClick={() => onOpenDrawer("styles")} />
            <ActionTile icon={Music2} title="Score & voice" body={draft.audio.scoreUrl ? "Score ready" : "Pick the sonic palette early."} onClick={() => onOpenDrawer("music")} />
            </div>
          </div>

          {/* ===== Roll Camera — editorial slate ===== */}
          <section aria-label="Roll camera" className="mt-16 border-t border-border/40 pt-10">
            {/* Slate header — director's marker, not a marketing card */}
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-muted-foreground/70">
                Scene · 001 / Take · 01
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/50">
                {new Date().toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}
              </div>
            </div>

            <h2
              className="mt-5 font-display text-[30px] sm:text-[38px] md:text-[44px] leading-[0.98] tracking-[-0.025em] text-foreground"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
            >
              <span className="italic">Roll</span> camera.
            </h2>
            <p className="mt-3 max-w-md font-light text-[13px] leading-relaxed text-muted-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              When you're ready, we shoot what you've written — nothing more, nothing less.
            </p>

            {/* Ledger — three honest numbers, no glass, no glow */}
            <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-6 border-y border-border/40 py-6">
              {[
                { label: "Scenes", value: String(draft.scenes.length || (draft.defaults.sceneCount ?? 0)) },
                { label: "Rendered", value: `${renderedCount}` },
                { label: "Credits", value: String(totalCost), accent: true },
              ].map((m) => (
                <div key={m.label} className="flex flex-col">
                  <span className="font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/60">{m.label}</span>
                  <span
                    className={cn(
                      "mt-1 font-display text-[28px] leading-none tabular-nums",
                      m.accent ? "text-accent" : "text-foreground",
                    )}
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Pipeline monitor — live status, retries, terminal reasons */}
            <PipelineMonitor
              scenes={draft.scenes}
              onInspect={(id) => { onInspectScene(id); }}
            />

            {/* Action row — render button sized to text, never overflowing */}
            <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => onSetStep("cast")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                Edit cast &amp; script
              </button>
              <button
                onClick={() => (draft.scenes.length ? onRenderAll() : onAutoCreate())}
                disabled={(!canGenerateScript && !canRender) || autoBusy}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6 sm:text-[11px] sm:tracking-[0.22em] sm:gap-2.5"
              >
                {autoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />}
                <span className="truncate">{draft.scenes.length ? "Approve & render" : "Auto create"}</span>
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ApprovalGate — mandatory script + credit estimate confirmation. Renders a
// centered modal listing every scene the customer is about to pay to render,
// the per-scene credit cost, the total, and their current balance. No render
// dispatches until this is explicitly approved.
// ============================================================================
function ApprovalGate({
  open,
  loading,
  scenes,
  cast,
  defaults,
  totalCost,
  balance,
  onClose,
  onApprove,
  onEditScript,
  onBuyCredits,
}: {
  open: boolean;
  loading: boolean;
  scenes: SceneDraft[];
  cast: CastMember[];
  defaults: StudioDraft["defaults"];
  totalCost: number;
  balance: number | null;
  onClose: () => void;
  onApprove: () => void;
  onEditScript: () => void;
  onBuyCredits: () => void;
}) {
  if (!open) return null;
  const insufficient = balance !== null && balance < totalCost;
  const speakerName = (id?: string) => cast.find(c => c.id === id)?.name || "—";

  // ── Pre-flight cost analysis ──────────────────────────────────────────────
  // Resolve per-scene engine, quality profile, duration and credit cost so the
  // customer sees exactly what they're paying for BEFORE we reserve anything.
  const rows = scenes.map((s, i) => {
    const eid = s.engine || defaults.engine;
    const engine = ENGINES[eid];
    const profile = getQualityProfile(eid, defaults.qualityProfileId);
    let cost = 0;
    try { cost = creditsForScene(eid, s.duration, defaults.qualityProfileId); } catch { cost = 0; }
    return {
      key: s.id,
      index: i + 1,
      scene: s,
      engineLabel: engine.shortLabel,
      resolution: profile.resolution,
      fps: profile.fps,
      is4K: profile.resolution === "4K",
      duration: s.duration,
      cost,
    };
  });
  const totalRuntime = rows.reduce((a, r) => a + r.duration, 0);
  const total4KSeconds = rows.filter(r => r.is4K).reduce((a, r) => a + r.duration, 0);
  const usd = (totalCost * 0.1).toFixed(2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm script and credit cost"
        className="relative flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_60px_140px_-30px_hsl(0_0%_0%/0.8)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/40 px-6 py-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">Pre-flight · Cost analysis</div>
            <h2 className="mt-1 font-display text-xl text-foreground" style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}>
              Review engines, runtime, and the exact spend
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing renders and no credits are deducted until you approve. Edits invalidate this approval.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Summary tiles */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Engine", value: ENGINES[defaults.engine].shortLabel },
              { label: "Aspect", value: defaults.aspect },
              { label: "Runtime", value: `${totalRuntime}s` },
              { label: "4K output", value: `${total4KSeconds}s`, accent: total4KSeconds > 0 },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">{t.label}</div>
                <div className={cn(
                  "mt-1 font-display text-base tabular-nums",
                  t.accent ? "text-accent" : "text-foreground",
                )}>{t.value}</div>
              </div>
            ))}
          </div>

          {scenes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No scenes to render. Generate or write a script first.
            </div>
          ) : (
            <>
              {/* Column header — desktop only */}
              <div className="mb-2 hidden grid-cols-[28px_minmax(0,1fr)_88px_88px_64px_72px] items-center gap-3 px-3 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/60 md:grid">
                <span>#</span>
                <span>Scene</span>
                <span>Engine</span>
                <span>Resolution</span>
                <span className="text-right">Sec</span>
                <span className="text-right">Credits</span>
              </div>
              <ol className="space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.key}
                    className="rounded-lg border border-border/40 bg-background/40 px-3 py-3 md:grid md:grid-cols-[28px_minmax(0,1fr)_88px_88px_64px_72px] md:items-center md:gap-3"
                  >
                    {/* Index */}
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      {String(r.index).padStart(2, "0")}
                    </div>
                    {/* Scene body */}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-foreground">{r.scene.location || "—"}</div>
                      {r.scene.beat && (
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{r.scene.beat}</div>
                      )}
                      {r.scene.dialogue && (
                        <div className="mt-1 line-clamp-2 text-[12px] italic text-foreground/85">
                          <span className="not-italic text-muted-foreground">{speakerName(r.scene.speakerId)}: </span>
                          "{r.scene.dialogue}"
                        </div>
                      )}
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
                        {r.scene.lens}/{r.scene.move}
                      </div>
                    </div>
                    {/* Engine */}
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground md:mt-0">
                      <span className="md:hidden text-muted-foreground/60">Engine · </span>{r.engineLabel}
                    </div>
                    {/* Resolution */}
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] md:mt-0">
                      <span className="md:hidden text-muted-foreground/60">Res · </span>
                      <span className={r.is4K ? "text-accent" : "text-foreground"}>
                        {r.resolution} · {r.fps}fps
                      </span>
                    </div>
                    {/* Seconds */}
                    <div className="mt-1 font-mono text-[11px] tabular-nums text-foreground md:mt-0 md:text-right">
                      <span className="md:hidden text-muted-foreground/60">Sec · </span>{r.duration}s
                    </div>
                    {/* Credits */}
                    <div className="mt-1 font-display text-base tabular-nums text-accent md:mt-0 md:text-right">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 md:hidden">Credits · </span>
                      {r.cost}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <footer className="border-t border-border/40 px-6 py-5">
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Runtime</div>
              <div className="mt-1 font-display text-2xl tabular-nums text-foreground">{totalRuntime}<span className="text-sm text-muted-foreground">s</span></div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">4K output</div>
              <div className={cn("mt-1 font-display text-2xl tabular-nums", total4KSeconds > 0 ? "text-accent" : "text-foreground/60")}>
                {total4KSeconds}<span className="text-sm text-muted-foreground">s</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Total to reserve</div>
              <div className="mt-1 font-display text-2xl tabular-nums text-foreground">
                {totalCost}<span className="text-sm text-muted-foreground"> cr</span>
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70">≈ ${usd} USD</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Your balance</div>
              <div className={cn("mt-1 font-display text-2xl tabular-nums", insufficient ? "text-destructive" : "text-foreground")}>
                {loading ? "—" : (balance ?? "—")}
              </div>
            </div>
          </div>

          {insufficient && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[12px] text-destructive">
              Not enough credits. You need {totalCost - (balance ?? 0)} more to render every scene.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={onEditScript}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border/60 px-4 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              Edit script
            </button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
              {insufficient ? (
                <button
                  onClick={onBuyCredits}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-foreground hover:bg-accent/90"
                >
                  Buy credits
                </button>
              ) : (
                <button
                  onClick={onApprove}
                  disabled={scenes.length === 0 || loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[11px] font-medium uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve script &amp; deduct {totalCost} cr
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// PipelineMonitor — live status timeline for every scene. Renders the current
// state badge, last activity timestamp, and a collapsible timeline of every
// pipeline event (waiting, reserve, dispatch, Replicate ack, polling, retry,
// terminal failure with reason). This is the user's window into what the
// renderer is actually doing — so a stuck or out-of-sync render is obvious.
// ============================================================================
function PipelineMonitor({ scenes, onInspect }: { scenes: SceneDraft[]; onInspect?: (sceneId: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Re-render every 5s so "last activity 12s ago" stays honest while polling.
  useEffect(() => {
    const active = scenes.some(s => s.status === "queued" || s.status === "generating");
    if (!active) return;
    const t = setInterval(() => setTick(x => x + 1), 5000);
    return () => clearInterval(t);
  }, [scenes]);

  const recent = useMemo(() => {
    const all: Array<{ sceneIndex: number; ev: NonNullable<SceneDraft["events"]>[number] }> = [];
    scenes.forEach(s => (s.events || []).forEach(ev => all.push({ sceneIndex: s.index, ev })));
    return all.sort((a, b) => (a.ev.ts < b.ev.ts ? 1 : -1)).slice(0, 8);
  }, [scenes, tick]);

  if (!scenes.length) return null;

  return (
    <div className="mt-8 border-t border-border/30 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
          Pipeline monitor · live
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          replicate · supabase · webhook
        </div>
      </div>

      <div className="grid gap-2">
        {scenes.map(s => {
          const events = s.events || [];
          const last = events[events.length - 1];
          const isOpen = openId === s.id;
          return (
            <div key={s.id} className="rounded-lg border border-border/40 bg-background/40">
              <button
                onClick={() => setOpenId(isOpen ? null : s.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.02]"
              >
                <StatusDot status={s.status} />
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                  {String(s.index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-light text-[13px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                  {s.location || `Scene ${s.index + 1}`}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                  {s.status}
                </span>
                {s.predictionId && (
                  <span className="hidden font-mono text-[9px] text-muted-foreground/40 sm:inline">
                    pred {s.predictionId.slice(0, 6)}
                  </span>
                )}
                <span className="font-mono text-[9px] tabular-nums text-muted-foreground/40">
                  {last ? timeAgo(last.ts) : "—"}
                </span>
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/50 transition-transform", isOpen && "rotate-90")} />
              </button>
              {onInspect && (
                <div className="flex items-center justify-end gap-2 border-t border-border/20 bg-foreground/[0.01] px-3 py-1.5">
                  <button
                    onClick={() => onInspect(s.id)}
                    className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/70 transition-colors hover:text-accent"
                  >
                    Inspect in diagnostics →
                  </button>
                </div>
              )}

              {s.status === "failed" && s.errorReason && (
                <div className="border-t border-destructive/20 bg-destructive/[0.04] px-3 py-2 font-mono text-[10px] leading-relaxed text-destructive/90">
                  Reason · {s.errorReason}
                </div>
              )}

              {isOpen && (
                <div className="border-t border-border/30 bg-foreground/[0.015] px-3 py-3">
                  {events.length === 0 ? (
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/50">
                      No events yet — render hasn't dispatched
                    </div>
                  ) : (
                    <ol className="space-y-1.5">
                      {events.slice().reverse().map((ev, i) => (
                        <li key={`${ev.ts}-${i}`} className="flex items-start gap-3 font-mono text-[10px] leading-relaxed">
                          <span className="w-14 shrink-0 tabular-nums text-muted-foreground/50">
                            {new Date(ev.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                          </span>
                          <span className={cn("w-20 shrink-0 uppercase tracking-[0.18em]", kindColor(ev.kind))}>
                            {ev.kind}
                          </span>
                          <span className="min-w-0 flex-1 text-foreground/80">{ev.message}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recent.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 hover:text-foreground">
            Recent activity ({recent.length})
          </summary>
          <ol className="mt-3 space-y-1.5">
            {recent.map((r, i) => (
              <li key={`${r.ev.ts}-${i}`} className="flex items-start gap-3 font-mono text-[10px] leading-relaxed">
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground/50">
                  {new Date(r.ev.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
                <span className="w-8 shrink-0 text-muted-foreground/60">S{r.sceneIndex + 1}</span>
                <span className={cn("w-20 shrink-0 uppercase tracking-[0.18em]", kindColor(r.ev.kind))}>{r.ev.kind}</span>
                <span className="min-w-0 flex-1 text-foreground/80">{r.ev.message}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: SceneDraft["status"] }) {
  const cls =
    status === "done" ? "bg-emerald-400" :
    status === "failed" ? "bg-destructive" :
    status === "generating" ? "bg-accent animate-pulse" :
    status === "queued" ? "bg-amber-400 animate-pulse" :
    "bg-muted-foreground/40";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cls)} />;
}

function kindColor(kind: string) {
  switch (kind) {
    case "completed": return "text-emerald-400";
    case "failed": return "text-destructive";
    case "retry":
    case "waiting":
    case "queued": return "text-amber-400";
    case "dispatched":
    case "replicate_ack": return "text-accent";
    default: return "text-muted-foreground/70";
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}


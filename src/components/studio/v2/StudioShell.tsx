import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  ChevronRight,
  Clapperboard,
  Cpu,
  Edit3,
  Film,
  Image as ImageIcon,
  Images,
  Loader2,
  Mic2,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
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
import { ENGINES, listEngines, clampDurationForEngine, defaultQualityProfile, creditsForScene, type EngineId } from "@/lib/video/engines";
import { useCinemaEntitlement } from "@/hooks/useCinemaEntitlement";
import { StudioDrawer } from "./StudioDrawer";
import { AvatarsDrawerContent } from "./drawers/AvatarsDrawer";
import { EnginesDrawerContent } from "./drawers/EnginesDrawer";
import { EnvironmentsDrawerContent } from "./drawers/EnvironmentsDrawer";
import { MusicDrawerContent } from "./drawers/MusicDrawer";
import { TemplatesDrawerContent, type TemplatePick } from "./drawers/TemplatesDrawer";
import { VoicesDrawerContent } from "./drawers/VoicesDrawer";
import { StylesDrawerContent } from "./drawers/StylesDrawer";
import { newScene, type CastMember, type SceneDraft, type StudioDraft } from "./types";

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
    duration: (s.duration && [5, 10, 15].includes(Number(s.duration)) ? Number(s.duration) : draft.defaults.duration) as 5 | 10 | 15,
    lens: s.lens || "medium",
    move: s.move || "dolly",
    speakerId: draft.cast[0]?.id,
    refImageUrl: draft.brief.refImageUrl,
    engine: draft.defaults.engine,
  }));
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
        duration: ([5, 10, 15].includes(Number(shot.durationSeconds)) ? Number(shot.durationSeconds) : draft.defaults.duration) as 5 | 10 | 15,
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
  const { draft, setDraft, loading, saving, addScene, removeScene, patchScene, setActive, ensureProjectId } = useStudioDraft();
  const { appliedSettings, templateId, clearAppliedSettings } = useTemplateEnvironment();
  const { generateScene, generateSceneFromDraft } = useScenePipeline(draft, patchScene, ensureProjectId);
  const { data: cinemaEntitlement } = useCinemaEntitlement();
  const hasCinema = !!cinemaEntitlement?.hasEntitlement;
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [step, setStep] = useState<StepId>("start");
  const [autoBusy, setAutoBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createMode, setCreateMode] = useState<"text" | "image" | "template">(() => {
    if (draft.brief.templateId) return "template";
    if (draft.brief.refImageUrl) return "image";
    return "text";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
      const { data, error } = await supabase.functions.invoke("smart-script-generator", {
        body: {
          title: draft.brief.title || "Untitled film",
          logline: draft.brief.logline || "Create a cinematic sequence from the uploaded reference image.",
          style: draft.brief.style,
          sceneCount: Math.max(3, Math.min(6, draft.scenes.length || 4)),
          aspectRatio: draft.defaults.aspect,
          characters: draft.cast.map(c => ({ name: c.name })),
          referenceImageUrl: draft.brief.refImageUrl,
          engine: draft.defaults.engine,
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

  const renderAll = useCallback(async () => {
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .maybeSingle();
        const balance = (profile as any)?.credits_balance ?? 0;
        if (balance < totalCost) {
          toast.error(`Insufficient credits — ${totalCost} required, ${balance} available`, {
            action: { label: "Buy credits", onClick: () => navigate("/credits") },
          });
          return;
        }
      }
    } catch { /* non-fatal — server enforces final deduct */ }
    setStep("clips");
    for (const scene of draft.scenes) {
      if (!scene.clipUrl && scene.status !== "generating") {
        await generateScene(scene.id);
      }
    }
  }, [canRender, draft.scenes, draft.defaults.engine, generateScene, hasCinema, navigate, totalCost]);

  const autoCreate = useCallback(async () => {
    if (!draft.scenes.length) {
      await runAutoScript({ renderAfter: true });
      return;
    }
    await renderAll();
  }, [draft.scenes.length, renderAll, runAutoScript]);

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
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      {/* Cinematic background — vignette + accent halos + film grain */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(var(--accent)/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_85%_110%,hsl(var(--accent)/0.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_30%_30%_at_5%_5%,hsl(var(--accent)/0.06),transparent_70%)]" />
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      </div>

      <header className="relative z-10 flex h-[72px] items-center gap-6 border-b border-border/50 bg-background/50 px-6 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 shadow-[0_0_32px_hsl(var(--accent)/0.4)]">
            <Film className="h-4 w-4 text-accent" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
          </div>
          <div className="min-w-0 border-l border-border/50 pl-4">
            <input
              value={draft.brief.title}
              onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, title: e.target.value } }))}
              placeholder="Untitled film"
              className="w-72 max-w-[30vw] bg-transparent font-display text-lg italic tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/70">A Cinematic Workflow · est. 2026</div>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1.5">
            {STEPS.map(({ id, label }, index) => {
              const active = step === id;
              const complete = id === "start" ? canGenerateScript : id === "cast" ? draft.cast.length > 0 : id === "script" ? draft.scenes.length > 0 : renderedCount > 0;
              return (
                <div key={id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStep(id)}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-full px-4 transition-all",
                      active ? "bg-accent/[0.08] ring-1 ring-accent/40 shadow-[0_0_24px_hsl(var(--accent)/0.25)]" : "hover:bg-card/50",
                    )}
                  >
                    <span className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] transition-colors",
                      active ? "bg-accent text-accent-foreground" : complete ? "bg-success/20 text-success" : "border border-border text-muted-foreground",
                    )}>
                      {complete && !active ? <Check className="h-3 w-3" /> : String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("font-mono text-[10px] uppercase tracking-[0.24em]", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{label}</span>
                  </button>
                  {index < STEPS.length - 1 && <span className="h-px w-6 bg-border/70" />}
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
          <button onClick={() => setDrawer("engines")} className="hidden h-10 items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 text-sm text-foreground/90 transition-all hover:border-accent/40 hover:bg-card md:flex">
            <Cpu className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{ENGINES[draft.defaults.engine].shortLabel}</span>
          </button>
          <button
            onClick={autoCreate}
            disabled={autoBusy || uploading || !canGenerateScript}
            className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground shadow-[0_0_36px_hsl(var(--accent)/0.45)] transition-all hover:shadow-[0_0_52px_hsl(var(--accent)/0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <span className="absolute inset-y-0 -left-12 w-12 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
            {autoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="relative">Auto create</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 grid h-[calc(100vh-72px)] grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="hidden border-r border-border/50 bg-background/30 p-6 backdrop-blur-xl lg:block">
          <div className="mb-8">
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-accent/80">Production</div>
            <h2 className="mt-2 font-display text-2xl italic leading-tight text-foreground">One continuous flow.</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">From a single image or sentence to rendered cinematic clips, ready for the editor.</p>
          </div>
          <div className="relative">
            <div className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-accent/50 via-border to-border/30" />
            <div className="space-y-1">
              {STEPS.map(({ id, label, icon: Icon }, index) => {
                const active = step === id;
                const complete = id === "start" ? canGenerateScript : id === "cast" ? draft.cast.length > 0 : id === "script" ? draft.scenes.length > 0 : renderedCount > 0;
                return (
                  <button
                    key={id}
                    onClick={() => setStep(id)}
                    className={cn(
                      "group relative flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition-all",
                      active ? "bg-accent/[0.05]" : "hover:bg-card/40",
                    )}
                  >
                    <span className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-[10px] transition-all",
                      active ? "border-accent bg-background text-accent shadow-[0_0_20px_hsl(var(--accent)/0.55)]"
                        : complete ? "border-success/60 bg-background text-success"
                        : "border-border bg-background text-muted-foreground",
                    )}>
                      {complete && !active ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-mono text-[9px] uppercase tracking-[0.28em]", active ? "text-accent" : "text-muted-foreground/70")}>Phase {index + 1}</div>
                      <div className={cn("mt-0.5 flex items-center gap-1.5 text-sm", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </div>
                    </div>
                    {active && <span className="h-8 w-0.5 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent))]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 border-t border-border/50 pt-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">Now playing</div>
            <div className="mt-2 truncate text-sm italic text-foreground">{draft.brief.title || "Untitled film"}</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">{draft.scenes.length.toString().padStart(2,"0")} scenes · {draft.cast.length.toString().padStart(2,"0")} cast</div>
          </div>
        </aside>

        <section className="overflow-y-auto p-4 premium-scroll md:p-7">
          <AnimatePresence mode="wait">
            {step === "start" && (
              <FlowPanel
                key="start"
                eyebrow={createMode === "text" ? "Step 01 · Text → Video" : createMode === "image" ? "Step 01 · Image → Video" : "Step 01 · Template"}
                title={createMode === "text"
                  ? <>From a single sentence, <em className="not-italic bg-gradient-to-br from-foreground via-accent/80 to-accent bg-clip-text text-transparent" style={{ fontStyle: "italic" }}>a finished film.</em></>
                  : createMode === "image"
                    ? <>One frame becomes <em className="not-italic bg-gradient-to-br from-foreground via-accent/80 to-accent bg-clip-text text-transparent" style={{ fontStyle: "italic" }}>the entire scene.</em></>
                    : <>Hand-crafted blueprints, <em className="not-italic bg-gradient-to-br from-foreground via-accent/80 to-accent bg-clip-text text-transparent" style={{ fontStyle: "italic" }}>made yours.</em></>
                }
                icon={Sparkles}
              >
                {/* ===== Cinematic ambience: drifting orbs, scanlines, hairline crosshairs ===== */}
                <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-[640px] w-[640px] rounded-full opacity-60 blur-3xl animate-pulse" style={{ background: "radial-gradient(circle, hsla(212,100%,50%,0.20), transparent 65%)", animationDuration: "9s" }} />
                <div aria-hidden className="pointer-events-none absolute -right-40 top-1/3 h-[520px] w-[520px] rounded-full opacity-55 blur-3xl animate-pulse" style={{ background: "radial-gradient(circle, hsla(200,100%,60%,0.14), transparent 70%)", animationDuration: "11s", animationDelay: "1.4s" }} />
                <div aria-hidden className="pointer-events-none absolute left-1/3 bottom-0 h-[360px] w-[360px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, hsla(220,100%,70%,0.10), transparent 70%)" }} />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, hsl(var(--accent)/0.4) 2px, hsl(var(--accent)/0.4) 3px)" }} />

                {/* ===== Mode switcher — Text-to-Video is now first-class ===== */}
                <div className="relative mb-8">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 p-1.5 backdrop-blur-xl shadow-[0_20px_60px_-30px_hsl(var(--accent)/0.4)]">
                    {([
                      { id: "text", label: "Text → Video", sub: "Pure prompt", Icon: Wand2 },
                      { id: "image", label: "Image → Video", sub: "Reference frame", Icon: ImageIcon },
                      { id: "template", label: "Template", sub: "Proven shots", Icon: Images },
                    ] as const).map(({ id, label, sub, Icon }) => {
                      const active = createMode === id;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setCreateMode(id);
                            if (id === "image") {
                              setTimeout(() => fileInputRef.current?.click(), 80);
                            } else if (id === "template") {
                              setDrawer("templates");
                            } else if (id === "text") {
                              setDraft(d => ({ ...d, brief: { ...d.brief, refImageUrl: undefined, templateId: undefined } }));
                            }
                          }}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-full px-5 py-2.5 transition-all",
                            active
                              ? "bg-foreground text-background shadow-[0_8px_30px_-8px_hsl(var(--accent)/0.55)]"
                              : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-accent" : "")} />
                          <span className="text-left">
                            <span className={cn("block font-display text-[15px] italic leading-tight", active ? "text-background" : "")}>{label}</span>
                            <span className={cn("block font-mono text-[8.5px] uppercase tracking-[0.28em]", active ? "text-background/55" : "text-muted-foreground/60")}>{sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-5">
                    {createMode === "image" && (
                      <>
                        <ReferenceUploader
                          imageUrl={draft.brief.refImageUrl}
                          uploading={uploading}
                          onUploadClick={() => fileInputRef.current?.click()}
                          onClear={() => setDraft(d => ({ ...d, brief: { ...d.brief, refImageUrl: undefined } }))}
                        />
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                      </>
                    )}
                    {createMode !== "image" && (
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    )}

                    {/* ===== HERO COMPOSER — bigger and more art-directed than the landing ===== */}
                    <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-card/80 via-card/30 to-background/30 shadow-[0_40px_120px_-40px_hsl(var(--accent)/0.55)] backdrop-blur-2xl">
                      {/* Top hairline + bottom hairline */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

                      {/* Cinema corner brackets */}
                      <span className="pointer-events-none absolute left-3 top-3 z-10 h-4 w-4 border-l-2 border-t-2 border-accent/70" />
                      <span className="pointer-events-none absolute right-3 top-3 z-10 h-4 w-4 border-r-2 border-t-2 border-accent/70" />
                      <span className="pointer-events-none absolute bottom-3 left-3 z-10 h-4 w-4 border-b-2 border-l-2 border-accent/70" />
                      <span className="pointer-events-none absolute bottom-3 right-3 z-10 h-4 w-4 border-b-2 border-r-2 border-accent/70" />

                      <div className="px-9 py-9">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                            </span>
                            {createMode === "text" ? "Pure text prompt" : createMode === "image" ? "Image-anchored brief" : "Template brief"}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-[0.36em] text-muted-foreground/60">SC. 01 · TAKE 01</div>
                        </div>

                        <textarea
                          value={draft.brief.logline}
                          onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, logline: e.target.value } }))}
                          placeholder={createMode === "text"
                            ? "A lone surfer paddles into a 30-foot wave at golden hour. Camera pushes in as the wave curls overhead. Anamorphic, 35mm grain, sun flares."
                            : createMode === "image"
                              ? "Animate the uploaded frame — the camera slowly dollies forward as light bends through the scene."
                              : "Describe the spin you want on the template — tone, era, hero moment."
                          }
                          rows={5}
                          className="mt-6 w-full resize-none bg-transparent font-display text-[34px] italic leading-[1.15] tracking-[-0.015em] text-foreground outline-none placeholder:text-muted-foreground/35"
                          style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}
                        />

                        <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-border/40 pt-6">
                          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/60">Style</span>
                          <input
                            value={draft.brief.style}
                            onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, style: e.target.value } }))}
                            placeholder="Anamorphic · neon · 35mm grain"
                            className="h-9 min-w-[220px] flex-1 rounded-full border border-border/60 bg-background/40 px-4 text-sm text-foreground outline-none transition-colors focus:border-accent/60 focus:bg-background/70"
                          />
                          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/60">Aspect</span>
                          <SegmentedSelect
                            value={draft.defaults.aspect}
                            options={["16:9", "9:16", "1:1", "21:9"]}
                            onChange={(value) => setDraft(d => ({ ...d, defaults: { ...d.defaults, aspect: value as StudioDraft["defaults"]["aspect"] } }))}
                          />
                        </div>

                        {/* Quick prompt seeds — only shown when prompt is empty */}
                        {!draft.brief.logline && (
                          <div className="mt-6 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/60">Try</span>
                            {[
                              "A vintage car drifts through Tokyo neon at 3am",
                              "Slow-motion espresso pour, macro, golden light",
                              "Drone over snow-capped peaks at dawn",
                              "Streetwear model walks toward camera, rain, slow-mo",
                            ].map((seed) => (
                              <button
                                key={seed}
                                onClick={() => setDraft(d => ({ ...d, brief: { ...d.brief, logline: seed } }))}
                                className="rounded-full border border-border/50 bg-background/30 px-3 py-1.5 text-[12px] text-muted-foreground transition-all hover:border-accent/50 hover:bg-accent/[0.08] hover:text-foreground"
                              >
                                {seed}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ============= ENGINE PILL RAIL ============= */}
                    <EnginePillRail
                      selected={draft.defaults.engine}
                      hasCinema={hasCinema}
                      onSelect={(id) => setDraft(d => ({ ...d, defaults: { ...d.defaults, engine: id }, scenes: d.scenes.map(scene => ({ ...scene, engine: scene.engine || id })) }))}
                      onMore={() => setDrawer("engines")}
                    />
                  </div>

                  <div className="space-y-3">
                    {/* Mode-specific helper card */}
                    <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.10] via-card/40 to-background/30 p-5 backdrop-blur-xl">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-accent">
                        {createMode === "text" ? "Text-to-video" : createMode === "image" ? "Image-to-video" : "Template"}
                      </div>
                      <div className="mt-2 font-display text-xl italic leading-tight text-foreground">
                        {createMode === "text" ? "No image required." : createMode === "image" ? "Drop a still, get a scene." : "Pick a structure."}
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                        {createMode === "text" ? "Write the scene. The selected engine renders it from the prompt alone." : createMode === "image" ? "Your frame becomes the visual DNA — color, character, composition all carry through." : "Cinematic blueprints with shot lists you can edit before render."}
                      </p>
                    </div>

                    {createMode !== "template" && <ActionTile icon={Images} title="Templates" body="Proven structures, fully editable." onClick={() => { setCreateMode("template"); setDrawer("templates"); }} />}
                    <ActionTile icon={ImageIcon} title="Environments" body="Anchor a world or location." onClick={() => setDrawer("envs")} />
                    <ActionTile icon={Sparkles} title="Visual style" body={draft.brief.style || "Pick a look — noir, anime, neon, golden hour…"} onClick={() => setDrawer("styles")} />
                    <ActionTile icon={Music2} title="Score & voice" body="Pick the sonic palette early." onClick={() => setDrawer("music")} />

                    <button
                      onClick={() => setStep("cast")}
                      disabled={!canGenerateScript}
                      className="group relative mt-2 flex w-full items-center justify-between overflow-hidden rounded-2xl bg-foreground px-5 py-5 text-left text-background transition-all hover:shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.5),0_0_80px_-20px_hsl(var(--accent)/0.6)] disabled:opacity-30 disabled:hover:shadow-none"
                    >
                      <span className="absolute inset-y-0 -left-12 w-12 -skew-x-12 bg-accent/40 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
                      <span className="relative">
                        <span className="block font-mono text-[9px] uppercase tracking-[0.32em] text-background/60">Phase 02</span>
                        <span className="mt-0.5 block font-display text-lg italic">Cast the avatars</span>
                      </span>
                      <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </FlowPanel>
            )}

            {step === "cast" && (
              <FlowPanel key="cast" eyebrow="Step 2" title="Pick the avatars that will appear" icon={Users}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                  {draft.scenes.map(scene => (
                    <SceneEditor
                      key={scene.id}
                      scene={scene}
                      cast={draft.cast}
                      active={activeScene?.id === scene.id}
                      onSelect={() => setActive(scene.id)}
                      onPatch={(patch) => patchScene(scene.id, patch)}
                      onRemove={() => removeScene(scene.id)}
                      onRender={() => generateScene(scene.id)}
                      onPickEngine={() => setDrawer("engines")}
                    />
                  ))}
                  {!draft.scenes.length && (
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
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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

        <aside className="hidden border-l border-border bg-background/50 p-5 backdrop-blur-xl lg:block">
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
                defaults: { ...d.defaults, engine: id, duration: newDuration, qualityProfileId: profile.id },
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
    </div>
  );
}

function FlowPanel({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: React.ReactNode; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="relative">
      <div className="relative mb-10 flex items-end justify-between gap-6 border-b border-border/40 pb-8">
        <div className="flex-1">
          <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-accent/30 bg-accent/[0.08] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-accent backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent))]" />
            </span>
            <Icon className="h-3 w-3" /> {eyebrow}
          </div>
          <h1 className="max-w-5xl font-display text-[44px] font-light leading-[0.98] tracking-[-0.025em] text-foreground md:text-[68px] lg:text-[80px]">{title}</h1>
        </div>
        <div className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60 lg:flex">
          <span>{new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</span>
          <span className="h-px w-12 bg-border" />
          <span>Take 01</span>
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
    <button onClick={onClick} className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/20 p-5 text-left transition-all hover:border-accent/50 hover:shadow-[0_0_32px_-8px_hsl(var(--accent)/0.4)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.08),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent transition-all group-hover:border-accent/50 group-hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)]">
            <Icon className="h-4 w-4" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
        <div className="font-display text-lg italic text-foreground">{title}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </button>
  );
}

function CommandCard({ icon: Icon, title, body, busy, disabled, onClick }: { icon: typeof Sparkles; title: string; body: string; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/20 p-5 text-left transition-all hover:border-accent/50 hover:shadow-[0_0_32px_-8px_hsl(var(--accent)/0.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border/60 disabled:hover:shadow-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.08),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent transition-all group-hover:border-accent/50 group-hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
        <div className="font-display text-lg italic text-foreground">{title}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
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
        <StatusPill status={scene.status} />
        <div className="flex-1" />
        <button onClick={(e) => { e.stopPropagation(); onPickEngine(); }} className="h-8 rounded-lg border border-border bg-background/50 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">{ENGINES[scene.engine || "kling-v3"].shortLabel}</button>
        <button onClick={(e) => { e.stopPropagation(); onRender(); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-foreground hover:bg-accent/90">
          {scene.status === "generating" ? <Loader2 className="h-3 w-3 animate-spin" /> : scene.clipUrl ? <RefreshCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {scene.clipUrl ? "Regen" : "Render"}
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
        <MiniSelect value={String(scene.duration)} options={["5", "10", "15"]} suffix="s" onChange={(v) => onPatch({ duration: Number(v) as 5 | 10 | 15 })} />
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

function StatusPill({ status }: { status: SceneDraft["status"] }) {
  const styles: Record<SceneDraft["status"], string> = {
    idle: "bg-muted text-muted-foreground",
    queued: "bg-warning/15 text-warning",
    generating: "bg-accent/15 text-accent",
    done: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
  };
  return <span className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", styles[status])}>{status}</span>;
}

function ClipCard({ scene, active, onSelect, onRender }: { scene: SceneDraft; active: boolean; onSelect: () => void; onRender: () => void }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card/55 transition-all", active ? "border-accent/60" : "border-border")}> 
      <button onClick={onSelect} className="relative block aspect-video w-full bg-muted text-left">
        {scene.clipUrl ? <video src={scene.clipUrl} muted playsInline className="h-full w-full object-cover" /> : scene.refImageUrl ? <img src={scene.refImageUrl} alt={scene.location} className="h-full w-full object-cover opacity-80" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-8 w-8 text-muted-foreground" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">{String(scene.index + 1).padStart(2, "0")}</span>
          <StatusPill status={scene.status} />
        </div>
      </button>
      <div className="p-4">
        <div className="truncate text-sm font-medium text-foreground">{scene.location}</div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{scene.beat || scene.dialogue || "No description"}</p>
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
      <div className="rounded-2xl border border-border bg-card/55 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Preview</div>
          <StatusPill status={scene?.status || "idle"} />
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
          {scene?.clipUrl ? <video src={scene.clipUrl} controls playsInline className="h-full w-full object-cover" /> : scene?.refImageUrl || draft.brief.refImageUrl ? <img src={scene?.refImageUrl || draft.brief.refImageUrl} alt="Current reference" className="h-full w-full object-cover opacity-80" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-8 w-8 text-muted-foreground" /></div>}
        </div>
        <div className="mt-4 space-y-3">
          <button onClick={onRender} disabled={!scene} className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-40">
            <Play className="h-4 w-4" /> Render selected
          </button>
          <button onClick={onOpenEditor} disabled={!renderedCount} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-4 py-3 text-sm font-medium text-foreground hover:bg-card disabled:opacity-40">
            <Send className="h-4 w-4 text-accent" /> Send to editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Scenes" value={String(draft.scenes.length)} />
        <Metric label="Rendered" value={String(renderedCount)} />
        <Metric label="Cast" value={String(draft.cast.length)} />
        <Metric label="Credits est." value={String(totalCost)} />
      </div>

      <div className="rounded-2xl border border-border bg-card/55 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><BadgeCheck className="h-4 w-4 text-accent" /> Pipeline connected</div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>Engine: {ENGINES[draft.defaults.engine].label}</div>
          <div>Aspect: {draft.defaults.aspect}</div>
          <div>Voice: {draft.defaults.voiceId || "Auto/default"}</div>
          <div>Music: {draft.audio.scoreUrl ? "Generated" : "Optional"}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/45 p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
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
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/60 via-card/20 to-background/40 p-6 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
          <Cpu className="h-3 w-3" />
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
                "group relative inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm transition-all",
                active
                  ? "border-accent bg-accent/[0.08] text-foreground shadow-[0_0_24px_hsl(var(--accent)/0.35)]"
                  : "border-border/60 bg-background/30 text-muted-foreground hover:border-foreground/30 hover:bg-background/50 hover:text-foreground",
                !e.healthy && "cursor-not-allowed opacity-30",
                locked && "opacity-60",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", tierColor[e.tier] || "bg-foreground/40")} />
              <span className="font-display text-[15px] italic">{e.shortLabel}</span>
              {locked && <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400/80">PRO</span>}
              {cost != null && (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground/60">
                  {cost}c
                </span>
              )}
              {active && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-border/40 pt-4 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/60">
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-foreground/40" /> Standard</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-accent" /> Pro</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-amber-400" /> Cinema</span>
      </div>
    </div>
  );
}


import { useCallback, useMemo, useRef, useState } from "react";
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
import { ENGINES } from "@/lib/video/engines";
import { StudioDrawer } from "./StudioDrawer";
import { AvatarsDrawerContent } from "./drawers/AvatarsDrawer";
import { EnginesDrawerContent } from "./drawers/EnginesDrawer";
import { EnvironmentsDrawerContent } from "./drawers/EnvironmentsDrawer";
import { MusicDrawerContent } from "./drawers/MusicDrawer";
import { TemplatesDrawerContent, type TemplatePick } from "./drawers/TemplatesDrawer";
import { VoicesDrawerContent } from "./drawers/VoicesDrawer";
import { newScene, type CastMember, type SceneDraft, type StudioDraft } from "./types";

type DrawerKey = null | "templates" | "avatars" | "engines" | "envs" | "voices" | "music";
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
  const { draft, setDraft, loading, saving, addScene, removeScene, patchScene, setActive } = useStudioDraft();
  const { generateScene, generateSceneFromDraft } = useScenePipeline(draft, patchScene);
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [step, setStep] = useState<StepId>("start");
  const [autoBusy, setAutoBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const activeScene = useMemo(
    () => draft.scenes.find(s => s.id === draft.activeSceneId) || draft.scenes[0],
    [draft.scenes, draft.activeSceneId],
  );

  const renderedCount = draft.scenes.filter(s => s.clipUrl).length;
  const totalCost = useMemo(() => draft.scenes.reduce((acc, scene) => {
    const engine = ENGINES[scene.engine || draft.defaults.engine];
    try {
      return acc + engine.baseCreditsFor(scene.duration);
    } catch {
      return acc;
    }
  }, 0), [draft.scenes, draft.defaults.engine]);

  const canGenerateScript = Boolean(draft.brief.logline.trim() || draft.brief.refImageUrl || draft.brief.templateId);
  const canRender = draft.scenes.length > 0 && (draft.brief.logline.trim() || draft.scenes.some(s => s.beat || s.dialogue));

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
    setStep("clips");
    for (const scene of draft.scenes) {
      if (!scene.clipUrl && scene.status !== "generating") {
        await generateScene(scene.id);
      }
    }
  }, [canRender, draft.scenes, generateScene]);

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
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--surface-2)/0.9),hsl(var(--background))_58%)]" />
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      </div>

      <header className="relative z-10 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-5 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/15 shadow-[0_0_28px_hsl(var(--accent)/0.25)]">
            <Film className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <input
              value={draft.brief.title}
              onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, title: e.target.value } }))}
              placeholder="Untitled creation"
              className="w-64 max-w-[30vw] bg-transparent font-display text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Create flow · not editor</div>
          </div>
        </div>

        <div className="hidden items-center gap-1 rounded-lg border border-border bg-card/60 p-1 md:flex">
          {STEPS.map(({ id, label, icon: Icon }, index) => {
            const active = step === id;
            const complete = id === "start" ? canGenerateScript : id === "cast" ? draft.cast.length > 0 : id === "script" ? draft.scenes.length > 0 : renderedCount > 0;
            return (
              <button
                key={id}
                onClick={() => setStep(id)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {complete && !active ? <Check className="h-3 w-3 text-success" /> : <Icon className="h-3 w-3" />}
                {index + 1}. {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
        {saving && <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">saving…</span>}
        <button onClick={() => setDrawer("engines")} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card/60 px-3 text-sm text-foreground transition-colors hover:bg-card md:flex">
          <Cpu className="h-4 w-4 text-accent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{ENGINES[draft.defaults.engine].shortLabel}</span>
        </button>
        <button
          onClick={autoCreate}
          disabled={autoBusy || uploading || !canGenerateScript}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-[0_0_28px_hsl(var(--accent)/0.3)] transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {autoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Auto create
        </button>
      </header>

      <main className="relative z-10 grid h-[calc(100vh-4rem)] grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="hidden border-r border-border bg-background/45 p-5 backdrop-blur-xl lg:block">
          <div className="mb-6 rounded-xl border border-border bg-card/50 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">One flow</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Upload an image or write an idea, pick cast, auto-write scenes, render clips, then move to the editor only when clips exist.</p>
          </div>
          <div className="space-y-2">
            {STEPS.map(({ id, label, icon: Icon }, index) => {
              const active = step === id;
              return (
                <button
                  key={id}
                  onClick={() => setStep(id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    active ? "border-accent/50 bg-accent/[0.06] text-foreground" : "border-border bg-card/30 text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[10px]", active ? "border-accent/40 bg-accent/15 text-accent" : "border-border bg-background/40")}>{index + 1}</span>
                  <Icon className={cn("h-4 w-4", active && "text-accent")} />
                  <span className="font-medium">{label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-40" />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="overflow-y-auto p-4 premium-scroll md:p-7">
          <AnimatePresence mode="wait">
            {step === "start" && (
              <FlowPanel key="start" eyebrow="Step 1" title="Start with an image, a template, or a prompt" icon={Sparkles}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <ReferenceUploader
                      imageUrl={draft.brief.refImageUrl}
                      uploading={uploading}
                      onUploadClick={() => fileInputRef.current?.click()}
                      onClear={() => setDraft(d => ({ ...d, brief: { ...d.brief, refImageUrl: undefined } }))}
                    />
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

                    <div className="rounded-2xl border border-border bg-card/55 p-5">
                      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">What should be created?</label>
                      <textarea
                        value={draft.brief.logline}
                        onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, logline: e.target.value } }))}
                        placeholder="Example: A luxury streetwear launch film in a rainy neon alley, featuring one avatar walking toward camera and delivering a short line."
                        rows={5}
                        className="mt-3 w-full resize-none bg-transparent text-xl leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          value={draft.brief.style}
                          onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, style: e.target.value } }))}
                          placeholder="Visual style"
                          className="h-10 min-w-[220px] flex-1 rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground outline-none focus:border-accent/50"
                        />
                        <SegmentedSelect
                          value={draft.defaults.aspect}
                          options={["16:9", "9:16", "1:1", "21:9"]}
                          onChange={(value) => setDraft(d => ({ ...d, defaults: { ...d.defaults, aspect: value as StudioDraft["defaults"]["aspect"] } }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <ActionTile icon={Images} title="Open templates" body="Use a proven structure, then edit it." onClick={() => setDrawer("templates")} />
                    <ActionTile icon={ImageIcon} title="Open environments" body="Pick a world or scene anchor." onClick={() => setDrawer("envs")} />
                    <ActionTile icon={Cpu} title="Choose engine" body={ENGINES[draft.defaults.engine].label} onClick={() => setDrawer("engines")} />
                    <button
                      onClick={() => setStep("cast")}
                      className="mt-2 flex w-full items-center justify-between rounded-xl bg-accent px-4 py-4 text-left text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40"
                      disabled={!canGenerateScript}
                    >
                      <span className="font-medium">Continue to cast</span>
                      <ArrowRight className="h-4 w-4" />
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
                duration: pick.settings?.targetDurationMinutes && pick.settings.targetDurationMinutes <= 1 ? 5 : d.defaults.duration,
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
          onSelect={(id) => {
            setDraft(d => ({
              ...d,
              defaults: { ...d.defaults, engine: id },
              scenes: d.scenes.map(scene => ({ ...scene, engine: scene.engine || id })),
            }));
            setDrawer(null);
            toast.success(`${ENGINES[id].shortLabel} selected`);
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
    </div>
  );
}

function FlowPanel({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            <Icon className="h-3 w-3" /> {eyebrow}
          </div>
          <h1 className="max-w-4xl font-display text-4xl leading-tight text-foreground md:text-5xl">{title}</h1>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function ReferenceUploader({ imageUrl, uploading, onUploadClick, onClear }: { imageUrl?: string; uploading: boolean; onUploadClick: () => void; onClear: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/55">
      <div className="aspect-[16/7] min-h-[260px]">
        {imageUrl ? (
          <img src={imageUrl} alt="Uploaded reference" className="h-full w-full object-cover" />
        ) : (
          <button onClick={onUploadClick} className="flex h-full w-full flex-col items-center justify-center p-8 text-center transition-colors hover:bg-card/60">
            <Upload className="mb-4 h-10 w-10 text-accent" />
            <div className="text-2xl font-medium text-foreground">Upload the image here</div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">This becomes the visual reference for image-to-video, avatar continuity, and the first scene.</p>
          </button>
        )}
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
        <button onClick={onUploadClick} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-[0_0_20px_hsl(var(--accent)/0.28)] hover:bg-accent/90 disabled:opacity-50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {imageUrl ? "Replace image" : "Upload image"}
        </button>
        {imageUrl && <button onClick={onClear} className="h-10 rounded-lg border border-border bg-background/80 px-4 text-sm text-foreground backdrop-blur hover:bg-card">Remove</button>}
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, title, body, onClick }: { icon: typeof Sparkles; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group w-full rounded-2xl border border-border bg-card/55 p-4 text-left transition-all hover:border-accent/35 hover:bg-card/80">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-base font-medium text-foreground">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </button>
  );
}

function CommandCard({ icon: Icon, title, body, busy, disabled, onClick }: { icon: typeof Sparkles; title: string; body: string; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-2xl border border-border bg-card/55 p-4 text-left transition-all hover:border-accent/35 hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-40">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-base font-medium text-foreground">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
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

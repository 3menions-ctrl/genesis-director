import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Film, Users, Wand2, Settings2, ChevronRight, Plus, Play, Loader2,
  Music2, Mic2, Image as ImageIcon, ArrowRight, RefreshCw, Trash2, Cpu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useStudioDraft } from "@/hooks/useStudioDraft";
import { useScenePipeline } from "@/hooks/useScenePipeline";
import { ENGINES, type EngineId } from "@/lib/video/engines";
import { StudioDrawer } from "./StudioDrawer";
import { TemplatesDrawerContent } from "./drawers/TemplatesDrawer";
import { AvatarsDrawerContent } from "./drawers/AvatarsDrawer";
import { EnginesDrawerContent } from "./drawers/EnginesDrawer";
import { EnvironmentsDrawerContent } from "./drawers/EnvironmentsDrawer";
import { VoicesDrawerContent } from "./drawers/VoicesDrawer";
import { MusicDrawerContent } from "./drawers/MusicDrawer";
import { newScene, type SceneDraft } from "./types";

type DrawerKey = null | "templates" | "avatars" | "engines" | "envs" | "voices" | "music";

export default function StudioShell() {
  const { draft, setDraft, loading, saving, addScene, removeScene, patchScene, setActive } = useStudioDraft();
  const { generateScene } = useScenePipeline(draft, patchScene);
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const navigate = useNavigate();

  const activeScene = useMemo(
    () => draft.scenes.find(s => s.id === draft.activeSceneId) || draft.scenes[0],
    [draft.scenes, draft.activeSceneId],
  );

  const totalCost = useMemo(() => {
    return draft.scenes.reduce((acc, s) => {
      const eng = ENGINES[s.engine || draft.defaults.engine];
      try { return acc + eng.baseCreditsFor(s.duration); } catch { return acc; }
    }, 0);
  }, [draft.scenes, draft.defaults.engine]);

  // ---------- AUTO: stream a script ----------
  const [autoBusy, setAutoBusy] = useState(false);
  const runAutoScript = useCallback(async () => {
    if (!draft.brief.logline) { toast.error("Add a logline first"); return; }
    setAutoBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-script-generator", {
        body: {
          title: draft.brief.title || "Untitled",
          logline: draft.brief.logline,
          style: draft.brief.style,
          sceneCount: Math.max(3, Math.min(8, draft.scenes.length || 5)),
          aspectRatio: draft.defaults.aspect,
          characters: draft.cast.map(c => ({ name: c.name })),
        },
      });
      if (error) throw error;
      const scenes = (data as any)?.scenes as Array<any> | undefined;
      if (!scenes?.length) throw new Error("No scenes generated");
      setDraft(d => ({
        ...d,
        scenes: scenes.map((s, i) => ({
          ...newScene(i),
          location: s.location || s.heading || `Scene ${i+1}`,
          beat: s.beat || s.action || s.description || "",
          dialogue: s.dialogue || "",
          duration: (s.duration || d.defaults.duration) as 5|10|15,
          lens: s.lens || "medium",
          move: s.move || "static",
          speakerId: d.cast[0]?.id,
        })),
        activeSceneId: undefined,
      }));
      toast.success(`${scenes.length} scenes drafted`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate script");
    } finally {
      setAutoBusy(false);
    }
  }, [draft.brief, draft.defaults, draft.scenes.length, draft.cast, setDraft]);

  const renderAll = useCallback(async () => {
    if (!draft.scenes.length) { toast.error("No scenes to render"); return; }
    for (const s of draft.scenes) {
      if (s.status !== "done") await generateScene(s.id);
    }
  }, [draft.scenes, generateScene]);

  const openInEditor = useCallback(() => {
    const ready = draft.scenes.filter(s => s.clipUrl);
    if (!ready.length) { toast.error("Render at least one scene first"); return; }
    try {
      sessionStorage.setItem("editor:hydrate", JSON.stringify({
        clips: ready.map(s => ({ url: s.clipUrl, title: s.location, duration: s.duration })),
        score: draft.audio.scoreUrl,
      }));
    } catch {}
    navigate("/editor");
  }, [draft, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-white flex flex-col overflow-hidden" style={{ fontFamily: "Fraunces, serif" }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full bg-accent/5 blur-[140px]" />
      </div>

      {/* TOP BAR */}
      <header className="relative z-10 flex items-center gap-4 px-6 h-16 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-[0_0_24px_hsl(var(--accent)/0.4)]">
            <Film className="w-4 h-4 text-white" />
          </div>
          <input
            value={draft.brief.title}
            onChange={(e) => setDraft(d => ({ ...d, brief: { ...d.brief, title: e.target.value } }))}
            placeholder="Untitled film"
            className="bg-transparent text-lg outline-none placeholder:text-white/25 text-white w-64"
            style={{ fontFamily: "Fraunces, serif" }}
          />
        </div>

        <div className="flex-1" />

        <ModeToggle mode={draft.defaults.mode} onChange={(m) => setDraft(d => ({ ...d, defaults: { ...d.defaults, mode: m } }))} />

        <button onClick={() => setDrawer("engines")}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-sm">
          <Cpu className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono text-xs uppercase tracking-wider text-white/70">{ENGINES[draft.defaults.engine].shortLabel}</span>
        </button>

        <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Cost</span>
          <span className="font-mono text-sm tabular-nums text-white">{totalCost}</span>
        </div>

        <button
          onClick={renderAll}
          disabled={!draft.scenes.length}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium shadow-[0_0_24px_hsl(var(--accent)/0.4)] transition-all">
          <Play className="w-3.5 h-3.5" />Render all
        </button>

        {saving && <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">saving…</span>}
      </header>

      {/* MAIN: Composer | Stage */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
        {/* COMPOSER */}
        <section className="overflow-y-auto border-r border-white/[0.06] p-8 space-y-6">
          <BriefBlock
            draft={draft}
            setDraft={setDraft}
            onPickTemplate={() => setDrawer("templates")}
            onPickEnv={() => setDrawer("envs")}
          />

          <CastBlock
            cast={draft.cast}
            onAdd={() => setDrawer("avatars")}
            onRemove={(id) => setDraft(d => ({ ...d, cast: d.cast.filter(c => c.id !== id) }))}
          />

          <AudioBlock
            audio={draft.audio}
            onPickMusic={() => setDrawer("music")}
            onPickVoice={() => setDrawer("voices")}
          />

          <ScriptBlock
            scenes={draft.scenes}
            cast={draft.cast}
            activeId={activeScene?.id}
            mode={draft.defaults.mode}
            autoBusy={autoBusy}
            onAuto={runAutoScript}
            onAddScene={addScene}
            onRemoveScene={removeScene}
            onPatchScene={patchScene}
            onSelectScene={setActive}
            onGenerate={(id) => generateScene(id)}
            onPickEngine={() => setDrawer("engines")}
          />
        </section>

        {/* STAGE */}
        <section className="overflow-y-auto p-8">
          <Stage scene={activeScene} onPickEngine={() => setDrawer("engines")} onGenerate={(id) => generateScene(id)} />
        </section>
      </div>

      {/* REEL */}
      <Reel
        scenes={draft.scenes}
        activeId={activeScene?.id}
        onSelect={setActive}
        onAdd={addScene}
        onOpenEditor={openInEditor}
      />

      {/* Drawers */}
      <StudioDrawer open={drawer === "templates"} onClose={() => setDrawer(null)} title="Templates" subtitle="Quick-starts and your saved scripts">
        <TemplatesDrawerContent onPick={(p) => {
          setDraft(d => ({ ...d, brief: { ...d.brief, title: d.brief.title || p.name, logline: d.brief.logline || p.logline, style: p.style } }));
          setDrawer(null);
          toast.success(`${p.name} applied`);
        }} />
      </StudioDrawer>

      <StudioDrawer open={drawer === "avatars"} onClose={() => setDrawer(null)} title="Cast" subtitle="Pick an avatar from the library or generate a new character" width="xl">
        <AvatarsDrawerContent
          selectedIds={draft.cast.map(c => c.id)}
          onSelect={(member) => setDraft(d => d.cast.find(c => c.id === member.id) ? d : ({ ...d, cast: [...d.cast, member] }))}
          onClose={() => setDrawer(null)}
        />
      </StudioDrawer>

      <StudioDrawer open={drawer === "engines"} onClose={() => setDrawer(null)} title="Engine" subtitle="Choose the model that renders your scenes">
        <EnginesDrawerContent
          selected={draft.defaults.engine}
          duration={draft.defaults.duration}
          onSelect={(id) => { setDraft(d => ({ ...d, defaults: { ...d.defaults, engine: id } })); setDrawer(null); toast.success(`${ENGINES[id].shortLabel} selected`); }}
        />
      </StudioDrawer>

      <StudioDrawer open={drawer === "envs"} onClose={() => setDrawer(null)} title="Environment" subtitle="Pick a world for your story">
        <EnvironmentsDrawerContent
          selectedId={draft.brief.environmentId}
          onSelect={(env) => { setDraft(d => ({ ...d, brief: { ...d.brief, environmentId: env.id, refImageUrl: env.thumbnail_url || d.brief.refImageUrl } })); setDrawer(null); }}
        />
      </StudioDrawer>

      <StudioDrawer open={drawer === "voices"} onClose={() => setDrawer(null)} title="Voices" subtitle="Choose the default voice for new characters">
        <VoicesDrawerContent
          selectedId={draft.defaults.voiceId}
          onSelect={(id) => { setDraft(d => ({ ...d, defaults: { ...d.defaults, voiceId: id } })); setDrawer(null); }}
        />
      </StudioDrawer>

      <StudioDrawer open={drawer === "music"} onClose={() => setDrawer(null)} title="Score" subtitle="Generate the musical bed for your film">
        <MusicDrawerContent
          current={draft.audio.scorePrompt}
          onSelect={(url, p) => { setDraft(d => ({ ...d, audio: { ...d.audio, scoreUrl: url, scorePrompt: p } })); setDrawer(null); }}
        />
      </StudioDrawer>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function ModeToggle({ mode, onChange }: { mode: "auto" | "director"; onChange: (m: "auto" | "director") => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-1">
      {(["auto","director"] as const).map(m => (
        <button key={m} onClick={() => onChange(m)}
          className={cn("px-3 h-7 rounded-md text-[11px] font-mono uppercase tracking-wider transition-colors",
            mode === m ? "bg-accent text-white" : "text-white/50 hover:text-white")}>
          {m}
        </button>
      ))}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/40">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function BriefBlock({ draft, setDraft, onPickTemplate, onPickEnv }: any) {
  return (
    <Section title="Brief" action={
      <button onClick={onPickTemplate} className="text-[11px] font-mono uppercase tracking-wider text-accent hover:text-white transition-colors flex items-center gap-1">
        <Sparkles className="w-3 h-3" />Templates
      </button>
    }>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <textarea
          value={draft.brief.logline}
          onChange={(e) => setDraft((d: any) => ({ ...d, brief: { ...d.brief, logline: e.target.value } }))}
          placeholder="Logline — one sentence describing your film…"
          rows={2}
          className="w-full bg-transparent text-white placeholder:text-white/30 outline-none text-base resize-none leading-relaxed"
          style={{ fontFamily: "Fraunces, serif" }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={draft.brief.style}
            onChange={(e) => setDraft((d: any) => ({ ...d, brief: { ...d.brief, style: e.target.value } }))}
            placeholder="Style"
            className="flex-1 min-w-[200px] h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-sm outline-none focus:border-accent/40"
          />
          <select
            value={draft.defaults.aspect}
            onChange={(e) => setDraft((d: any) => ({ ...d, defaults: { ...d.defaults, aspect: e.target.value } }))}
            className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs font-mono uppercase tracking-wider outline-none">
            {(["16:9","9:16","1:1","21:9"] as const).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={onPickEnv}
            className="h-9 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 text-xs font-mono uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors">
            <ImageIcon className="w-3 h-3" />World
          </button>
        </div>
      </div>
    </Section>
  );
}

function CastBlock({ cast, onAdd, onRemove }: any) {
  return (
    <Section title="Cast" action={
      <button onClick={onAdd} className="text-[11px] font-mono uppercase tracking-wider text-accent hover:text-white transition-colors flex items-center gap-1">
        <Plus className="w-3 h-3" />Add character
      </button>
    }>
      {cast.length === 0 ? (
        <button onClick={onAdd} className="w-full rounded-2xl border-2 border-dashed border-white/10 hover:border-accent/40 bg-white/[0.01] p-6 flex items-center justify-center gap-3 text-white/40 hover:text-white transition-all">
          <Users className="w-4 h-4" />
          <span className="text-sm">Pick avatars from the library</span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-3">
          {cast.map((c: any) => (
            <div key={c.id} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 pr-3 flex items-center gap-3">
              <img src={c.imageUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
              <span className="text-sm text-white">{c.name}</span>
              <button onClick={() => onRemove(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function AudioBlock({ audio, onPickMusic, onPickVoice }: any) {
  return (
    <Section title="Audio">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onPickMusic}
          className={cn("rounded-xl border p-4 text-left transition-all flex items-center gap-3",
            audio.scoreUrl ? "border-accent/40 bg-accent/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/20")}>
          <Music2 className="w-4 h-4 text-accent" />
          <div className="min-w-0">
            <div className="text-white text-sm font-medium">Score</div>
            <div className="text-[11px] text-white/40 truncate">{audio.scorePrompt || "Generate a musical bed"}</div>
          </div>
        </button>
        <button onClick={onPickVoice}
          className="rounded-xl border border-white/[0.06] hover:border-white/20 bg-white/[0.02] p-4 text-left transition-all flex items-center gap-3">
          <Mic2 className="w-4 h-4 text-accent" />
          <div className="min-w-0">
            <div className="text-white text-sm font-medium">Default voice</div>
            <div className="text-[11px] text-white/40 truncate">Used for new characters</div>
          </div>
        </button>
      </div>
    </Section>
  );
}

function ScriptBlock({
  scenes, cast, activeId, mode, autoBusy, onAuto, onAddScene, onRemoveScene, onPatchScene, onSelectScene, onGenerate, onPickEngine,
}: any) {
  return (
    <Section title="Script" action={
      <div className="flex items-center gap-3">
        {mode === "auto" && (
          <button onClick={onAuto} disabled={autoBusy}
            className="text-[11px] font-mono uppercase tracking-wider text-accent hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1">
            {autoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            {autoBusy ? "Drafting…" : "Auto-write"}
          </button>
        )}
        <button onClick={onAddScene} className="text-[11px] font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" />Scene
        </button>
      </div>
    }>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {scenes.map((s: SceneDraft) => (
            <motion.div key={s.id} layout
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onClick={() => onSelectScene(s.id)}
              className={cn("rounded-2xl border p-4 cursor-pointer transition-all",
                activeId === s.id ? "border-accent/60 bg-accent/[0.04] shadow-[0_0_24px_hsl(var(--accent)/0.15)]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15")}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-accent uppercase tracking-wider">SCENE {String(s.index + 1).padStart(2, "0")}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onGenerate(s.id); }}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md bg-accent/15 text-accent hover:bg-accent/25 inline-flex items-center gap-1">
                    {s.status === "generating" ? <Loader2 className="w-3 h-3 animate-spin" /> : s.clipUrl ? <RefreshCw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {s.clipUrl ? "Regen" : "Render"}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemoveScene(s.id); }}
                    className="text-white/30 hover:text-white p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              <input
                value={s.location}
                onChange={(e) => onPatchScene(s.id, { location: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent font-mono text-[11px] uppercase tracking-wider text-white/60 outline-none mb-2"
              />
              <textarea
                value={s.beat}
                onChange={(e) => onPatchScene(s.id, { beat: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Action / beat…"
                rows={2}
                className="w-full bg-transparent text-white/90 outline-none resize-none text-[14px] leading-relaxed mb-2"
                style={{ fontFamily: "Fraunces, serif" }}
              />
              {(s.dialogue || cast.length > 0) && (
                <div className="rounded-lg bg-black/20 border border-white/[0.04] p-3 space-y-2">
                  {cast.length > 0 && (
                    <select
                      value={s.speakerId || ""}
                      onChange={(e) => onPatchScene(s.id, { speakerId: e.target.value || undefined })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-[10px] font-mono uppercase tracking-wider text-accent outline-none">
                      <option value="">— Speaker —</option>
                      {cast.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <textarea
                    value={s.dialogue}
                    onChange={(e) => onPatchScene(s.id, { dialogue: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Dialogue (verbatim)…"
                    rows={2}
                    className="w-full bg-transparent text-white outline-none resize-none text-[14px] leading-snug italic"
                    style={{ fontFamily: "Fraunces, serif" }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <SmallSelect value={s.lens} onChange={(v) => onPatchScene(s.id, { lens: v as any })} options={["wide","medium","close","macro","aerial"]} />
                <SmallSelect value={s.move} onChange={(v) => onPatchScene(s.id, { move: v as any })} options={["static","dolly","pan","tilt","handheld","crane"]} />
                <SmallSelect value={String(s.duration)} onChange={(v) => onPatchScene(s.id, { duration: Number(v) as 5|10|15 })} options={["5","10","15"]} suffix="s" />
                <button onClick={(e) => { e.stopPropagation(); onPickEngine(); }}
                  className="ml-auto text-[10px] font-mono uppercase tracking-wider text-white/50 hover:text-white inline-flex items-center gap-1">
                  <Cpu className="w-3 h-3" />{ENGINES[s.engine || "kling-v3"].shortLabel}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {scenes.length === 0 && (
          <button onClick={mode === "auto" ? onAuto : onAddScene}
            className="w-full rounded-2xl border-2 border-dashed border-white/10 hover:border-accent/40 p-8 text-white/40 hover:text-white transition-all flex flex-col items-center gap-2">
            {mode === "auto" ? <Wand2 className="w-5 h-5 text-accent" /> : <Plus className="w-5 h-5" />}
            <span className="text-sm">{mode === "auto" ? "Auto-write a script from your brief" : "Add your first scene"}</span>
          </button>
        )}
      </div>
    </Section>
  );
}

function SmallSelect({ value, onChange, options, suffix }: { value: string; onChange: (v: string) => void; options: string[]; suffix?: string }) {
  return (
    <select value={value} onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }} onClick={(e) => e.stopPropagation()}
      className="h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-white/70 outline-none">
      {options.map(o => <option key={o} value={o}>{o}{suffix || ""}</option>)}
    </select>
  );
}

function StatusPill({ status }: { status: SceneDraft["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle: { label: "idle", cls: "bg-white/5 text-white/40" },
    queued: { label: "queued", cls: "bg-amber-500/15 text-amber-400" },
    generating: { label: "generating", cls: "bg-accent/15 text-accent" },
    done: { label: "done", cls: "bg-emerald-500/15 text-emerald-400" },
    failed: { label: "failed", cls: "bg-rose-500/15 text-rose-400" },
  };
  const m = map[status] || map.idle;
  return <span className={cn("text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full", m.cls)}>{m.label}</span>;
}

function Stage({ scene, onPickEngine, onGenerate }: { scene?: SceneDraft; onPickEngine: () => void; onGenerate: (id: string) => void }) {
  if (!scene) {
    return (
      <div className="h-full min-h-[400px] rounded-3xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-white/30">
        <Film className="w-10 h-10 mb-3" />
        <p className="text-sm" style={{ fontFamily: "Fraunces, serif" }}>Pick a scene to preview it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aspect-video relative rounded-3xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {scene.clipUrl ? (
          <video src={scene.clipUrl} controls playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : scene.refImageUrl ? (
          <>
            <img src={scene.refImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <StagePlaceholder scene={scene} />
          </>
        ) : (
          <StagePlaceholder scene={scene} />
        )}
        {/* Film grain */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">SCENE {String(scene.index + 1).padStart(2, "0")}</span>
        <StatusPill status={scene.status} />
        <div className="flex-1" />
        <button onClick={onPickEngine}
          className="text-[11px] font-mono uppercase tracking-wider text-white/50 hover:text-white inline-flex items-center gap-1">
          <Cpu className="w-3 h-3" />{ENGINES[scene.engine || "kling-v3"].shortLabel}
        </button>
        <button onClick={() => onGenerate(scene.id)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all">
          {scene.clipUrl ? <RefreshCw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {scene.clipUrl ? "Regenerate" : "Render"}
        </button>
      </div>

      {scene.beat && (
        <p className="text-white/70 text-base leading-relaxed" style={{ fontFamily: "Fraunces, serif" }}>{scene.beat}</p>
      )}
      {scene.dialogue && (
        <blockquote className="border-l-2 border-accent pl-4 italic text-white/80" style={{ fontFamily: "Fraunces, serif" }}>"{scene.dialogue}"</blockquote>
      )}
    </div>
  );
}

function StagePlaceholder({ scene }: { scene: SceneDraft }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center px-8">
      <div>
        {scene.status === "generating" || scene.status === "queued" ? (
          <>
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
            <div className="text-white/70 text-sm">Generating clip…</div>
          </>
        ) : (
          <>
            <Film className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <div className="text-white/40 text-sm">No clip rendered yet</div>
          </>
        )}
      </div>
    </div>
  );
}

function Reel({ scenes, activeId, onSelect, onAdd, onOpenEditor }: any) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-6 py-4 overflow-x-auto">
        {scenes.map((s: SceneDraft) => (
          <button key={s.id} onClick={() => onSelect(s.id)}
            className={cn("group relative shrink-0 w-32 aspect-video rounded-lg overflow-hidden border-2 transition-all",
              activeId === s.id ? "border-accent shadow-[0_0_16px_hsl(var(--accent)/0.4)]" : "border-white/[0.06] hover:border-white/20")}>
            {s.clipUrl ? (
              <video src={s.clipUrl} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : s.refImageUrl ? (
              <img src={s.refImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute top-1.5 left-2 font-mono text-[9px] uppercase tracking-wider text-white/80">{String(s.index+1).padStart(2,"0")}</div>
            <div className="absolute bottom-1.5 right-1.5"><StatusPill status={s.status} /></div>
          </button>
        ))}
        <button onClick={onAdd}
          className="shrink-0 w-32 aspect-video rounded-lg border-2 border-dashed border-white/10 hover:border-accent/40 text-white/30 hover:text-white flex items-center justify-center transition-all">
          <Plus className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button onClick={onOpenEditor}
          className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm font-medium transition-all">
          Open in Editor <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
}
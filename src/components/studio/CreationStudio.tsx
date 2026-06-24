/**
 * CreationStudio — the Runway/Canva-style creation surface for /studio.
 *
 *   ┌──────┬───────────────────────────────┐
 *   │ RAIL │  CANVAS (active module)        │
 *   │      ├───────────────────────────────┤
 *   │      │  composition bar  ·  Create    │
 *   └──────┴───────────────────────────────┘
 *
 * Every module is wired to a shared `Selections` state that flows into the
 * create config sent to the real mode-router pipeline:
 *   · Generate  — text-to-video / image-to-video / avatar, engine + format
 *   · Cast      — pick an avatar (identity for avatar mode + breakouts)
 *   · Worlds    — pick an environment (folds into the scene prompt)
 *   · Voice     — pick a narration/character voice
 *   · Music     — score on/off + genre/mood
 *   · Look      — film grade applied to the prompt
 *   · Story     — a logline that seeds the prompt
 *   · Templates — 4th-wall / breakout effects (Seedance-only, identity-locked)
 *   · Image / Photo / Scenes — the existing hubs
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Image as ImageIcon, Scissors, Users, Mic, Music as MusicIcon,
  Globe2, Palette, PenLine, LayoutGrid, Sparkles, ArrowRight, ArrowLeft, Lock, Volume2, Check,
  Cpu, Film, Search, UserPlus, Loader2, type LucideIcon,
} from "lucide-react";
import {
  ENGINES, listEngines, renderSurchargeCredits, engineToBackend, clampDurationForEngine,
  TIER_LABEL, DEFAULT_ENGINE_ID, type EngineId, type EngineSpec,
} from "@/lib/video/engines";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import { useAllCrossoverBlueprints } from "@/lib/crossovers/registry";
import { EXTENDED_ENVIRONMENTS } from "@/data/environment-extensions";
import { ReferenceImageUpload } from "@/components/studio/ReferenceImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ImageStudioHub = lazy(() => import("./ImageStudioHub").then((m) => ({ default: m.ImageStudioHub })));
const PhotoEditorHub = lazy(() => import("@/components/photo-editor/PhotoEditorHub").then((m) => ({ default: m.PhotoEditorHub })));

type Mode = "text-to-video" | "image-to-video" | "avatar";
type ModuleId =
  | "generate" | "image" | "photo"
  | "cast" | "voice" | "music" | "worlds" | "look" | "story" | "templates";

/* shared selections every module reads/writes */
interface PickAvatar { id: string; name: string; imageUrl: string; voiceId?: string }
interface PickEnv { id: string; name: string; image: string; description?: string }
interface Selections {
  avatar: PickAvatar | null;
  env: PickEnv | null;
  referenceImage: string | null;
  voiceId: string | null;
  voiceName: string | null;
  look: string | null;
  music: { enable: boolean; genre: string; mood: string };
  story: string;
}
const EMPTY_SEL: Selections = { avatar: null, env: null, referenceImage: null, voiceId: null, voiceName: null, look: null, music: { enable: false, genre: "cinematic", mood: "epic" }, story: "" };

interface Module { id: ModuleId; label: string; icon: LucideIcon; group: "create" | "assets" | "finish"; blurb?: string }
const MODULES: Module[] = [
  { id: "generate", label: "Generate", icon: Wand2, group: "create" },
  { id: "image", label: "Image", icon: ImageIcon, group: "create" },
  { id: "photo", label: "Photo edit", icon: Scissors, group: "create" },
  { id: "cast", label: "Cast", icon: Users, group: "assets" },
  { id: "voice", label: "Voice", icon: Mic, group: "assets" },
  { id: "music", label: "Music", icon: MusicIcon, group: "assets" },
  { id: "worlds", label: "Worlds", icon: Globe2, group: "assets" },
  { id: "look", label: "Look", icon: Palette, group: "finish" },
  { id: "story", label: "Story", icon: PenLine, group: "finish" },
  { id: "templates", label: "Templates", icon: LayoutGrid, group: "finish" },
];

const MODES: { id: Mode; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "text-to-video", label: "Cinematic", icon: Wand2, hint: "A lone astronaut watching twin suns set over a glass desert…" },
  { id: "image-to-video", label: "Animate", icon: ImageIcon, hint: "Describe how your image should come to life…" },
  { id: "avatar", label: "Avatar", icon: Users, hint: "What should your presenter say to camera?" },
];
const ASPECTS: { id: "16:9" | "9:16" | "1:1"; label: string }[] = [
  { id: "16:9", label: "Wide" }, { id: "9:16", label: "Tall" }, { id: "1:1", label: "Square" },
];
const GENRES = ["cinematic", "documentary", "commercial", "educational", "narrative", "motivational"];
const MOODS = ["epic", "suspense", "emotional", "action", "mystery", "uplifting", "dark", "romantic"];
// Real narration voices — these ids match generate-voice's VOICE_MAP (MiniMax),
// so the voice you pick + preview is the exact voice your film narrates with.
const VOICES: { id: string; name: string; tone: string; sample: string }[] = [
  { id: "adam",   name: "Adam",   tone: "Expressive narrator",   sample: "By the end of this, you'll see it differently." },
  { id: "fable",  name: "Fable",  tone: "Captivating storyteller", sample: "Once, in a city that never slept, a light flickered on." },
  { id: "nova",   name: "Nova",   tone: "Confident woman",        sample: "Let's get into it — here's exactly what matters." },
  { id: "sarah",  name: "Sarah",  tone: "Calm and warm",          sample: "Take a breath. We'll walk through it together." },
  { id: "onyx",   name: "Onyx",   tone: "Deep, commanding",       sample: "Some doors open only once. This is one of them." },
  { id: "george", name: "George", tone: "Refined gentleman",      sample: "Allow me to show you something rather remarkable." },
  { id: "bella",  name: "Bella",  tone: "Upbeat and bright",      sample: "Okay — this is going to be so good. Watch this." },
  { id: "aria",   name: "Aria",   tone: "Assertive lead",         sample: "I don't ask twice. So listen closely." },
];
const LOOKS = ["Kodak 2383", "Teal & Orange", "Bleach Bypass", "Noir B&W", "Golden Hour", "Cyberpunk Neon", "Vintage 16mm", "Cold Thriller", "Pastel Dream", "High Contrast"];
const BREAKOUTS: { id: string; label: string; desc: string }[] = [
  { id: "post-escape", label: "Post Escape", desc: "Smash through a social feed" },
  { id: "scroll-grab", label: "Scroll Grab", desc: "Reach out of a phone" },
  { id: "freeze-walk", label: "Freeze Walk", desc: "Step out of a video call" },
  { id: "reality-rip", label: "Reality Rip", desc: "Tear through reality" },
  { id: "aspect-escape", label: "Aspect Escape", desc: "Break the frame ratio" },
  { id: "mirror-shatter", label: "Mirror Shatter", desc: "Break a baroque mirror" },
  { id: "canvas-emerge", label: "Canvas Emerge", desc: "Step out of a painting" },
  { id: "billboard-leap", label: "Billboard Leap", desc: "Leap off a neon billboard" },
  { id: "page-burst", label: "Page Burst", desc: "Burst from a book page" },
  { id: "hologram-materialize", label: "Hologram", desc: "Solidify from a hologram" },
];

const ACCENT = "hsl(var(--accent))";

function modeAllowed(spec: EngineSpec, mode: Mode): boolean {
  if (mode === "avatar") return spec.supportsAvatar;
  if (mode === "image-to-video") return spec.supportsImageInput;
  return true;
}

/* ── engine card ─────────────────────────────────────────────── */
function EngineCard({ spec, active, disabled, costFor, onSelect }: {
  spec: EngineSpec; active: boolean; disabled: boolean; costFor: (s: EngineSpec) => number; onSelect: () => void;
}) {
  const is4k = spec.qualityProfiles.some((q) => q.resolution === "4K");
  const cost = costFor(spec);
  return (
    <button type="button" onClick={onSelect} disabled={disabled}
      className={[
        "group relative flex flex-col rounded-2xl p-4 text-left transition-all ring-1 ring-inset",
        active ? "bg-[hsl(var(--accent)/0.10)] ring-[hsl(var(--accent)/0.55)]"
               : "bg-[hsl(var(--foreground)/0.03)] ring-[hsl(var(--foreground)/0.08)] hover:bg-[hsl(var(--foreground)/0.06)]",
        disabled ? "cursor-not-allowed opacity-40" : "hover:-translate-y-0.5",
      ].join(" ")}>
      {active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: ACCENT }}><Check className="h-3 w-3 text-white" /></span>}
      {disabled && <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{spec.provider}</span>
        <span className="rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]"
          style={spec.tier === "cinema" ? { background: "hsl(var(--accent)/0.16)", color: ACCENT } : { background: "hsl(var(--foreground)/0.06)", color: "hsl(var(--muted-foreground))" }}>
          {spec.baseCreditsFor(spec.durations[0]) === 0 ? "Free" : TIER_LABEL[spec.tier]}
        </span>
      </div>
      <div className="mt-1.5 font-display text-[16px] font-semibold leading-tight text-foreground">{spec.shortLabel}</div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {spec.supportsAudio && <Chip>Audio</Chip>}
        {is4k && <Chip>4K</Chip>}
        {spec.supportsAvatar && <Chip>Avatars</Chip>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--foreground)/0.07)] pt-2.5">
        <span className="font-mono text-[10px] text-muted-foreground">up to {spec.maxDuration}s</span>
        <span className="font-mono text-[11px] font-medium" style={{ color: ACCENT }}>{cost === 0 ? "Free" : `${cost} cr`}</span>
      </div>
    </button>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-[hsl(var(--foreground)/0.06)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">{children}</span>;
}
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={["rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ring-1 ring-inset",
        active ? "bg-[hsl(var(--accent)/0.14)] text-foreground ring-[hsl(var(--accent)/0.5)]"
               : "bg-[hsl(var(--foreground)/0.03)] text-muted-foreground ring-[hsl(var(--foreground)/0.08)] hover:text-foreground"].join(" ")}>
      {children}
    </button>
  );
}

/* build the final prompt from prompt + world + look + story */
function buildPrompt(sel: Selections, prompt: string): string {
  const parts: string[] = [];
  if (sel.env) parts.push(`Setting — ${sel.env.name}: ${sel.env.description ?? ""}`.trim());
  if (sel.look) parts.push(`Color grade — ${sel.look}.`);
  if (sel.story.trim()) parts.push(sel.story.trim());
  parts.push(prompt.trim());
  return parts.filter(Boolean).join("\n");
}

/* ── generate module ─────────────────────────────────────────── */
function GenerateModule({ sel, setSel, onStartCreation, initialPrompt }: { sel: Selections; setSel: (s: Selections) => void; onStartCreation: (c: Record<string, unknown>) => void; initialPrompt?: string }) {
  const engines = useMemo(() => listEngines({ healthyOnly: true }), []);
  const [mode, setMode] = useState<Mode>("text-to-video");
  const [engineId, setEngineId] = useState<EngineId>(DEFAULT_ENGINE_ID);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [profileId, setProfileId] = useState<string>("");
  const [duration, setDuration] = useState<number>(ENGINES[DEFAULT_ENGINE_ID].defaultDuration);
  const [scenes, setScenes] = useState(4);
  const [narration, setNarration] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState("cinematic");
  const [mood, setMood] = useState("epic");

  const spec = ENGINES[engineId];
  const profile = spec.qualityProfiles.find((q) => q.id === profileId) ?? spec.qualityProfiles.find((q) => q.recommended) ?? spec.qualityProfiles[0];

  useEffect(() => {
    if (!modeAllowed(spec, mode)) {
      const next = engines.find((e) => modeAllowed(e, mode));
      if (next) setEngineId(next.id);
      return;
    }
    setDuration((d) => clampDurationForEngine(engineId, d));
    setProfileId((p) => (spec.qualityProfiles.some((q) => q.id === p) ? p : (spec.qualityProfiles.find((q) => q.recommended)?.id ?? spec.qualityProfiles[0].id)));
  }, [engineId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const costFor = (s: EngineSpec) => {
    const d = clampDurationForEngine(s.id, duration);
    const prof = s.qualityProfiles.find((q) => q.recommended) ?? s.qualityProfiles[0];
    // Base × scenes + quality surcharge ONCE (4K/60fps are final-film post).
    return s.baseCreditsFor(d) * scenes + renderSurchargeCredits(s, prof.options);
  };
  // Quality cores (4K upscale / 60fps) are post-processing on the FINAL film,
  // billed once per render — not per clip. So: base × scenes + surcharge once.
  const totalCost = spec.baseCreditsFor(duration) * scenes + renderSurchargeCredits(spec, profile.options);
  const runtime = duration * scenes;

  const canCreate =
    mode === "text-to-video" ? prompt.trim().length > 4
    : mode === "image-to-video" ? !!sel.referenceImage && prompt.trim().length > 0
    : /* avatar */ !!sel.avatar && prompt.trim().length > 0;

  const create = () => {
    if (!canCreate) return;
    const cfg: Record<string, unknown> = {
      mode,
      prompt: buildPrompt(sel, prompt),
      aspectRatio: aspect,
      clipCount: scenes,
      clipDuration: duration,
      clipDurations: Array.from({ length: scenes }, () => duration),
      enableNarration: narration,
      enableMusic: sel.music.enable,
      genre: sel.music.enable ? sel.music.genre : genre,
      mood: sel.music.enable ? sel.music.mood : mood,
      videoEngine: engineToBackend(engineId),
      voiceId: sel.voiceId ?? undefined,
      // Quality cores (4K / 60fps) — honored on the final film, billed once.
      qualityOptions: {
        upscale4k: !!profile.options.upscale4k,
        fps60: !!profile.options.fps60,
      },
    };
    if (mode === "image-to-video") cfg.imageUrl = sel.referenceImage;
    if (mode === "avatar" && sel.avatar) {
      cfg.imageUrl = sel.avatar.imageUrl;
      cfg.voiceId = sel.voiceId ?? sel.avatar.voiceId ?? undefined;
      cfg.avatarImageUrl = sel.avatar.imageUrl;
      cfg.avatarName = sel.avatar.name;
      cfg.avatarTemplateId = sel.avatar.id;
      cfg.avatarVoiceId = sel.avatar.voiceId;
    }
    onStartCreation(cfg);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-9">
        <div className="mx-auto max-w-3xl">
          {/* mode */}
          <div className="inline-flex gap-1 rounded-full bg-[hsl(var(--foreground)/0.04)] p-1 ring-1 ring-inset ring-[hsl(var(--foreground)/0.07)]">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)}
                className={["inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  mode === m.id ? "bg-[hsl(var(--accent)/0.16)] text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>

          {/* image-to-video: reference upload */}
          {mode === "image-to-video" && (
            <div className="mt-5">
              <ReferenceImageUpload
                targetAspectRatio={aspect}
                existingAnalysis={sel.referenceImage ? ({ imageUrl: sel.referenceImage } as never) : undefined}
                onAnalysisComplete={(a) => setSel({ ...sel, referenceImage: a.imageUrl })}
                onClear={() => setSel({ ...sel, referenceImage: null })}
              />
            </div>
          )}

          {/* avatar: chosen cast member */}
          {mode === "avatar" && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-3 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
              {sel.avatar ? (
                <>
                  <img src={sel.avatar.imageUrl} alt={sel.avatar.name} className="h-12 w-12 rounded-xl object-cover" />
                  <div className="flex-1"><div className="text-[14px] font-medium text-foreground">{sel.avatar.name}</div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">your presenter</div></div>
                </>
              ) : (
                <div className="text-[13px] text-muted-foreground">Pick a presenter in the <span className="text-foreground">Cast</span> module →</div>
              )}
            </div>
          )}

          {/* prompt */}
          <div className="mt-5 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-1 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus-within:ring-[hsl(var(--accent)/0.4)]">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
              placeholder={MODES.find((m) => m.id === mode)!.hint} rows={3}
              className="w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50" />
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="font-mono text-[10px] text-muted-foreground/60">{prompt.length}/1000</span>
              {(sel.env || sel.look || sel.voiceId) && (
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {[sel.env?.name, sel.look, sel.voiceName].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          </div>

          {/* engine */}
          <SectionLabel icon={Cpu}>Engine</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {engines.map((e) => (
              <EngineCard key={e.id} spec={e} active={e.id === engineId} disabled={!modeAllowed(e, mode)} costFor={costFor} onSelect={() => modeAllowed(e, mode) && setEngineId(e.id)} />
            ))}
          </div>

          {/* format */}
          <SectionLabel icon={Film}>Format</SectionLabel>
          <div className="space-y-4 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-4 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
            <Row label="Aspect">{ASPECTS.map((a) => <Pill key={a.id} active={aspect === a.id} onClick={() => setAspect(a.id)}>{a.id} · {a.label}</Pill>)}</Row>
            <Row label="Quality">{spec.qualityProfiles.map((q) => <Pill key={q.id} active={profile.id === q.id} onClick={() => setProfileId(q.id)}>{q.label}</Pill>)}</Row>
            <Row label="Duration">{spec.durations.map((d) => <Pill key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Pill>)}</Row>
            <Row label="Scenes">
              <Stepper value={scenes} min={1} max={spec.maxScenesPerProject} onChange={setScenes} />
              <span className="font-mono text-[11px] text-muted-foreground">≈ {runtime}s total</span>
            </Row>
          </div>

          {/* advanced */}
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
            <Sparkles className="h-3.5 w-3.5" /> {showAdvanced ? "Hide" : "Style & sound"}
          </button>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 grid gap-4 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-4 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] sm:grid-cols-2">
                  <Field label="Genre"><Select value={genre} onChange={setGenre} options={GENRES} /></Field>
                  <Field label="Mood"><Select value={mood} onChange={setMood} options={MOODS} /></Field>
                  <Toggle label="Narration" icon={Mic} on={narration} onClick={() => setNarration((v) => !v)} />
                  <Toggle label="Music score" icon={Volume2} on={sel.music.enable} onClick={() => setSel({ ...sel, music: { ...sel.music, enable: !sel.music.enable } })} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* composition bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--background)/0.6)] px-6 py-4 backdrop-blur-xl sm:px-9">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">{MODES.find((m) => m.id === mode)!.label}</span>
          <Dot /><span>{spec.shortLabel}</span>
          <Dot /><span>{aspect}</span>
          <Dot /><span>{scenes} {scenes === 1 ? "scene" : "scenes"} · {runtime}s</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px]" style={{ color: ACCENT }}>{totalCost === 0 ? "Free" : `${totalCost} credits`}</span>
          <button type="button" onClick={create} disabled={!canCreate}
            className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-transform disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, boxShadow: canCreate ? `0 12px 36px -10px ${ACCENT}` : "none" }}>
            <Sparkles className="h-4 w-4" /> Create <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── cast (avatar picker) ────────────────────────────────────── */
const CAST_PAGE = 48; // avatars per page — real pagination, not infinite scroll

function CastModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  const { templates, isLoading } = useAvatarTemplatesQuery();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const gridTopRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? templates.filter((t) => t.name.toLowerCase().includes(s)) : templates;
  }, [templates, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / CAST_PAGE));
  // Keep the page index in range whenever the result set shrinks (e.g. search).
  useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)); }, [pageCount]);
  // New search → back to the first page.
  useEffect(() => { setPage(0); }, [q]);

  const start = page * CAST_PAGE;
  const list = useMemo(() => filtered.slice(start, start + CAST_PAGE), [filtered, start]);

  const goTo = (p: number) => {
    setPage(Math.max(0, Math.min(pageCount - 1, p)));
    // Snap the grid back into view so the new page starts at the top.
    gridTopRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <ModuleScroll title="Cast" subtitle="Pick a presenter — locks identity for Avatar mode and breakouts. Or build your own.">
      <CastBuilder sel={sel} setSel={setSel} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search avatars…"
            className="w-full rounded-full bg-[hsl(var(--foreground)/0.04)] py-2.5 pl-9 pr-4 text-[13px] text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
        </div>
        {!isLoading && filtered.length > 0 && (
          <span className="text-[11.5px] font-medium text-muted-foreground tabular-nums">
            {filtered.length} avatars{sel.avatar ? <> · <span className="text-accent">{sel.avatar.name} selected</span></> : null}
          </span>
        )}
      </div>

      <div ref={gridTopRef} className="scroll-mt-4" />

      {isLoading ? <p className="text-[13px] text-muted-foreground">Loading the cast…</p> : filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No avatars match “{q.trim()}”.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {list.map((t) => {
              const on = sel.avatar?.id === t.id;
              const voiceId = (t as { voice_id?: string; default_voice_id?: string }).voice_id ?? (t as { default_voice_id?: string }).default_voice_id;
              return (
                <button key={t.id} type="button"
                  onClick={() => setSel({ ...sel, avatar: { id: t.id, name: t.name, imageUrl: t.face_image_url, voiceId } })}
                  className={["group relative overflow-hidden rounded-xl ring-1 ring-inset transition-all", on ? "ring-2 ring-[hsl(var(--accent)/0.85)]" : "ring-[hsl(var(--foreground)/0.08)] hover:-translate-y-0.5"].join(" ")}>
                  <img src={t.face_image_url} alt={t.name} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 text-left text-[10px] font-medium text-white">{t.name}</div>
                  {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: ACCENT }}><Check className="h-3 w-3 text-white" /></span>}
                </button>
              );
            })}
          </div>

          {/* Real pager — Prev / page indicator / Next. Every avatar reachable. */}
          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => goTo(page - 1)} disabled={page === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--foreground)/0.04)] px-4 py-2 text-[12px] text-foreground ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] transition-colors hover:bg-[hsl(var(--foreground)/0.08)] disabled:opacity-40 disabled:pointer-events-none">
                <ArrowLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                Page <span className="text-foreground">{page + 1}</span> of {pageCount}
                <span className="mx-1.5 opacity-40">·</span>
                {start + 1}–{Math.min(start + CAST_PAGE, filtered.length)} of {filtered.length}
              </span>
              <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pageCount - 1}
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--foreground)/0.04)] px-4 py-2 text-[12px] text-foreground ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] transition-colors hover:bg-[hsl(var(--foreground)/0.08)] disabled:opacity-40 disabled:pointer-events-none">
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </ModuleScroll>
  );
}

/* ── cast — build your own avatar ────────────────────────────── */
type AvatarGenResult = { name: string; frontImageUrl: string; sideImageUrl?: string; backImageUrl?: string };
const AGE_RANGES: { id: string; label: string }[] = [
  { id: "young-adult", label: "Young adult" }, { id: "adult", label: "Adult" },
  { id: "middle-aged", label: "Middle-aged" }, { id: "mature", label: "Mature" },
];
const ETHNICITY_PRESETS = ["African", "East Asian", "South Asian", "Caucasian", "Hispanic / Latino", "Middle Eastern", "Mixed"];

function CastBuilder({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [ageRange, setAgeRange] = useState("adult");
  const [ethnicity, setEthnicity] = useState("Caucasian");
  const [style, setStyle] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AvatarGenResult | null>(null);

  const canSubmit = name.trim().length > 0 && ethnicity.trim().length > 0 && status !== "generating";

  const generate = async () => {
    if (!canSubmit) return;
    if (!user) { setStatus("error"); setError("Please sign in to build a custom avatar."); return; }
    setStatus("generating");
    setError(null);
    setPreview(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-avatar-image", {
        body: {
          name: name.trim(),
          gender,
          ageRange,
          ethnicity: ethnicity.trim(),
          style: style.trim() || undefined,
        },
      });
      if (fnError) throw new Error(fnError.message || "Avatar generation failed.");
      const result = data as AvatarGenResult & { error?: string };
      if (result?.error) throw new Error(result.error);
      if (!result?.frontImageUrl) throw new Error("No avatar image was returned.");
      setPreview(result);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Avatar generation failed.");
    }
  };

  const useAvatar = () => {
    if (!preview?.frontImageUrl) return;
    setSel({
      ...sel,
      avatar: { id: "custom-" + crypto.randomUUID(), name: name.trim() || "Custom avatar", imageUrl: preview.frontImageUrl, voiceId: undefined },
    });
  };

  return (
    <div className="mb-6 rounded-2xl bg-[hsl(var(--foreground)/0.03)] ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/0.12)]"><UserPlus className="h-4 w-4" style={{ color: ACCENT }} /></span>
          <span>
            <span className="block text-[14px] font-medium text-foreground">Build your own avatar</span>
            <span className="block text-[11.5px] text-muted-foreground">Generate a brand-new photoreal presenter from a description.</span>
          </span>
        </span>
        <span className="font-mono text-[18px] leading-none text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-[hsl(var(--foreground)/0.07)] px-4 py-4 sm:grid-cols-2">
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Mara Vance"
                  className="w-full rounded-lg bg-[hsl(var(--foreground)/0.05)] px-3 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
              </Field>
              <Field label="Gender">
                <div className="flex gap-2">
                  <Pill active={gender === "female"} onClick={() => setGender("female")}>Female</Pill>
                  <Pill active={gender === "male"} onClick={() => setGender("male")}>Male</Pill>
                </div>
              </Field>
              <Field label="Age range"><Select value={ageRange} onChange={setAgeRange} options={AGE_RANGES.map((a) => a.id)} /></Field>
              <Field label="Ethnicity">
                <input value={ethnicity} onChange={(e) => setEthnicity(e.target.value.slice(0, 60))} list="cast-ethnicity-presets" placeholder="e.g. East Asian"
                  className="w-full rounded-lg bg-[hsl(var(--foreground)/0.05)] px-3 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
                <datalist id="cast-ethnicity-presets">{ETHNICITY_PRESETS.map((e) => <option key={e} value={e} />)}</datalist>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Style (optional)">
                  <input value={style} onChange={(e) => setStyle(e.target.value.slice(0, 120))} placeholder="e.g. tailored navy suit, warm studio lighting"
                    className="w-full rounded-lg bg-[hsl(var(--foreground)/0.05)] px-3 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
                </Field>
              </div>

              {error && <p className="text-[12px] text-red-400 sm:col-span-2">{error}</p>}

              {preview && (
                <div className="flex items-center gap-4 rounded-xl bg-[hsl(var(--foreground)/0.04)] p-3 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] sm:col-span-2">
                  <img src={preview.frontImageUrl} alt={name || "Custom avatar"} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
                  <div className="flex-1">
                    <div className="text-[14px] font-medium text-foreground">{name.trim() || "Custom avatar"}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">your generated presenter</div>
                  </div>
                  <button type="button" onClick={useAvatar}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
                    style={{ background: ACCENT, boxShadow: `0 12px 36px -10px ${ACCENT}` }}>
                    <Check className="h-4 w-4" /> Use this avatar
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 sm:col-span-2">
                <button type="button" onClick={generate} disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-transform disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: ACCENT, boxShadow: canSubmit ? `0 12px 36px -10px ${ACCENT}` : "none" }}>
                  {status === "generating"
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-4 w-4" /> {preview ? "Regenerate" : "Generate avatar"}</>}
                </button>
                {status === "generating" && <span className="font-mono text-[11px] text-muted-foreground">Rendering a photoreal presenter — this can take ~30s.</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── worlds (environment picker) ─────────────────────────────── */
function WorldsModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  const list = EXTENDED_ENVIRONMENTS.slice(0, 60);
  return (
    <ModuleScroll title="Worlds" subtitle="Lock an environment — its place and light fold into every scene.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((e) => {
          const on = sel.env?.id === e.id;
          return (
            <button key={e.id} type="button"
              onClick={() => setSel({ ...sel, env: on ? null : { id: e.id, name: e.name, image: e.image, description: e.description } })}
              className={["group relative overflow-hidden rounded-xl ring-1 ring-inset transition-all", on ? "ring-[hsl(var(--accent)/0.7)]" : "ring-[hsl(var(--foreground)/0.08)] hover:-translate-y-0.5"].join(" ")}>
              <img src={e.image} alt={e.name} loading="lazy" className="aspect-video w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 text-left"><div className="text-[12px] font-semibold text-white">{e.name}</div><div className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/55">{e.category}</div></div>
              {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: ACCENT }}><Check className="h-3 w-3 text-white" /></span>}
            </button>
          );
        })}
      </div>
    </ModuleScroll>
  );
}

/* ── voice ───────────────────────────────────────────────────── */
function VoiceModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({});

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const preview = async (v: typeof VOICES[number], e: React.MouseEvent) => {
    e.stopPropagation();
    audioRef.current?.pause();
    if (playingId === v.id) { setPlayingId(null); return; }
    try {
      let url = cacheRef.current[v.id];
      if (!url) {
        setLoadingId(v.id);
        const { data, error } = await supabase.functions.invoke("generate-voice", {
          body: { text: v.sample, voiceId: v.id },
        });
        if (error) throw error;
        const payload = (data ?? {}) as { audioUrl?: string; url?: string; audio_url?: string };
        url = payload.audioUrl || payload.url || payload.audio_url || "";
        if (!url) throw new Error("No audio returned");
        cacheRef.current[v.id] = url;
      }
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = url;
      a.onended = () => setPlayingId(null);
      await a.play();
      setPlayingId(v.id);
    } catch {
      toast.error("Voice preview isn't available right now.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <ModuleScroll title="Voice" subtitle="Choose a narration / character voice — tap the speaker to hear it first.">
      <div className="grid max-w-2xl gap-2.5 sm:grid-cols-2">
        {VOICES.map((v) => {
          const on = sel.voiceId === v.id;
          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => setSel({ ...sel, voiceId: on ? null : v.id, voiceName: on ? null : v.name })}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel({ ...sel, voiceId: on ? null : v.id, voiceName: on ? null : v.name }); } }}
              className={["flex cursor-pointer items-center justify-between rounded-xl p-4 text-left ring-1 ring-inset transition-colors outline-none",
                on ? "bg-[hsl(var(--accent)/0.1)] ring-[hsl(var(--accent)/0.5)]" : "bg-[hsl(var(--foreground)/0.03)] ring-[hsl(var(--foreground)/0.08)] hover:bg-[hsl(var(--foreground)/0.06)]"].join(" ")}>
              <span className="inline-flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--accent)/0.12)] shrink-0"><Mic className="h-4 w-4" style={{ color: ACCENT }} /></span>
                <span className="min-w-0"><span className="block text-[14px] font-medium text-foreground">{v.name}</span><span className="block truncate text-[12px] text-muted-foreground">{v.tone}</span></span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => preview(v, e)}
                  aria-label={playingId === v.id ? `Stop ${v.name} preview` : `Hear ${v.name}`}
                  className={["flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    playingId === v.id ? "bg-[hsl(var(--accent)/0.2)] text-accent" : "bg-white/[0.06] text-foreground/70 hover:bg-white/[0.12] hover:text-foreground"].join(" ")}
                >
                  {loadingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                {on && <Check className="h-4 w-4" style={{ color: ACCENT }} />}
              </span>
            </div>
          );
        })}
      </div>
    </ModuleScroll>
  );
}

/* ── music ───────────────────────────────────────────────────── */
function MusicModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  const m = sel.music;
  return (
    <ModuleScroll title="Music" subtitle="Score your film — a beat-matched track is generated and mixed under your scenes.">
      <div className="max-w-xl space-y-5">
        <Toggle label="Generate a score" icon={MusicIcon} on={m.enable} onClick={() => setSel({ ...sel, music: { ...m, enable: !m.enable } })} />
        <Field label="Genre"><Select value={m.genre} onChange={(genre) => setSel({ ...sel, music: { ...m, genre } })} options={["cinematic", "orchestral", "electronic", "ambient", "hip-hop", "rock", "lofi", "trailer"]} /></Field>
        <Field label="Mood"><Select value={m.mood} onChange={(mood) => setSel({ ...sel, music: { ...m, mood } })} options={MOODS} /></Field>
        <p className="text-[12px] text-muted-foreground">{m.enable ? `A ${m.mood} ${m.genre} score will be generated and mixed in.` : "Music is off — toggle on to score this film."}</p>
      </div>
    </ModuleScroll>
  );
}

/* ── look (grade) ────────────────────────────────────────────── */
function LookModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  return (
    <ModuleScroll title="Look" subtitle="Pick a film grade — it's woven into the generation prompt.">
      <div className="grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-3">
        {LOOKS.map((l) => {
          const on = sel.look === l;
          return (
            <button key={l} type="button" onClick={() => setSel({ ...sel, look: on ? null : l })}
              className={["flex items-center justify-between rounded-xl px-4 py-3 text-left text-[13px] ring-1 ring-inset transition-colors",
                on ? "bg-[hsl(var(--accent)/0.1)] text-foreground ring-[hsl(var(--accent)/0.5)]" : "bg-[hsl(var(--foreground)/0.03)] text-muted-foreground ring-[hsl(var(--foreground)/0.08)] hover:text-foreground"].join(" ")}>
              {l} {on && <Check className="h-4 w-4" style={{ color: ACCENT }} />}
            </button>
          );
        })}
      </div>
    </ModuleScroll>
  );
}

/* ── story ───────────────────────────────────────────────────── */
function StoryModule({ sel, setSel }: { sel: Selections; setSel: (s: Selections) => void }) {
  return (
    <ModuleScroll title="Story" subtitle="Write a logline or beat sheet — it seeds every scene's prompt in Generate.">
      <textarea value={sel.story} onChange={(e) => setSel({ ...sel, story: e.target.value.slice(0, 2000) })}
        placeholder="A retired detective is pulled back for one last case in a rain-soaked neon city…" rows={10}
        className="w-full max-w-2xl resize-none rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-4 text-[14px] leading-relaxed text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">{sel.story.length}/2000</p>
    </ModuleScroll>
  );
}

/* ── templates (4th-wall breakouts + crossovers) ─────────────── */
type TemplatesTab = "breakouts" | "crossovers";

function TemplatesModule({ sel, onStartCreation }: { sel: Selections; onStartCreation: (c: Record<string, unknown>) => void }) {
  const [tab, setTab] = useState<TemplatesTab>("breakouts");
  const tabSwitch = (
    <div className="mb-6 inline-flex gap-1 rounded-full bg-[hsl(var(--foreground)/0.04)] p-1 ring-1 ring-inset ring-[hsl(var(--foreground)/0.07)]">
      {([["breakouts", "Breakouts"], ["crossovers", "Crossovers"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)}
          className={["rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
            tab === id ? "bg-[hsl(var(--accent)/0.16)] text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
          {label}
        </button>
      ))}
    </div>
  );
  return tab === "breakouts"
    ? <BreakoutsPanel sel={sel} onStartCreation={onStartCreation} tabSwitch={tabSwitch} />
    : <CrossoversPanel sel={sel} onStartCreation={onStartCreation} tabSwitch={tabSwitch} />;
}

function BreakoutsPanel({ sel, onStartCreation, tabSwitch }: { sel: Selections; onStartCreation: (c: Record<string, unknown>) => void; tabSwitch: React.ReactNode }) {
  const [platform, setPlatform] = useState<string>("post-escape");
  const [dialogue, setDialogue] = useState("");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const canCreate = !!sel.avatar;
  const create = () => {
    if (!sel.avatar) return;
    onStartCreation({
      mode: "avatar",
      prompt: dialogue.trim() || `${sel.avatar.name} breaks out of the screen.`,
      aspectRatio: aspect,
      clipCount: 3, clipDuration: 5, clipDurations: [5, 5, 5],
      enableNarration: false, enableMusic: true, genre: "cinematic", mood: "epic",
      videoEngine: "seedance", // breakouts are Seedance-only (guardrails enforce too)
      isBreakout: true,
      breakoutPlatform: platform,
      breakoutStartImageUrl: sel.avatar.imageUrl,
      avatarImageUrl: sel.avatar.imageUrl,
      avatarName: sel.avatar.name,
      avatarTemplateId: sel.avatar.id,
      avatarVoiceId: sel.avatar.voiceId,
    });
  };
  return (
    <div className="flex h-full flex-col">
      <ModuleScroll title="Templates" subtitle="4th-wall breakouts — your cast bursts out of a post, mirror or billboard. Seedance-only, identity-locked.">
        {tabSwitch}
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-3 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
          {sel.avatar ? (
            <><img src={sel.avatar.imageUrl} alt={sel.avatar.name} className="h-12 w-12 rounded-xl object-cover" /><div className="flex-1"><div className="text-[14px] font-medium text-foreground">{sel.avatar.name}</div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">breaks out</div></div></>
          ) : <div className="text-[13px] text-muted-foreground">Pick a presenter in the <span className="text-foreground">Cast</span> module first →</div>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BREAKOUTS.map((b) => {
            const on = platform === b.id;
            return (
              <button key={b.id} type="button" onClick={() => setPlatform(b.id)}
                className={["rounded-xl p-3.5 text-left ring-1 ring-inset transition-all",
                  on ? "bg-[hsl(var(--accent)/0.1)] ring-[hsl(var(--accent)/0.55)]" : "bg-[hsl(var(--foreground)/0.03)] ring-[hsl(var(--foreground)/0.08)] hover:-translate-y-0.5"].join(" ")}>
                <div className="text-[13px] font-semibold text-foreground">{b.label}</div>
                <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{b.desc}</div>
              </button>
            );
          })}
        </div>
        <SectionLabel icon={Mic}>Line they speak (optional)</SectionLabel>
        <input value={dialogue} onChange={(e) => setDialogue(e.target.value.slice(0, 200))} placeholder="You were never supposed to find this…"
          className="w-full max-w-2xl rounded-xl bg-[hsl(var(--foreground)/0.03)] px-4 py-3 text-[14px] text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] focus:ring-[hsl(var(--accent)/0.4)]" />
        <SectionLabel icon={Film}>Aspect</SectionLabel>
        <div className="flex gap-2">{ASPECTS.map((a) => <Pill key={a.id} active={aspect === a.id} onClick={() => setAspect(a.id)}>{a.id} · {a.label}</Pill>)}</div>
      </ModuleScroll>
      <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--background)/0.6)] px-6 py-4 backdrop-blur-xl sm:px-9">
        <span className="font-mono text-[11px] text-muted-foreground">Seedance · 3 clips · 15s · identity-locked</span>
        <button type="button" onClick={create} disabled={!canCreate}
          className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-transform disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT, boxShadow: canCreate ? `0 12px 36px -10px ${ACCENT}` : "none" }}>
          <Sparkles className="h-4 w-4" /> Break out <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ── templates → crossovers ──────────────────────────────────── */
function CrossoversPanel({ sel, onStartCreation, tabSwitch }: { sel: Selections; onStartCreation: (c: Record<string, unknown>) => void; tabSwitch: React.ReactNode }) {
  const { blueprints, loading, error } = useAllCrossoverBlueprints();
  const [picked, setPicked] = useState<string | null>(null);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("9:16");

  const selected = useMemo(() => blueprints.find((b) => b.id === picked) ?? null, [blueprints, picked]);
  // require a selected avatar only when the crossover injects a subject
  const needsAvatar = !!selected?.acceptsSubject;
  const canCreate = !!selected && (!needsAvatar || !!sel.avatar);

  const create = () => {
    if (!selected) return;
    if (selected.acceptsSubject && !sel.avatar) return;
    onStartCreation({
      mode: "image-to-video",
      prompt: selected.purePrompt,
      imageUrl: sel.avatar?.imageUrl,
      aspectRatio: aspect,
      clipCount: 1,
      clipDuration: 5,
      clipDurations: [5],
      enableNarration: false,
      enableMusic: false,
      genre: "cinematic",
      mood: "epic",
      videoEngine: engineToBackend(selected.engine),
      avatarImageUrl: sel.avatar?.imageUrl,
      avatarName: sel.avatar?.name,
      templateName: selected.name,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <ModuleScroll title="Templates" subtitle="Crossovers — drop your cast into a viral world: phones, billboards, holograms, paintings and more.">
        {tabSwitch}
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[hsl(var(--foreground)/0.03)] p-3 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
          {sel.avatar ? (
            <><img src={sel.avatar.imageUrl} alt={sel.avatar.name} className="h-12 w-12 rounded-xl object-cover" /><div className="flex-1"><div className="text-[14px] font-medium text-foreground">{sel.avatar.name}</div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">your subject</div></div></>
          ) : <div className="text-[13px] text-muted-foreground">Pick a presenter in the <span className="text-foreground">Cast</span> module to use subject-locked crossovers →</div>}
        </div>

        {loading ? <p className="text-[13px] text-muted-foreground">Loading crossovers…</p>
          : error ? <p className="text-[13px] text-red-400">Couldn't load crossovers — {error.message}</p>
          : blueprints.length === 0 ? <p className="text-[13px] text-muted-foreground">No crossovers available.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {blueprints.map((b) => {
              const on = picked === b.id;
              return (
                <button key={b.id} type="button" onClick={() => setPicked(b.id)}
                  className={["group relative overflow-hidden rounded-xl ring-1 ring-inset transition-all text-left", on ? "ring-[hsl(var(--accent)/0.7)]" : "ring-[hsl(var(--foreground)/0.08)] hover:-translate-y-0.5"].join(" ")}>
                  {b.thumbnailUrl ? (
                    <img src={b.thumbnailUrl} alt={b.name} loading="lazy" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center bg-[hsl(var(--foreground)/0.05)]"><LayoutGrid className="h-6 w-6 text-muted-foreground/50" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <div className="text-[12px] font-semibold text-white">{b.name}</div>
                    {b.acceptsSubject && <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/55">subject-locked</div>}
                  </div>
                  {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: ACCENT }}><Check className="h-3 w-3 text-white" /></span>}
                </button>
              );
            })}
          </div>
        )}

        <SectionLabel icon={Film}>Aspect</SectionLabel>
        <div className="flex gap-2">{ASPECTS.map((a) => <Pill key={a.id} active={aspect === a.id} onClick={() => setAspect(a.id)}>{a.id} · {a.label}</Pill>)}</div>
      </ModuleScroll>

      <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--background)/0.6)] px-6 py-4 backdrop-blur-xl sm:px-9">
        <span className="font-mono text-[11px] text-muted-foreground">
          {selected
            ? `${selected.name} · ${engineToBackend(selected.engine)}${needsAvatar ? (sel.avatar ? "" : " · pick an avatar first") : ""}`
            : "Pick a crossover"}
        </span>
        <button type="button" onClick={create} disabled={!canCreate}
          className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-transform disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT, boxShadow: canCreate ? `0 12px 36px -10px ${ACCENT}` : "none" }}>
          <Sparkles className="h-4 w-4" /> Create <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */
function ModuleScroll({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    // h-full (not flex-1) — the parent canvas is `h-full`, not a flex column,
    // so flex-1 collapsed and tall modules (e.g. the 48-avatar Cast grid)
    // couldn't scroll. h-full bounds the height so overflow-y-auto works.
    <div className="h-full overflow-y-auto px-6 py-7 sm:px-9">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-[1.5rem] font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="mb-3 mt-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{children}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2"><span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">{label}</span>{children}</div>;
}
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full bg-[hsl(var(--foreground)/0.05)] px-3 py-1.5 ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="text-muted-foreground hover:text-foreground">−</button>
      <span className="w-6 text-center font-mono text-[13px] text-foreground">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="text-muted-foreground hover:text-foreground">+</button>
    </span>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">{label}</span>{children}</label>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[hsl(var(--foreground)/0.05)] px-3 py-2 text-[13px] capitalize text-foreground outline-none ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)]">
      {options.map((o) => <option key={o} value={o} className="bg-background capitalize">{o}</option>)}
    </select>
  );
}
function Toggle({ label, icon: Icon, on, onClick }: { label: string; icon: LucideIcon; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={["inline-flex items-center justify-between rounded-lg px-3 py-2 text-[13px] ring-1 ring-inset transition-colors",
        on ? "bg-[hsl(var(--accent)/0.12)] text-foreground ring-[hsl(var(--accent)/0.4)]" : "bg-[hsl(var(--foreground)/0.04)] text-muted-foreground ring-[hsl(var(--foreground)/0.08)]"].join(" ")}>
      <span className="inline-flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
      <span className={["h-3.5 w-3.5 rounded-full", on ? "" : "ring-1 ring-inset ring-current"].join(" ")} style={on ? { background: ACCENT } : undefined} />
    </button>
  );
}
function Dot() { return <span className="text-muted-foreground/30">·</span>; }
const hubFallback = <div className="grid h-full place-items-center text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Loading…</div>;

/* ── shell ───────────────────────────────────────────────────── */
export function CreationStudio({ onStartCreation, onReady, initialPrompt }: { onStartCreation: (config: Record<string, unknown>) => void; onReady?: () => void; initialPrompt?: string }) {
  const [active, setActive] = useState<ModuleId>("generate");
  const [sel, setSel] = useState<Selections>(EMPTY_SEL);
  useEffect(() => { onReady?.(); }, [onReady]);

  const groups: { key: string; items: Module[] }[] = [
    { key: "create", items: MODULES.filter((m) => m.group === "create") },
    { key: "assets", items: MODULES.filter((m) => m.group === "assets") },
    { key: "finish", items: MODULES.filter((m) => m.group === "finish") },
  ];

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[640px] overflow-hidden rounded-3xl bg-[hsl(220_28%_5%/0.52)] ring-1 ring-inset ring-[hsl(var(--foreground)/0.08)] backdrop-blur-2xl shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
      {/* left rail */}
      <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-[hsl(var(--foreground)/0.08)] py-4 sm:w-[92px]">
        {groups.map((g, gi) => (
          <div key={g.key} className="flex w-full flex-col items-center gap-1">
            {gi > 0 && <span className="my-1.5 h-px w-8 bg-[hsl(var(--foreground)/0.08)]" />}
            {g.items.map((m) => {
              const on = m.id === active;
              const dot = (m.id === "cast" && sel.avatar) || (m.id === "worlds" && sel.env) || (m.id === "voice" && sel.voiceId) || (m.id === "music" && sel.music.enable) || (m.id === "look" && sel.look);
              return (
                <button key={m.id} type="button" onClick={() => setActive(m.id)} title={m.label}
                  className={["group relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
                  {on && <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full" style={{ background: ACCENT }} />}
                  <span className={["relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors", on ? "bg-[hsl(var(--accent)/0.14)]" : "group-hover:bg-[hsl(var(--foreground)/0.05)]"].join(" ")}>
                    <m.icon className="h-[18px] w-[18px]" style={on ? { color: ACCENT } : undefined} />
                    {dot && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[#0a0c12]" style={{ background: ACCENT }} />}
                  </span>
                  <span className="text-[9.5px] font-medium leading-none">{m.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* canvas */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="h-full">
            {active === "generate" ? <GenerateModule sel={sel} setSel={setSel} onStartCreation={onStartCreation} initialPrompt={initialPrompt} />
              : active === "cast" ? <CastModule sel={sel} setSel={setSel} />
              : active === "worlds" ? <WorldsModule sel={sel} setSel={setSel} />
              : active === "voice" ? <VoiceModule sel={sel} setSel={setSel} />
              : active === "music" ? <MusicModule sel={sel} setSel={setSel} />
              : active === "look" ? <LookModule sel={sel} setSel={setSel} />
              : active === "story" ? <StoryModule sel={sel} setSel={setSel} />
              : active === "templates" ? <TemplatesModule sel={sel} onStartCreation={onStartCreation} />
              : active === "image" ? <Suspense fallback={hubFallback}><div className="h-full overflow-y-auto"><ImageStudioHub /></div></Suspense>
              : active === "photo" ? <Suspense fallback={hubFallback}><div className="h-full overflow-y-auto"><PhotoEditorHub /></div></Suspense>
              : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

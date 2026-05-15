import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, FileText, ImageIcon, GitBranch, ChevronRight, ChevronLeft,
  Wand2, Clapperboard, Users, User, Film, Check, X, ArrowRight,
  AlertCircle, RotateCcw, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_INTAKE, type IntakeData, type IntakeFormat, type DirectorMode } from "./types";

const SERIF = { fontFamily: "'Fraunces', serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const DRAFT_KEY = "director-studio:intake-draft:v1";

interface SavedDraft {
  data: IntakeData;
  step: number;
  savedAt: number;
}

function loadDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDraft;
    if (!parsed?.data || typeof parsed.step !== "number") return null;
    // Sanity-merge against defaults so older shapes still work
    return { ...parsed, data: { ...DEFAULT_INTAKE, ...parsed.data } };
  } catch {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function formatRelative(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STEPS = [
  { id: "concept", label: "Concept" },
  { id: "format", label: "Format" },
  { id: "tone", label: "Tone" },
  { id: "shape", label: "Shape" },
  { id: "cast", label: "Cast" },
  { id: "mode", label: "Mode" },
] as const;

const GENRES = [
  "Neo-Noir", "Sci-Fi", "Drama", "Thriller", "Romance", "Western",
  "Documentary", "Action", "Horror", "Comedy", "Fantasy", "Music Video",
];

const TONES = ["Cinematic", "Gritty", "Dreamy", "Tense", "Epic", "Intimate", "Surreal", "Vérité"];

const FORMAT_CARDS: { id: IntakeFormat; title: string; desc: string; Icon: typeof Sparkles }[] = [
  { id: "concept", title: "From a concept", desc: "One sentence. The brain writes the rest.", Icon: Sparkles },
  { id: "script", title: "Paste a script", desc: "Fountain or plain dialogue. Verbatim.", Icon: FileText },
  { id: "image", title: "From an image", desc: "Upload a frame. We extract its DNA.", Icon: ImageIcon },
  { id: "remix", title: "Remix a project", desc: "Fork an existing film and evolve it.", Icon: GitBranch },
];

interface Props {
  open: boolean;
  onComplete: (data: IntakeData) => void;
  onCancel?: () => void;
}

export function DirectorIntake({ open, onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>(DEFAULT_INTAKE);
  const [pendingDraft, setPendingDraft] = useState<SavedDraft | null>(null);
  const [showError, setShowError] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);

  // On open, surface any saved draft for resume
  useEffect(() => {
    if (!open) return;
    const d = loadDraft();
    if (d) setPendingDraft(d);
  }, [open]);

  // Auto-save (debounced) once user starts editing
  useEffect(() => {
    if (!open || pendingDraft) return; // don't overwrite while resume banner is showing
    if (!dirtyRef.current) return;
    const t = window.setTimeout(() => {
      const payload: SavedDraft = { data, step, savedAt: Date.now() };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch { /* ignore quota errors */ }
    }, 500);
    return () => window.clearTimeout(t);
  }, [data, step, open, pendingDraft]);

  const update = <K extends keyof IntakeData>(k: K, v: IntakeData[K]) =>
    setData((d) => {
      dirtyRef.current = true;
      setShowError(false);
      return { ...d, [k]: v };
    });

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return data.title.trim().length >= 2 && data.logline.trim().length >= 4;
      case 1: return data.format === "concept" || data.scriptOrIdea.trim().length > 0;
      case 2: return data.genres.length > 0 && data.tone.length > 0;
      case 3: return !!data.aspect && data.sceneCount >= 2;
      case 4: return data.characterA.trim().length > 0 && (data.castSize === 1 || data.characterB.trim().length > 0);
      case 5: return !!data.mode;
      default: return false;
    }
  }, [step, data]);

  const next = () => {
    if (!canAdvance) {
      setShowError(true);
      return;
    }
    setShowError(false);
    if (step === STEPS.length - 1) {
      clearDraft();
      onComplete(data);
    } else {
      setStep((s) => s + 1);
    }
  };
  const prev = () => { setShowError(false); setStep((s) => Math.max(0, s - 1)); };

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setData(pendingDraft.data);
    setStep(Math.min(pendingDraft.step, STEPS.length - 1));
    setSavedAt(pendingDraft.savedAt);
    dirtyRef.current = true;
    setPendingDraft(null);
  };
  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
    setSavedAt(null);
  };

  const errorFor = (s: number): string | null => {
    switch (s) {
      case 0:
        if (data.title.trim().length < 2) return "Add a working title (min 2 characters).";
        if (data.logline.trim().length < 4) return "Add a logline (min 4 characters).";
        return null;
      case 1:
        if (data.format !== "concept" && data.scriptOrIdea.trim().length === 0) return "Paste your script, reference, or remix source.";
        return null;
      case 2:
        if (data.genres.length === 0) return "Pick at least one genre.";
        if (!data.tone) return "Pick a tonal register.";
        return null;
      case 3:
        if (!data.aspect) return "Pick an aspect ratio.";
        if (data.sceneCount < 2) return "Scene count must be at least 2.";
        return null;
      case 4:
        if (data.characterA.trim().length === 0) return "Name your lead character.";
        if (data.castSize === 2 && data.characterB.trim().length === 0) return "Name the second character.";
        return null;
      case 5:
        if (!data.mode) return "Choose Auto or Director.";
        return null;
      default: return null;
    }
  };
  const currentError = showError ? errorFor(step) : null;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative w-full min-h-screen overflow-hidden"
      >
        {/* Top hairline */}
        <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Top chrome */}
        <div className="relative z-10 flex items-center justify-between px-8 py-5">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              border: "1px solid hsla(0,0%,100%,0.10)",
              background: "hsla(0,0%,100%,0.03)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Sparkles className="h-3 w-3 text-[#9DCBFF]" />
            <span className="text-[10px] tracking-[0.32em] uppercase text-white/65 font-medium" style={MONO}>
              Director Studio · Intake
            </span>
          </div>
          <div className="flex items-center gap-4">
            {savedAt && !pendingDraft && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/35 tracking-widest" style={MONO}>
                <Save className="h-3 w-3" /> DRAFT SAVED · {formatRelative(savedAt).toUpperCase()}
              </span>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-white/40 hover:text-white/80 transition-colors"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Resume draft banner */}
        {pendingDraft && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mx-8 mb-2 border border-[#0A84FF]/40 bg-[#0A84FF]/[0.06] backdrop-blur-sm"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0A84FF] shadow-[0_0_10px_2px_rgba(10,132,255,0.7)]" />
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <RotateCcw className="h-4 w-4 text-[#0A84FF] shrink-0" />
                <div className="min-w-0">
                  <div className="text-white text-sm" style={SERIF}>
                    Resume your draft
                    {pendingDraft.data.title && (
                      <span className="text-white/55 italic"> — “{pendingDraft.data.title}”</span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/45 tracking-widest" style={MONO}>
                    SAVED {formatRelative(pendingDraft.savedAt).toUpperCase()} · STEP {String(pendingDraft.step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={discardDraft}
                  className="h-9 px-4 text-[10px] tracking-[0.28em] text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-all"
                  style={MONO}
                >
                  START OVER
                </button>
                <button
                  onClick={resumeDraft}
                  className="h-9 px-4 text-[10px] tracking-[0.28em] bg-[#0A84FF] text-white hover:shadow-[0_0_18px_rgba(10,132,255,0.55)] transition-all"
                  style={MONO}
                >
                  RESUME
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stepper */}
        <div className="relative z-10 px-8">
          <div className="flex items-center gap-2 max-w-3xl">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-all",
                        done && "bg-[#0A84FF]",
                        active && "bg-[#0A84FF] shadow-[0_0_10px_2px_rgba(10,132,255,0.7)]",
                        !active && !done && "bg-white/20"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] tracking-[0.28em] transition-colors",
                        active ? "text-white/90" : done ? "text-white/50" : "text-white/30"
                      )}
                      style={MONO}
                    >
                      {String(i + 1).padStart(2, "0")} {s.label.toUpperCase()}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-white/10" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="relative z-10 flex items-start justify-center px-8 pt-12 pb-32">
          <div className="w-full max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Step header */}
                <div className="mb-10">
                  <div className="text-[10px] tracking-[0.32em] text-[#0A84FF] mb-3" style={MONO}>
                    STEP {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                  </div>
                  {step === 0 && <StepHeader title="What are we making?" sub="Give it a working title and a single sentence the camera can chase." />}
                  {step === 1 && <StepHeader title="Where does it begin?" sub="Choose how the brain receives your idea." />}
                  {step === 2 && <StepHeader title="What does it feel like?" sub="Pick the genres and tonal register. Used by score, color, and pacing." />}
                  {step === 3 && <StepHeader title="Shape & length." sub="Frame proportions and how many scenes the brain should plan." />}
                  {step === 4 && <StepHeader title="Who is on screen?" sub="One or two locked characters. Names matter — they appear in dialogue." />}
                  {step === 5 && <StepHeader title="How do you want to direct?" sub="Sit back and let it render — or grab the wheel on every shot." />}
                </div>

                {/* Step content */}
                {step === 0 && (
                  <div className="space-y-6">
                    <Field label="Working title" mono>
                      <Input
                        value={data.title}
                        onChange={(e) => update("title", e.target.value)}
                        placeholder="Untitled Film 03"
                        className="bg-white/[0.03] border-white/10 text-white text-2xl h-14 rounded-none focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                        style={SERIF}
                        maxLength={80}
                      />
                    </Field>
                    <Field label="Logline" mono>
                      <Textarea
                        value={data.logline}
                        onChange={(e) => update("logline", e.target.value)}
                        placeholder="A noir detective interrogates a suspect in a rainy Tokyo alley as memory bleeds into evidence."
                        className="bg-white/[0.03] border-white/10 text-white text-base rounded-none min-h-[120px] focus-visible:ring-1 focus-visible:ring-[#0A84FF] leading-relaxed"
                        style={SERIF}
                        maxLength={400}
                      />
                      <Counter n={data.logline.length} max={400} />
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {FORMAT_CARDS.map(({ id, title, desc, Icon }) => {
                        const active = data.format === id;
                        return (
                          <button
                            key={id}
                            onClick={() => update("format", id)}
                            className={cn(
                              "relative text-left p-5 border transition-all group",
                              active
                                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                                : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
                            )}
                          >
                            {active && (
                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0A84FF] shadow-[0_0_12px_2px_rgba(10,132,255,0.7)]" />
                            )}
                            <Icon className={cn("h-5 w-5 mb-4", active ? "text-[#0A84FF]" : "text-white/60")} />
                            <div className="text-white text-lg mb-1" style={SERIF}>{title}</div>
                            <div className="text-white/50 text-sm leading-relaxed">{desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {data.format !== "concept" && (
                      <Field
                        label={
                          data.format === "script" ? "Paste your script"
                          : data.format === "image" ? "Reference URL or notes"
                          : "Source project ID or URL"
                        }
                        mono
                      >
                        <Textarea
                          value={data.scriptOrIdea}
                          onChange={(e) => update("scriptOrIdea", e.target.value)}
                          placeholder={
                            data.format === "script"
                              ? "INT. TOKYO POLICE STATION — INTERROGATION — NIGHT\n\nSATO\n  You said it was rain.\n  The witness said it was blood."
                              : data.format === "image"
                              ? "Paste a reference image URL, or describe what you want extracted."
                              : "Paste the project URL you want to remix."
                          }
                          className="bg-white/[0.03] border-white/10 text-white rounded-none min-h-[200px] focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                          style={data.format === "script" ? MONO : SERIF}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8">
                    <div>
                      <Label>Genre · pick up to 3</Label>
                      <div className="flex flex-wrap gap-2">
                        {GENRES.map((g) => {
                          const active = data.genres.includes(g);
                          return (
                            <button
                              key={g}
                              onClick={() => {
                                const next = active
                                  ? data.genres.filter((x) => x !== g)
                                  : data.genres.length < 3 ? [...data.genres, g] : data.genres;
                                update("genres", next);
                              }}
                              className={cn(
                                "px-4 py-2 text-sm border rounded-full transition-all",
                                active
                                  ? "border-[#0A84FF] bg-[#0A84FF]/15 text-white"
                                  : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                              )}
                              style={SERIF}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <Label>Tonal register</Label>
                      <div className="flex flex-wrap gap-2">
                        {TONES.map((t) => {
                          const active = data.tone === t;
                          return (
                            <button
                              key={t}
                              onClick={() => update("tone", t)}
                              className={cn(
                                "px-4 py-2 text-sm border rounded-full transition-all",
                                active
                                  ? "border-[#0A84FF] bg-[#0A84FF]/15 text-white"
                                  : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                              )}
                              style={SERIF}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-10">
                    <div>
                      <Label>Aspect ratio</Label>
                      <div className="grid grid-cols-4 gap-3">
                        {(["2.39:1", "16:9", "9:16", "1:1"] as const).map((r) => {
                          const active = data.aspect === r;
                          const ratioMap = { "2.39:1": "aspect-[2.39/1]", "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square" } as const;
                          return (
                            <button
                              key={r}
                              onClick={() => update("aspect", r)}
                              className={cn(
                                "p-4 border transition-all flex flex-col items-center gap-3",
                                active ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                              )}
                            >
                              <div className={cn("w-full bg-white/[0.04] border border-white/10", ratioMap[r], r === "9:16" && "max-h-20 mx-auto w-12")} />
                              <span className={cn("text-xs", active ? "text-white" : "text-white/60")} style={MONO}>{r}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-4">
                        <Label className="!mb-0">Scene count</Label>
                        <span className="text-3xl text-white" style={SERIF}>{data.sceneCount}</span>
                      </div>
                      <Slider
                        value={[data.sceneCount]}
                        onValueChange={([v]) => update("sceneCount", v)}
                        min={2}
                        max={12}
                        step={1}
                      />
                      <div className="flex justify-between text-[10px] text-white/40 mt-2 tracking-widest" style={MONO}>
                        <span>2 · TEASER</span>
                        <span>6 · SHORT</span>
                        <span>12 · EPISODE</span>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-3">
                      {([1, 2] as const).map((n) => {
                        const active = data.castSize === n;
                        const Icon = n === 1 ? User : Users;
                        return (
                          <button
                            key={n}
                            onClick={() => update("castSize", n)}
                            className={cn(
                              "p-5 border text-left transition-all",
                              active ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                            )}
                          >
                            <Icon className={cn("h-5 w-5 mb-3", active ? "text-[#0A84FF]" : "text-white/60")} />
                            <div className="text-white text-lg" style={SERIF}>
                              {n === 1 ? "Solo lead" : "Two characters"}
                            </div>
                            <div className="text-white/50 text-sm mt-1">
                              {n === 1 ? "One face. Identity-locked across every scene." : "Dual locks with cinematic switching between them."}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Character A" mono>
                        <Input
                          value={data.characterA}
                          onChange={(e) => update("characterA", e.target.value)}
                          placeholder="Detective Sato"
                          className="bg-white/[0.03] border-white/10 text-white h-12 rounded-none focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                          style={SERIF}
                          maxLength={40}
                        />
                      </Field>
                      {data.castSize === 2 && (
                        <Field label="Character B" mono>
                          <Input
                            value={data.characterB}
                            onChange={(e) => update("characterB", e.target.value)}
                            placeholder="The Suspect"
                            className="bg-white/[0.03] border-white/10 text-white h-12 rounded-none focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                            style={SERIF}
                            maxLength={40}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="grid grid-cols-2 gap-4">
                    <ModeCard
                      active={data.mode === "auto"}
                      onClick={() => update("mode", "auto")}
                      Icon={Wand2}
                      title="Auto"
                      tagline="One click. The brain ships the film."
                      bullets={[
                        "Script · cast · cinematography all auto",
                        "Render dashboard with live progress",
                        "Hand-off to editor when complete",
                      ]}
                    />
                    <ModeCard
                      active={data.mode === "director"}
                      onClick={() => update("mode", "director")}
                      Icon={Film}
                      title="Director"
                      tagline="Grab the wheel on every shot."
                      bullets={[
                        "Per-scene inspector and continuity pinning",
                        "Swap avatars, lenses, motion, references",
                        "Same engine — under your hand",
                      ]}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer / nav */}
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-black/60 backdrop-blur-xl">
          {currentError && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-8 py-2.5 border-b border-white/[0.04] bg-[#0A84FF]/[0.04] flex items-center gap-2"
            >
              <AlertCircle className="h-3.5 w-3.5 text-[#0A84FF]" />
              <span className="text-[12px] text-white/80" style={SERIF}>{currentError}</span>
            </motion.div>
          )}
          <div className="px-8 py-5 flex items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 0}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                step === 0 ? "text-white/20 cursor-not-allowed" : "text-white/60 hover:text-white"
              )}
              style={MONO}
            >
              <ChevronLeft className="h-4 w-4" /> BACK
            </button>

            <div className="flex items-center gap-3 text-[10px] text-white/40 tracking-[0.3em]" style={MONO}>
              {savedAt && !pendingDraft && (
                <span className="hidden md:inline-flex items-center gap-1.5 text-white/30">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" /> SAVED
                </span>
              )}
              <span>{STEPS[step].label.toUpperCase()}</span>
            </div>

            <Button
              onClick={next}
              className={cn(
                "rounded-none h-11 px-6 gap-2 text-[11px] tracking-[0.28em] transition-all",
                canAdvance
                  ? "bg-[#0A84FF] hover:bg-[#0A84FF] hover:shadow-[0_0_24px_rgba(10,132,255,0.55)] text-white"
                  : "bg-white/10 text-white/40 hover:bg-white/15"
              )}
              style={MONO}
            >
              {step === STEPS.length - 1 ? (
                <>ENTER THE STUDIO <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>CONTINUE <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1
        className="text-5xl md:text-6xl lg:text-[68px] font-semibold leading-[1.02] tracking-tight"
        style={{
          fontFamily: "'Fraunces', serif",
          background: "linear-gradient(180deg, #ffffff 0%, #ECF4FF 45%, #9DCBFF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {title}
      </h1>
      <p className="text-white/60 text-base md:text-lg mt-4 max-w-xl leading-relaxed font-light" style={SERIF}>
        {sub}
      </p>
    </>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10px] tracking-[0.32em] text-white/45 mb-4", className)} style={MONO}>
      {typeof children === "string" ? children.toUpperCase() : children}
    </div>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-[0.32em] text-white/45 mb-3"
        style={mono ? MONO : undefined}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <div className="flex justify-end mt-2">
      <span className="text-[10px] text-white/35 tracking-widest" style={MONO}>
        {n} / {max}
      </span>
    </div>
  );
}

function ModeCard({
  active, onClick, Icon, title, tagline, bullets,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Wand2;
  title: string;
  tagline: string;
  bullets: string[];
}) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group relative text-left p-7 md:p-8 rounded-2xl overflow-hidden transition-all"
      style={{
        background: active
          ? "linear-gradient(180deg, hsla(212,100%,55%,0.10) 0%, hsla(212,100%,40%,0.02) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        border: active ? "1px solid hsla(212,100%,60%,0.45)" : "1px solid hsla(0,0%,100%,0.08)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: active
          ? "inset 0 1px 0 hsla(0,0%,100%,0.10), 0 16px 40px -20px hsla(212,100%,55%,0.55)"
          : "inset 0 1px 0 hsla(0,0%,100%,0.06)",
      }}
    >
      {/* Hover radial accent */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 0%, hsla(212,100%,60%,0.30), transparent 60%)" }}
      />
      {/* Top hairline */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {active && (
        <span
          className="absolute top-5 right-5 text-[9px] tracking-[0.28em] uppercase font-semibold px-2 py-0.5 rounded-full text-white"
          style={{
            background: "linear-gradient(90deg, #0A84FF, #5AC8FA)",
            boxShadow: "0 0 18px hsla(212,100%,55%,0.5)",
          }}
        >
          Selected
        </span>
      )}

      <div
        className="relative w-12 h-12 rounded-xl inline-flex items-center justify-center mb-5"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
          border: "1px solid hsla(0,0%,100%,0.10)",
          color: active ? "#9DCBFF" : "rgba(255,255,255,0.7)",
        }}
      >
        <Icon className="h-5 w-5" />
      </div>

      <h3
        className="relative font-semibold text-3xl tracking-tight mb-2"
        style={{
          fontFamily: "'Fraunces', serif",
          background: "linear-gradient(180deg, #fff, #9DCBFF)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {title}
      </h3>
      <p className="relative text-white/55 text-sm font-light leading-relaxed mb-5" style={SERIF}>{tagline}</p>
      <ul className="relative space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-white/70 text-[13px]">
            <Check className={cn("h-3.5 w-3.5 mt-[3px] shrink-0", active ? "text-[#9DCBFF]" : "text-white/40")} />
            <span style={SERIF}>{b}</span>
          </li>
        ))}
      </ul>
    </motion.button>
  );
}
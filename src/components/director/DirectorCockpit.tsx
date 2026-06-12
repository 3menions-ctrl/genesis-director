import { useMemo, useState } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Maximize2, Settings2,
  Sparkles, Lock, Pin, RefreshCw,
  CheckCircle2, Circle, AlertTriangle, Loader2, Film, Mic2,
  Music2, Camera, Aperture, ChevronDown, Plus, Edit3,
  Coins, Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IntakeData, DirectorMode } from "./types";

const SERIF = { fontFamily: "'Fraunces', serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

type SceneStatus = "rendered" | "generating" | "queued" | "warning";
interface Scene {
  n: number;
  title: string;
  duration: string;
  dialogue: string;
  status: SceneStatus;
  progress?: number;
}

interface Props {
  intake: IntakeData;
  onReopenIntake: () => void;
}

export function DirectorCockpit({ intake, onReopenIntake }: Props) {
  const [mode, setMode] = useState<DirectorMode>(intake.mode);
  const [activeScene, setActiveScene] = useState(3);
  const [playing, setPlaying] = useState(false);

  const scenes: Scene[] = useMemo(() => {
    const base: Scene[] = [
      { n: 1, title: "Opening Alley", duration: "7.2s", dialogue: "Rain. Neon. A city that never forgets.", status: "rendered" },
      { n: 2, title: "Arrival", duration: "5.6s", dialogue: "Another night. Another anonymous call.", status: "rendered" },
      { n: 3, title: "Station Hall", duration: "4.8s", dialogue: "The fluorescent hum never stops.", status: "rendered" },
      { n: 4, title: "Interrogation", duration: "6.0s", dialogue: "You said it was rain. The witness said…", status: "generating", progress: 62 },
      { n: 5, title: "Flashback", duration: "6.4s", dialogue: "That night, the streets were already red.", status: "queued" },
      { n: 6, title: "Aftermath", duration: "5.0s", dialogue: "Truth doesn't set you free. It buries you.", status: "warning" },
    ];
    return base.slice(0, Math.max(2, Math.min(intake.sceneCount, base.length)));
  }, [intake.sceneCount]);

  const renderedCount = scenes.filter((s) => s.status === "rendered").length;

  return (
    <div className="min-h-[calc(100vh-0px)] bg-[hsl(220,14%,2%)] text-white overflow-hidden">
      {/* Command Bar */}
      <CommandBar
        intake={intake}
        mode={mode}
        onMode={setMode}
        renderedCount={renderedCount}
        totalScenes={scenes.length}
        onReopenIntake={onReopenIntake}
      />

      {/* 3-zone main */}
      <div className="grid grid-cols-[320px_minmax(0,1fr)_360px] gap-px bg-glass-hover">
        <Notebook intake={intake} />
        <Stage
          intake={intake}
          scene={scenes[activeScene] ?? scenes[0]}
          activeIndex={activeScene}
          totalScenes={scenes.length}
          playing={playing}
          onPlayToggle={() => setPlaying((p) => !p)}
          onNav={(i) => setActiveScene(Math.max(0, Math.min(scenes.length - 1, i)))}
        />
        <Inspector scene={scenes[activeScene] ?? scenes[0]} mode={mode} />
      </div>

      {/* Scene Strip */}
      <SceneStrip
        scenes={scenes}
        activeIndex={activeScene}
        onSelect={setActiveScene}
      />

      {/* Audio Rail */}
      <AudioRail />
    </div>
  );
}

/* ---------------- Command Bar ---------------- */
function CommandBar({
  intake, mode, onMode, renderedCount, totalScenes, onReopenIntake,
}: {
  intake: IntakeData;
  mode: DirectorMode;
  onMode: (m: DirectorMode) => void;
  renderedCount: number;
  totalScenes: number;
  onReopenIntake: () => void;
}) {
  return (
    <div className="h-14 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 relative">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/30 to-transparent" />
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2 text-white/40 text-[10px] tracking-[0.3em]" style={MONO}>
          DIRECTOR <span className="text-white/20">/</span> PROJECT
        </div>
        <button
          onClick={onReopenIntake}
          className="text-white/95 text-lg italic hover:text-primary transition-colors flex items-center gap-2 group"
          style={SERIF}
          title="Edit intake"
        >
          {intake.title || "Untitled Film"}
          <Edit3 className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-glass-hover border border-white/10 p-1">
        {(["auto", "director"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={cn(
              "px-5 h-8 text-[11px] tracking-[0.28em] transition-all",
              mode === m
                ? "bg-primary text-white shadow-[0_0_18px_rgba(10,132,255,0.5)]"
                : "text-white/55 hover:text-white"
            )}
            style={MONO}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-[11px]" style={MONO}>
          <Coins className="h-3.5 w-3.5 text-primary" />
          <span className="text-white/85">847 credits</span>
          <span className="text-white/35">·</span>
          <span className="text-white/55">$4.20 est.</span>
        </div>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-32 bg-glass-active overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_10px_rgba(10,132,255,0.7)]"
              style={{ width: `${(renderedCount / totalScenes) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-white/50 tracking-widest" style={MONO}>
            {renderedCount} / {totalScenes} RENDERED
          </span>
        </div>
        <Button
          className="h-8 rounded-none bg-primary hover:bg-primary hover:shadow-[0_0_24px_rgba(10,132,255,0.55)] text-[10px] tracking-[0.28em] gap-2"
          style={MONO}
        >
          <Sparkles className="h-3.5 w-3.5" /> RENDER FILM
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Director's Notebook ---------------- */
function Notebook({ intake }: { intake: IntakeData }) {
  return (
    <div className="bg-[hsl(220,14%,3%)] border-r border-white/[0.04] overflow-y-auto max-h-[calc(100vh-56px-140px-96px)]">
      <Section title="Director's Notebook" mono>
        <div className="text-[10px] text-white/35 tracking-widest mb-4" style={MONO}>
          AUTO-RESOLVED · 7.4s
        </div>
      </Section>

      <Panel title="Script" badge={`${intake.sceneCount} scenes`}>
        <pre className="text-[11px] text-white/65 leading-relaxed whitespace-pre-wrap font-normal" style={MONO}>
{`INT. ${intake.characterA?.toUpperCase() || "STATION"} HALL — NIGHT

Rain taps the glass. Neon bleeds in.

${intake.characterA?.toUpperCase() || "DETECTIVE"}
  You said it was rain.
  The witness said it was blood.

The suspect smirks.`}
        </pre>
      </Panel>

      <Panel title="Casting" badge={`${intake.castSize} locked`}>
        <CastChip name={intake.characterA || "Detective Sato"} role="Lead" status="locked" />
        {intake.castSize === 2 && <CastChip name={intake.characterB || "The Suspect"} role="Antagonist" status="locked" />}
      </Panel>

      <Panel title="Cinematography">
        <KV k="Lens" v="35mm anamorphic" />
        <KV k="Camera move" v="slow dolly-in" />
        <KV k="Frame" v={intake.aspect} />
        <KV k="Color" v="cyan / amber bloom" />
      </Panel>

      <Panel title="Continuity Manifest" badge="locked">
        <div className="grid grid-cols-3 gap-2 mt-2">
          {["wardrobe", "lighting", "location"].map((label, i) => (
            <div key={label} className="aspect-square border border-white/10 bg-glass-hover relative overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: i === 0
                    ? "linear-gradient(135deg, hsl(220 10% 12%), hsl(220 10% 6%))"
                    : i === 1
                    ? "radial-gradient(circle at 50% 40%, hsl(40 80% 55% / 0.7), hsl(220 14% 4%) 70%)"
                    : "linear-gradient(180deg, hsl(215 50% 12%), hsl(220 14% 3%))",
                }}
              />
              <div className="absolute bottom-1 left-1 text-[8px] tracking-widest text-white/60" style={MONO}>
                {label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Score" badge="MusicGen">
        <KV k="Genre" v={`${intake.tone.toLowerCase()} tension`} />
        <KV k="Length" v={`01:${(intake.sceneCount * 6).toString().padStart(2, "0")}`} />
        <div className="mt-3 h-8 flex items-end gap-[2px]">
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/40"
              style={{ height: `${20 + Math.abs(Math.sin(i * 0.42)) * 80}%` }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Stage / Viewer ---------------- */
function Stage({
  intake, scene, activeIndex, totalScenes, playing, onPlayToggle, onNav,
}: {
  intake: IntakeData;
  scene: { n: number; title: string };
  activeIndex: number;
  totalScenes: number;
  playing: boolean;
  onPlayToggle: () => void;
  onNav: (i: number) => void;
}) {
  return (
    <div className="bg-[hsl(220,14%,2.5%)] flex flex-col">
      {/* Stage header */}
      <div className="h-11 px-5 flex items-center justify-between border-b border-white/[0.04]">
        <span className="text-[10px] tracking-[0.3em] text-white/45" style={MONO}>STAGE / VIEWER</span>
        <div className="flex items-center gap-3 text-white/35">
          <button className="hover:text-white transition-colors"><Settings2 className="h-3.5 w-3.5" /></button>
          <button className="hover:text-white transition-colors"><Aperture className="h-3.5 w-3.5" /></button>
          <button className="hover:text-white transition-colors"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[420px]">
        <div className="relative w-full max-w-[920px] aspect-[2.39/1] overflow-hidden border border-white/[0.06]">
          {/* Cinematic image */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 60%, hsl(215 70% 20% / 0.9) 0%, hsl(220 14% 3%) 70%), linear-gradient(180deg, hsl(220 14% 4%), hsl(220 14% 2%))",
            }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 30% 35%, hsl(0 90% 55% / 0.45), transparent 35%), radial-gradient(circle at 70% 30%, hsl(180 85% 55% / 0.3), transparent 40%)",
            }}
          />
          {/* Subject silhouette */}
          <div className="absolute inset-x-0 bottom-0 h-3/4 flex items-end justify-center">
            <div
              className="h-full w-[30%]"
              style={{
                background: "linear-gradient(180deg, transparent 10%, hsl(220 14% 1.5%) 85%)",
                clipPath: "polygon(35% 8%, 65% 8%, 70% 100%, 30% 100%)",
              }}
            />
          </div>
          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, transparent 50%, hsl(220 14% 0%) 100%)" }}
          />
          {/* Letterbox */}
          <div className="absolute inset-x-0 top-0 h-[6%] bg-black" />
          <div className="absolute inset-x-0 bottom-0 h-[6%] bg-black" />
          {/* Overlays */}
          <div className="absolute top-3 left-3 text-[10px] text-white/85 tracking-widest" style={MONO}>
            00:14:22:08
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-white/85 tracking-widest" style={MONO}>
            SCENE {String(scene.n).padStart(2, "0")} / TAKE 02
          </div>
          <div className="absolute top-3 right-3 text-[10px] text-white/85 tracking-widest" style={MONO}>
            {intake.aspect}
          </div>
          {/* Reticle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 border border-white/40" />
          {/* Bottom HUD */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] text-white/70" style={MONO}>
            <span>35mm</span><span className="text-white/25">|</span>
            <span>T2.0</span><span className="text-white/25">|</span>
            <span>180°</span><span className="text-white/25">|</span>
            <span>ISO 800</span><span className="text-white/25">|</span>
            <span>3200K</span>
          </div>
        </div>

        {/* Chapter markers */}
        <div className="w-full max-w-[920px] mt-6">
          <div className="relative h-1 bg-glass-active">
            <div
              className="absolute inset-y-0 left-0 bg-primary/40"
              style={{ width: `${((activeIndex + 0.5) / totalScenes) * 100}%` }}
            />
            {Array.from({ length: totalScenes }).map((_, i) => (
              <button
                key={i}
                onClick={() => onNav(i)}
                className="absolute -top-1 h-3 w-3 -translate-x-1/2 group"
                style={{ left: `${((i + 0.5) / totalScenes) * 100}%` }}
              >
                <div
                  className={cn(
                    "h-3 w-3 rotate-45 border transition-all",
                    i === activeIndex
                      ? "bg-primary border-primary shadow-[0_0_10px_2px_rgba(10,132,255,0.7)]"
                      : "bg-[hsl(220,14%,2%)] border-white/30 group-hover:border-white"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-white/35 tracking-widest" style={MONO}>
            <span>00:00:00</span>
            <span>00:14:22</span>
            <span>00:{String(totalScenes * 6).padStart(2, "0")}:00</span>
          </div>
        </div>

        {/* Transport */}
        <div className="mt-5 flex items-center gap-5 text-white/65">
          <button onClick={() => onNav(activeIndex - 1)} className="hover:text-white transition-colors">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={onPlayToggle}
            className="h-11 w-11 rounded-full border border-white/20 hover:border-primary hover:text-white flex items-center justify-center transition-all hover:shadow-[0_0_20px_rgba(10,132,255,0.5)]"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button onClick={() => onNav(activeIndex + 1)} className="hover:text-white transition-colors">
            <SkipForward className="h-4 w-4" />
          </button>
          <div className="ml-3 flex items-center gap-2 text-[10px] tracking-widest text-white/40" style={MONO}>
            <kbd className="px-1.5 py-0.5 border border-white/15">J</kbd>
            <kbd className="px-1.5 py-0.5 border border-white/15">K</kbd>
            <kbd className="px-1.5 py-0.5 border border-white/15">L</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inspector ---------------- */
function Inspector({ scene, mode }: { scene: { n: number; title: string; duration: string; dialogue: string }; mode: DirectorMode }) {
  const [duration, setDuration] = useState(6);
  const [intensity, setIntensity] = useState(35);
  const [pin, setPin] = useState(true);

  return (
    <div className="bg-[hsl(220,14%,3%)] border-l border-white/[0.04] overflow-y-auto max-h-[calc(100vh-56px-140px-96px)]">
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.04]">
        <div className="text-[10px] tracking-[0.3em] text-white/35 mb-1" style={MONO}>SHOT INSPECTOR</div>
        <div className="text-white text-xl" style={SERIF}>
          Scene {String(scene.n).padStart(2, "0")} — <span className="italic">{scene.title}</span>
        </div>
        {mode === "auto" && (
          <div className="mt-3 text-[10px] text-white/45 tracking-widest" style={MONO}>
            <Lock className="h-3 w-3 inline mr-1" /> AUTO MODE · TOGGLE TO DIRECTOR TO EDIT
          </div>
        )}
      </div>

      <Panel title="Prompt">
        <div className="border border-white/10 bg-glass p-3 text-[12px] text-white/75 leading-relaxed" style={SERIF}>
          Noir interrogation in a Tokyo police station. Rainy night, neon reflections, detective leans in. Tense, moody, cinematic.
        </div>
      </Panel>

      <Panel title="Dialogue (verbatim)" icon={<Lock className="h-3 w-3 text-primary" />}>
        <Textarea
          defaultValue={`SATO\n  You said it was rain.\n  The witness said it was blood.`}
          className="bg-glass border-white/10 text-white/85 rounded-none text-[12px] min-h-[100px] focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
          style={MONO}
        />
      </Panel>

      <Panel title="Cinematography">
        <DropdownRow label="Lens" value="35mm anamorphic" Icon={Camera} />
        <DropdownRow label="Camera move" value="slow dolly-in" Icon={Film} />
        <DropdownRow label="Aspect" value="2.39:1" Icon={Aperture} />
      </Panel>

      <Panel title="Motion & Time">
        <SliderRow label="Duration" value={duration} onChange={setDuration} min={2} max={10} step={0.5} unit="s" />
        <SliderRow label="Motion intensity" value={intensity} onChange={setIntensity} min={0} max={100} step={5} unit="%" />
      </Panel>

      <Panel title="Reference image">
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square border border-white/10 bg-gradient-to-br from-[hsl(215,50%,15%)] to-[hsl(220,14%,3%)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle at 30% 40%, hsl(0 80% 50% / 0.6), transparent 50%)" }} />
            <div className="absolute bottom-1 left-1 text-[8px] text-white/70 tracking-widest" style={MONO}>LOCKED</div>
          </div>
          <button className="aspect-square border border-dashed border-white/15 bg-white/[0.01] hover:border-primary hover:bg-primary/[0.05] transition-all flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-white">
            <Plus className="h-4 w-4" />
            <span className="text-[10px] tracking-widest" style={MONO}>UPLOAD</span>
          </button>
        </div>
      </Panel>

      <Panel title="Continuity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/75">
            <Pin className="h-3.5 w-3.5 text-primary" />
            <span style={SERIF}>Pin as continuity anchor</span>
          </div>
          <Switch checked={pin} onCheckedChange={setPin} />
        </div>
      </Panel>

      <div className="px-5 pb-6 pt-2 sticky bottom-0 bg-gradient-to-t from-[hsl(220,14%,3%)] via-[hsl(220,14%,3%)] to-transparent">
        <Button className="w-full rounded-none h-12 bg-primary hover:bg-primary hover:shadow-[0_0_28px_rgba(10,132,255,0.6)] text-[11px] tracking-[0.32em] gap-2" style={MONO}>
          <RefreshCw className="h-3.5 w-3.5" /> REGENERATE · 12 CREDITS
        </Button>
        <div className="text-center text-[10px] text-white/35 mt-2 tracking-widest" style={MONO}>
          $1.20 · ~38s
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scene Strip ---------------- */
function SceneStrip({
  scenes, activeIndex, onSelect,
}: {
  scenes: Scene[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="border-t border-white/[0.06] bg-[hsl(220,14%,2.5%)]">
      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.3em] text-white/45" style={MONO}>SCENE STRIP</span>
        <div className="flex items-center gap-4 text-[10px] tracking-widest text-white/45" style={MONO}>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> RENDERED</span>
          <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 text-primary animate-spin" /> GENERATING</span>
          <span className="flex items-center gap-1.5"><Circle className="h-3 w-3 text-white/30" /> QUEUED</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-400" /> FALLBACK</span>
        </div>
      </div>
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto">
        {scenes.map((s, i) => (
          <SceneCard key={s.n} scene={s} active={i === activeIndex} onClick={() => onSelect(i)} />
        ))}
      </div>
    </div>
  );
}

function SceneCard({ scene, active, onClick }: { scene: Scene; active: boolean; onClick: () => void }) {
  const StatusIcon =
    scene.status === "rendered" ? CheckCircle2
    : scene.status === "generating" ? Loader2
    : scene.status === "warning" ? AlertTriangle
    : Circle;
  const statusColor =
    scene.status === "rendered" ? "text-emerald-400"
    : scene.status === "generating" ? "text-primary"
    : scene.status === "warning" ? "text-amber-400"
    : "text-white/30";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative shrink-0 w-[200px] border bg-[hsl(220,14%,3%)] text-left transition-all",
        active
          ? "border-primary shadow-[0_0_24px_rgba(10,132,255,0.35)]"
          : "border-white/10 hover:border-white/25"
      )}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("h-3 w-3", statusColor, scene.status === "generating" && "animate-spin")} />
          <span className="text-[10px] tracking-widest text-white/85" style={MONO}>{scene.title.toUpperCase()}</span>
        </div>
        <span className="text-[10px] text-white/45" style={MONO}>{scene.duration}</span>
      </div>
      {/* Thumbnail */}
      <div className="relative aspect-video mx-3 overflow-hidden border border-white/[0.06]">
        <div
          className="absolute inset-0"
          style={{
            background: scene.n % 2 === 0
              ? "radial-gradient(circle at 40% 60%, hsl(215 60% 20%), hsl(220 14% 3%) 70%)"
              : "radial-gradient(circle at 60% 50%, hsl(0 50% 18%), hsl(220 14% 3%) 70%)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, hsl(220 14% 0%) 100%)" }} />
        {scene.status === "generating" && scene.progress !== undefined && (
          <div className="absolute top-2 right-2 h-7 w-7 rounded-full border border-primary flex items-center justify-center text-[9px] text-white" style={MONO}>
            {scene.progress}
          </div>
        )}
      </div>
      {/* Dialogue */}
      <div className="px-3 py-2.5">
        <div className="text-[11px] text-white/55 leading-snug line-clamp-2 italic" style={SERIF}>
          "{scene.dialogue}"
        </div>
      </div>
    </button>
  );
}

/* ---------------- Audio Rail ---------------- */
function AudioRail() {
  return (
    <div className="border-t border-white/[0.06] bg-[hsl(220,14%,2%)] px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-white/45" style={MONO}>
          <Volume2 className="h-3 w-3" /> AUDIO RAIL
        </div>
        <div className="flex items-center gap-4 text-[10px] tracking-widest text-white/45" style={MONO}>
          <span>SCORE -12.6 dB</span>
          <span>DIALOGUE -18.3 dB</span>
        </div>
      </div>
      <div className="space-y-2 relative">
        <Track label="Score" Icon={Music2} kind="score" />
        <Track label="Dialogue" Icon={Mic2} kind="dialogue" />
        {/* Playhead */}
        <div className="absolute top-0 bottom-0 left-[34%] w-px bg-primary shadow-[0_0_8px_rgba(10,132,255,0.7)] pointer-events-none">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-primary" />
        </div>
      </div>
    </div>
  );
}

function Track({ label, Icon, kind }: { label: string; Icon: typeof Music2; kind: "score" | "dialogue" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex items-center gap-2 text-[10px] text-white/55 tracking-widest" style={MONO}>
        <Icon className="h-3 w-3" /> {label.toUpperCase()}
      </div>
      <div className="flex-1 h-10 flex items-center gap-[2px]">
        {Array.from({ length: 140 }).map((_, i) => {
          const base = kind === "score"
            ? Math.abs(Math.sin(i * 0.18) + Math.cos(i * 0.32) * 0.5)
            : Math.abs(Math.sin(i * 0.4)) * (i > 30 && i < 80 ? 0.25 : 1);
          const h = 10 + base * 80;
          return (
            <div
              key={i}
              className={cn(
                "flex-1",
                kind === "score" ? "bg-primary/55" : "bg-white/55"
              )}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function Section({ title, children, mono }: { title: string; children?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-white/[0.04]">
      <div className="text-white text-base" style={SERIF}>{title}</div>
      {children}
    </div>
  );
}

function Panel({ title, badge, icon, children }: { title: string; badge?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-white/[0.04]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] text-white/45" style={MONO}>
          {title.toUpperCase()}
          {icon}
        </div>
        {badge && (
          <span className="text-[9px] tracking-widest text-primary/80 border border-primary/30 px-1.5 py-0.5" style={MONO}>
            {badge.toUpperCase()}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function CastChip({ name, role, status }: { name: string; role: string; status: "locked" | "drift" }) {
  return (
    <div className="flex items-center gap-3 mb-2 last:mb-0">
      <div
        className="h-10 w-10 rounded-full border border-white/15 relative overflow-hidden shrink-0"
        style={{ background: "radial-gradient(circle at 35% 30%, hsl(30 30% 50%), hsl(220 14% 8%) 70%)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white truncate" style={SERIF}>{name}</div>
        <div className="text-[10px] text-white/45 tracking-widest" style={MONO}>{role.toUpperCase()}</div>
      </div>
      <div className="flex items-center gap-1 text-[9px] text-emerald-400 tracking-widest" style={MONO}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {status.toUpperCase()}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[10px] text-white/40 tracking-widest" style={MONO}>{k.toUpperCase()}</span>
      <span className="text-[12px] text-white/85" style={SERIF}>{v}</span>
    </div>
  );
}

function DropdownRow({ label, value, Icon }: { label: string; value: string; Icon: typeof Camera }) {
  return (
    <button className="w-full flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0 group">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-white/40 group-hover:text-primary" />
        <span className="text-[10px] text-white/45 tracking-widest" style={MONO}>{label.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-white/85" style={SERIF}>{value}</span>
        <ChevronDown className="h-3 w-3 text-white/35" />
      </div>
    </button>
  );
}

function SliderRow({
  label, value, onChange, min, max, step, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] text-white/45 tracking-widest" style={MONO}>{label.toUpperCase()}</span>
        <span className="text-[12px] text-white" style={SERIF}>{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}
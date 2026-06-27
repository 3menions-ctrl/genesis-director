/**
 * Breakthrough Lab — a public, real-time playground for the procedural
 * Breakthrough FX engine. Pick a template and watch the 4-layer effect play
 * live on a canvas: scrub it, drag the Intensity, and move the break beat to
 * see it re-sync — all deterministic, all client-side, no generation engine.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Play, Pause, RotateCcw, Shuffle, Repeat, Sparkles, Zap, Activity, Boxes, Square,
} from "lucide-react";
import { BreakthroughStage } from "@/components/breakthrough/BreakthroughStage";
import { Breakthrough3DStage } from "@/components/breakthrough/Breakthrough3DStage";
import { simKindFor } from "@/lib/breakthrough-fx";
import {
  getAllBreakthroughTemplates,
  resolveTemplate,
  CONTAINER_LABELS,
  BOUNDARY_VIOLATION_LABELS,
  DESTINATION_LABELS,
  type TemplateDefinition,
} from "@/lib/templates/breakthrough";
import { ASPECT_RATIOS } from "@/lib/editor/types";

export default function BreakthroughLab() {
  const templates = useMemo(() => getAllBreakthroughTemplates(), []);
  const [def, setDef] = useState<TemplateDefinition>(templates[0]);
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [intensity, setIntensity] = useState(1);
  const [seed, setSeed] = useState(1337);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(def.timeline.durationSec);
  const [scrub, setScrub] = useState<number | null>(null);
  const [breakBeat, setBreakBeat] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<"3D" | "2D">("3D");

  useEffect(() => { document.title = "Breakthrough Lab — Small Bridges"; }, []);

  const ar = ASPECT_RATIOS[def.aspectRatio] ?? { w: 9, h: 16 };
  const scene = useMemo(
    () => resolveTemplate(def, breakBeat != null ? { audioCue: { atSec: breakBeat } } : {}),
    [def, breakBeat],
  );
  const effectiveBreak = scene.timeline.breakBeatSec;

  const selectTemplate = (t: TemplateDefinition) => {
    setDef(t);
    setBreakBeat(undefined);
    setTime(0);
    setScrub(0);
    setDuration(t.timeline.durationSec);
    setPlaying(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#04050a] text-white/90 overflow-x-hidden">
      {/* Aurora wash */}
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: `radial-gradient(60% 50% at 50% 0%, ${def.colorGrade.primary}55, transparent 60%), radial-gradient(50% 50% at 90% 100%, ${def.colorGrade.accent}33, transparent 60%)` }} />

      <header className="px-6 pt-10 pb-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50">
          <Sparkles className="w-3.5 h-3.5" /> Procedural · real-time · deterministic
        </div>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">Breakthrough Lab</h1>
        <p className="mt-2 text-white/55 max-w-2xl">
          Every effect below is simulated live in your browser from the
          container × boundary-violation × destination data model — no AI render,
          no wait. Scrub it, drag the intensity, move the break beat.
        </p>
      </header>

      <main className="px-6 pb-24 max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Stage + transport */}
        <section>
          {/* 2D / 3D engine toggle */}
          <div className="mb-3 inline-flex rounded-full bg-white/5 p-1 text-sm">
            <button onClick={() => setMode("3D")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition ${mode === "3D" ? "bg-white/15" : "text-white/50"}`}>
              <Boxes className="w-4 h-4" /> 3D engine
            </button>
            <button onClick={() => setMode("2D")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition ${mode === "2D" ? "bg-white/15" : "text-white/50"}`}>
              <Square className="w-4 h-4" /> 2D preview
            </button>
          </div>
          <div className="relative mx-auto" style={{ aspectRatio: `${ar.w}/${ar.h}`, maxHeight: "70vh" }}>
            {mode === "3D" ? (
              <Breakthrough3DStage
                def={def}
                playing={playing}
                loop={loop}
                intensity={intensity}
                seed={seed}
                scrubTime={scrub}
                onTime={(t) => { setTime(t); setScrub(null); }}
                onDuration={setDuration}
                className="shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <BreakthroughStage
                def={def}
                playing={playing}
                loop={loop}
                intensity={intensity}
                breakBeatSec={breakBeat}
                seed={seed}
                scrubTime={scrub}
                onTime={(t) => { setTime(t); setScrub(null); }}
                onDuration={setDuration}
                className="shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
              />
            )}
          </div>

          {/* transport */}
          <div className="mt-5 flex items-center gap-4">
            <button onClick={() => setPlaying((p) => !p)}
              className="grid place-items-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-0.5" />}
            </button>
            <input type="range" min={0} max={duration} step={0.05} value={time}
              onChange={(e) => { const v = +e.target.value; setPlaying(false); setTime(v); setScrub(v); }}
              className="flex-1 accent-white" />
            <span className="tabular-nums text-sm text-white/60 w-20 text-right">
              {time.toFixed(1)} / {duration.toFixed(0)}s
            </span>
            <button onClick={() => setLoop((l) => !l)} title="Loop"
              className={`grid place-items-center w-10 h-10 rounded-full transition ${loop ? "bg-white/20" : "bg-white/5"}`}>
              <Repeat className="w-4 h-4" />
            </button>
            <button onClick={() => { setTime(0); setScrub(0); }} title="Restart"
              className="grid place-items-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 transition">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Controls + readout */}
        <aside className="space-y-7">
          {/* template picker */}
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/40 mb-3">Template</div>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button key={t.id} onClick={() => selectTemplate(t)}
                  className={`px-3 py-1.5 rounded-full text-sm transition border ${
                    t.id === def.id
                      ? "border-white/60 bg-white/15"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* params */}
          <div className="space-y-5">
            <Slider icon={<Zap className="w-4 h-4" />} label="Intensity" value={intensity}
              min={0.3} max={2} step={0.05} onChange={setIntensity} fmt={(v) => `${v.toFixed(2)}×`} />
            <Slider icon={<Activity className="w-4 h-4" />} label="Break beat (audio-cue sync)"
              value={breakBeat ?? effectiveBreak} min={1} max={Math.max(2, duration - 1)} step={0.1}
              onChange={(v) => setBreakBeat(v)} fmt={(v) => `${v.toFixed(1)}s`} />
            <button onClick={() => setSeed((s) => (s * 1103515245 + 12345) & 0x7fffffff)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition">
              <Shuffle className="w-4 h-4" /> Reseed simulation
            </button>
          </div>

          {/* readout — ties the visual to the data model */}
          <div className="rounded-2xl bg-white/[0.04] p-4 text-sm space-y-2.5">
            <Row k="Container" v={CONTAINER_LABELS[def.container.kind]} />
            <Row k="Violation" v={BOUNDARY_VIOLATION_LABELS[def.boundaryViolation]} />
            <Row k="Destination" v={DESTINATION_LABELS[def.destination]} />
            <Row k="Simulator" v={simKindFor(def.boundaryViolation)} />
            <Row k="Break beat" v={`${effectiveBreak.toFixed(1)}s`} />
            <Row k="Mask opens" v={`${scene.mask.openStartSec.toFixed(1)}–${scene.mask.openEndSec.toFixed(1)}s`} />
            <div className="pt-1 border-t border-white/10">
              <div className="text-white/40 text-xs mb-1.5">Beats</div>
              <div className="flex flex-wrap gap-1.5">
                {scene.timeline.beats.map((b) => (
                  <span key={b.id} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-white/60">
                    {b.label} · {b.atSec.toFixed(1)}s
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-white/35 leading-relaxed">
            Deterministic from a seed — same template + seed always renders the
            same frames. The film-grade version drives the identical data model
            through Warp/Blender (see PROCEDURAL-VFX.md).
          </p>
        </aside>
      </main>
    </div>
  );
}

function Slider({ icon, label, value, min, max, step, onChange, fmt }: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-2 text-white/70">{icon}{label}</span>
        <span className="tabular-nums text-white/50">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-white" />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{k}</span>
      <span className="text-white/80 capitalize">{v}</span>
    </div>
  );
}

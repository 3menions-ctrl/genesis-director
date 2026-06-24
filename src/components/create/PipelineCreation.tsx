/**
 * PipelineCreation — the premium "Building your story" creation view,
 * now wired to the Continuity Engine's live progress model.
 *
 * The Small Bridges metaphor made literal: your film is a luminous
 * bridge from your IDEA to the finished STORY, building left→right as
 * the real pipeline advances. Over it we render what actually makes the
 * film hold together:
 *
 *   • an 8-phase rail (Identity bible → … → Continuity report)
 *   • a live CONTINUITY INDEX ring (the film-level audit score)
 *   • the CONTINUITY CHAIN — every shot as a node, joined by its typed
 *     boundary edge, lighting up as each clip passes its audit gate
 *
 * Purely presentational. Pass a `pipeline` (PipelineProgress) for the
 * full visualisation; or just `progress` (0–100) for the simple bridge.
 * No fake timers — the parent drives it from the live status model.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_PHASES,
  type PipelineProgress,
  type ClipProgress,
  type PhaseKind,
  type PhaseStatus,
  type BoundaryType,
} from "@/lib/video/continuity";

/** Legacy 5-stage labels kept for callers that still pass stageIndex. */
export const PIPELINE_STAGES = [
  "Analyzing idea",
  "Building scenes",
  "Generating motion",
  "Enhancing details",
  "Finalizing film",
] as const;

interface Props {
  /** 0–100 overall build progress (drives the bridge reveal). Ignored
   *  when `pipeline` is supplied — its `overall` wins. */
  progress?: number;
  /** Legacy 0–4 stage (only used in the simple, no-pipeline view). */
  stageIndex?: number;
  /** The full Continuity Engine progress model — the premium view. */
  pipeline?: PipelineProgress;
  /** The user's prompt — shown on the near bank. */
  prompt?: string;
  /** Optional live preview of the developing film. */
  previewSrc?: string | null;
  variant?: "aurora" | "gold";
  onCancel?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette helpers
// ─────────────────────────────────────────────────────────────────────────────

const KIND_ACCENT: Record<PhaseKind, { hex: string; glow: string }> = {
  identity: { hex: "#b69bff", glow: "rgba(182,155,255,.65)" },
  image: { hex: "#7fd8ff", glow: "rgba(127,216,255,.6)" },
  audit: { hex: "#ffd27a", glow: "rgba(255,210,122,.6)" },
  approval: { hex: "#ffffff", glow: "rgba(255,255,255,.55)" },
  motion: { hex: "#ffb06a", glow: "rgba(255,176,106,.6)" },
  assembly: { hex: "#84e6c0", glow: "rgba(132,230,192,.6)" },
};

const BOUNDARY_GLYPH: Record<BoundaryType, string> = {
  CONTINUOUS: "→",
  MATCH_CUT: "⇥",
  HARD_CUT: "/",
  TIME_JUMP: "⏲",
  LOCATION_CHANGE: "⚲",
  INTRO: "◆",
};

const BOUNDARY_LABEL: Record<BoundaryType, string> = {
  CONTINUOUS: "Seamless",
  MATCH_CUT: "Match cut",
  HARD_CUT: "Cut",
  TIME_JUMP: "Time jump",
  LOCATION_CHANGE: "New place",
  INTRO: "Open",
};

function scoreColor(v: number | undefined): string {
  if (v == null) return "rgba(255,255,255,.35)";
  if (v >= 90) return "#84e6c0";
  if (v >= 78) return "#cfe9a8";
  if (v >= 62) return "#ffd27a";
  return "#ff7a8a";
}

// ─────────────────────────────────────────────────────────────────────────────
// BridgeMark — the wordmark's bridge glyph, drawn as an actual
// suspension bridge (towers, draped main cable, suspenders, deck).
// ─────────────────────────────────────────────────────────────────────────────

function BridgeMark() {
  return (
    <svg aria-hidden viewBox="0 0 44 18" className="inline-block h-[18px] w-11 -mb-[3px]"
      fill="none" style={{ filter: "drop-shadow(0 0 9px rgba(150,200,255,.65))" }}>
      <defs>
        <linearGradient id="bridgeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8fbfff" />
        </linearGradient>
      </defs>
      <g stroke="url(#bridgeGrad)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {/* deck */}
        <path d="M2 13 H42" />
        {/* towers */}
        <path d="M15 13 V2.5 M29 13 V2.5" />
        {/* main cable: anchor → tower → draped span → tower → anchor */}
        <path d="M2 13 Q8 2.5 15 2.5 Q22 11 29 2.5 Q36 2.5 42 13" />
        {/* suspenders */}
        <path d="M18.5 5.7 V13 M22 6.75 V13 M25.5 5.7 V13" strokeWidth="1" opacity="0.85" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function PipelineCreation({
  progress = 0,
  stageIndex,
  pipeline,
  prompt,
  previewSrc,
  variant = "aurora",
  onCancel,
}: Props) {
  const p = Math.max(0, Math.min(100, pipeline?.overall ?? progress));
  const bg = variant === "gold" ? "/create/bridge-gold.png" : "/create/bridge-aurora.png";

  const activePhase = useMemo(() => {
    if (!pipeline) return null;
    return PIPELINE_PHASES.find((ph) => ph.id === pipeline.phaseId) ?? PIPELINE_PHASES[0];
  }, [pipeline]);

  const embers = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        dx: (i % 5) * 7 - 14,
        delay: (i * 0.27) % 2.4,
        dur: 2.2 + (i % 4) * 0.5,
        size: 2 + (i % 3),
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#04050b] font-sans text-white">
      {/* ── Scene: the bridge builds left→right ─────────────────────────── */}
      <div className="absolute inset-0">
        <motion.img
          src={bg} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(.34) saturate(.62) blur(.5px)" }}
          initial={{ scale: 1.08 }} animate={{ scale: 1.14 }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.img
          src={bg} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(1.06) saturate(1.18) contrast(1.04)" }}
          initial={{ scale: 1.08 }} animate={{ scale: 1.14 }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
        />
        <div
          className="absolute inset-y-0 right-0 transition-[width] duration-1000 ease-out"
          style={{
            width: `${100 - p}%`,
            background: "linear-gradient(90deg, rgba(4,5,11,0) 0%, rgba(4,5,11,.62) 14%, rgba(4,5,11,.82) 100%)",
            backdropFilter: "brightness(.4) saturate(.6)",
            WebkitBackdropFilter: "brightness(.4) saturate(.6)",
          }}
        />
        <div className="absolute inset-y-0 transition-[left] duration-1000 ease-out" style={{ left: `${p}%` }}>
          <div className="absolute inset-y-0 -left-px w-[3px] bg-gradient-to-b from-transparent via-white to-transparent"
            style={{ boxShadow: "0 0 70px 22px rgba(150,210,255,.55)" }} />
          <div className="absolute top-1/2 -left-[90px] h-[180px] w-[180px] -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(190,225,255,.55), transparent 70%)" }} />
          {embers.map((e) => (
            <motion.span key={e.id} aria-hidden
              className="absolute top-1/2 rounded-full bg-cyan-100"
              style={{ width: e.size, height: e.size, left: e.dx, boxShadow: "0 0 10px 2px rgba(170,220,255,.8)" }}
              initial={{ opacity: 0, y: 0, x: 0 }}
              animate={{ opacity: [0, 1, 0], y: [-4, -130], x: [0, e.dx * 1.6] }}
              transition={{ duration: e.dur, delay: e.delay, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 38%, transparent 40%, rgba(4,5,11,.55) 100%)" }} />
        <div className="absolute inset-x-0 top-0 h-64" style={{ background: "linear-gradient(180deg, rgba(4,5,11,.8), transparent)" }} />
        <div className="absolute inset-x-0 bottom-0 h-96" style={{ background: "linear-gradient(0deg, rgba(4,5,11,.94), transparent)" }} />
      </div>

      {/* ── UI overlay ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-full flex-col">
        {/* wordmark */}
        <motion.div className="pt-9 text-center"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="inline-flex items-center gap-4 font-display text-[26px] font-medium tracking-[.26em]">
            SMALL
            <BridgeMark />
            BRIDGES
          </div>
          <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[.4em] text-white/45">
            {activePhase ? activePhase.blurb : "Building your story"}
          </div>
        </motion.div>

        {/* phase rail */}
        {pipeline ? (
          <PhaseRail pipeline={pipeline} />
        ) : (
          <LegacyStageRail progress={p} stageIndex={stageIndex} />
        )}

        <div className="flex-1" />

        {/* continuity chain — the measurement centrepiece */}
        {pipeline && pipeline.clips.length > 0 && (
          <ClipChain clips={pipeline.clips} message={pipeline.message} />
        )}

        {/* bottom: idea · progress · continuity index */}
        <div className="flex items-end justify-between gap-8 px-12 pb-10">
          {/* idea card */}
          <motion.div className="hidden w-[300px] rounded-2xl bg-white/[0.04] p-5 backdrop-blur-xl lg:block"
            style={{ boxShadow: "0 30px 80px -40px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3, duration: .6 }}>
            <div className="font-mono text-[10.5px] uppercase tracking-[.24em] text-cyan-200/80">Your idea</div>
            <div className="mt-2.5 font-display text-[18px] font-normal leading-snug text-white/90 line-clamp-3">
              {prompt?.trim() || "Your story is being built into a film."}
            </div>
          </motion.div>

          {/* progress */}
          <motion.div className="flex-1 max-w-[560px] pb-1 text-center"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6 }}>
            {/* The single screen-reader live region — the visual layers
                below are decorative and aria-hidden to avoid double-reads. */}
            <span className="sr-only" role="status" aria-live="polite">
              {activePhase ? activePhase.label : "Building"} — {Math.round(p)} percent complete
              {pipeline?.continuityIndex != null ? `, continuity index ${pipeline.continuityIndex} of 100` : ""}
              {pipeline?.message ? `. ${pipeline.message}` : ""}
            </span>
            <div aria-hidden className="font-mono text-[11.5px] uppercase tracking-[.34em] text-white/55">
              {activePhase ? activePhase.label : PIPELINE_STAGES[Math.min(4, Math.floor((p / 100) * 5))]}
            </div>
            <div aria-hidden className="my-1.5 font-display text-[62px] font-semibold leading-none tracking-[-.03em] tabular-nums"
              style={{ background: "linear-gradient(98deg,#ffe1ad,#fff 48%,#9fd8ff)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {Math.round(p)}%
            </div>
            <div className="mx-auto h-[5px] w-full max-w-[440px] overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#ffd27a,#fff 55%,#7fd8ff)", boxShadow: "0 0 22px rgba(150,210,255,.6)" }}
                animate={{ width: `${p}%` }} transition={{ duration: 1, ease: "easeOut" }} />
            </div>
            {onCancel && (
              <button type="button" onClick={onCancel}
                className="mt-5 font-mono text-[10.5px] uppercase tracking-[.2em] text-white/40 transition-colors hover:text-white/70">
                Cancel creation
              </button>
            )}
          </motion.div>

          {/* continuity index ring (or live preview when no pipeline) */}
          {pipeline ? (
            <motion.div className="hidden w-[300px] items-center justify-end lg:flex"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3, duration: .6 }}>
              <ContinuityRing value={pipeline.continuityIndex} clips={pipeline.clips} />
            </motion.div>
          ) : (
            <motion.div className="hidden w-[300px] overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl lg:block"
              style={{ boxShadow: "0 30px 80px -40px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3, duration: .6 }}>
              <div className="relative h-[170px]">
                {previewSrc
                  ? <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                  : <div className="h-full w-full" style={{ background: "radial-gradient(120% 80% at 30% 20%, rgba(255,180,90,.35), transparent 55%), linear-gradient(160deg,#152347,#2e1748 60%,#5e2330)" }} />}
                <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px 24px rgba(0,0,0,.55)" }} />
                <div className="absolute left-3.5 top-3 flex items-center gap-2 font-mono text-[10.5px] tracking-[.16em] text-white/80">
                  <span className="h-2 w-2 rounded-full bg-rose-400" style={{ boxShadow: "0 0 12px 2px rgba(255,90,122,.8)" }} />
                  YOUR STORY · FORMING
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="pb-6 text-center font-mono text-[10.5px] uppercase tracking-[.4em] text-white/30">
          Small Bridges · seamless continuity · audited frame by frame
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase rail (8 real phases)
// ─────────────────────────────────────────────────────────────────────────────

function PhaseRail({ pipeline }: { pipeline: PipelineProgress }) {
  return (
    <div className="mt-7 flex items-start justify-center gap-0 px-6">
      {PIPELINE_PHASES.map((ph, i) => {
        const state: PhaseStatus = pipeline.phases.find((x) => x.id === ph.id)?.status ?? "pending";
        const accent = KIND_ACCENT[ph.kind];
        const done = state === "done";
        const now = state === "active";
        const failed = state === "failed";
        return (
          <div key={ph.id} className="flex items-center">
            <motion.div className="flex w-[118px] flex-col items-center text-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 + i * .06, duration: .5 }}>
              <span className={cn("relative flex h-3 w-3 items-center justify-center rounded-full")}
                style={{
                  background: failed ? "#ff7a8a" : done ? "#ffffff" : now ? accent.hex : "rgba(255,255,255,.22)",
                  boxShadow: done || now || failed ? `0 0 14px 3px ${failed ? "rgba(255,122,138,.6)" : accent.glow}` : undefined,
                }}>
                {now && <span className="absolute h-3 w-3 animate-ping rounded-full" style={{ background: accent.glow }} />}
                {done && <Check className="h-2 w-2 text-black" strokeWidth={3.5} />}
              </span>
              <span className={cn("mt-2.5 font-mono text-[9px] tracking-[.16em]",
                done ? "text-white/45" : now ? "text-white/80" : "text-white/25")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn("mt-0.5 text-[11px] font-medium leading-tight",
                done ? "text-white/70" : now ? "text-white" : "text-white/30")}>
                {ph.label}
              </span>
            </motion.div>
            {i < PIPELINE_PHASES.length - 1 && (
              <span className="mt-[5px] h-px w-5 self-start" style={{
                background: done ? "linear-gradient(90deg,#fff,rgba(255,255,255,.25))" : "rgba(255,255,255,.12)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LegacyStageRail({ progress, stageIndex }: { progress: number; stageIndex?: number }) {
  const stage = stageIndex ?? Math.min(PIPELINE_STAGES.length - 1, Math.floor((progress / 100) * PIPELINE_STAGES.length));
  return (
    <div className="mt-9 flex items-start justify-center gap-0 px-8">
      {PIPELINE_STAGES.map((label, i) => {
        const done = i < stage, now = i === stage;
        return (
          <div key={label} className="flex items-center">
            <div className="flex w-[150px] flex-col items-center text-center">
              <span className={cn("relative flex h-3 w-3 items-center justify-center rounded-full",
                done ? "bg-white" : now ? "bg-cyan-200" : "bg-white/25")}
                style={done || now ? { boxShadow: "0 0 14px 3px rgba(150,210,255,.7)" } : undefined}>
                {now && <span className="absolute h-3 w-3 animate-ping rounded-full bg-cyan-200/70" />}
              </span>
              <span className={cn("mt-3 text-[13.5px] font-medium leading-tight",
                done ? "text-white/80" : now ? "text-white" : "text-white/35")}>
                {label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span className="mt-[5px] h-px w-8 self-start" style={{
                background: i < stage ? "linear-gradient(90deg,#fff,rgba(255,255,255,.3))" : "rgba(255,255,255,.12)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuity chain — the per-clip measurement strip
// ─────────────────────────────────────────────────────────────────────────────

function ClipChain({ clips, message }: { clips: ClipProgress[]; message?: string }) {
  return (
    <motion.div className="mx-auto mb-2 w-full max-w-[1180px] px-10"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25, duration: .6 }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[.28em] text-white/40">
          Continuity chain
        </div>
        {message && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.18em] text-amber-200/70">
            <Sparkles className="h-3 w-3" /> {message}
          </div>
        )}
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)" }}>
        {clips.map((c, i) => (
          <div key={c.shotId} className="flex items-stretch">
            {i > 0 && <BoundaryEdge type={c.boundaryType} />}
            <ClipNode clip={c} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BoundaryEdge({ type }: { type?: BoundaryType }) {
  const t = type ?? "MATCH_CUT";
  const seamless = t === "CONTINUOUS";
  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-center pb-7">
      <div className="relative h-px w-full"
        style={{
          background: seamless
            ? "linear-gradient(90deg, rgba(132,230,192,.2), rgba(132,230,192,.9), rgba(132,230,192,.2))"
            : "repeating-linear-gradient(90deg, rgba(255,255,255,.4) 0 3px, transparent 3px 7px)",
          boxShadow: seamless ? "0 0 8px rgba(132,230,192,.5)" : undefined,
        }} />
      <div className="mt-1 font-mono text-[8px] uppercase tracking-[.12em]"
        style={{ color: seamless ? "rgba(132,230,192,.85)" : "rgba(255,255,255,.4)" }}>
        {BOUNDARY_GLYPH[t]} {BOUNDARY_LABEL[t]}
      </div>
    </div>
  );
}

function ClipNode({ clip }: { clip: ClipProgress }) {
  const { status } = clip;
  const ringColor =
    status === "passed" ? "#84e6c0"
    : status === "failed" ? "#ff7a8a"
    : status === "auditing" ? "#b69bff"
    : status === "correcting" ? "#ffd27a"
    : status === "rendering" ? "#ffb06a"
    : "rgba(255,255,255,.25)";

  const active = status === "rendering" || status === "auditing" || status === "correcting";

  return (
    <div className="flex w-[92px] shrink-0 flex-col items-center">
      <div className="relative h-[68px] w-[68px]">
        {/* rotating sweep while active */}
        {active && (
          <motion.span aria-hidden className="absolute inset-[-3px] rounded-2xl"
            style={{ background: `conic-gradient(from 0deg, transparent, ${ringColor})`, opacity: .9 }}
            animate={{ rotate: 360 }} transition={{ duration: 1.6, ease: "linear", repeat: Infinity }} />
        )}
        {/* tile */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl"
          style={{ border: `1.5px solid ${ringColor}`, boxShadow: active ? `0 0 18px -2px ${ringColor}` : undefined, background: "#0a0c16" }}>
          {clip.thumbUrl ? (
            <img src={clip.thumbUrl} alt="" className="h-full w-full object-cover"
              style={{ opacity: status === "pending" ? 0.35 : 1 }} />
          ) : (
            <div className="h-full w-full"
              style={{ background: status === "pending"
                ? "linear-gradient(160deg,#11131f,#0a0c16)"
                : "radial-gradient(120% 90% at 30% 20%, rgba(127,216,255,.18), transparent 60%), linear-gradient(160deg,#16203a,#241634)" }} />
          )}
          {/* status badge */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-0.5">
            {status === "passed" && typeof clip.composite === "number" ? (
              <span className="font-mono text-[12px] font-semibold tabular-nums"
                style={{ color: scoreColor(clip.composite), textShadow: "0 1px 4px #000" }}>
                {clip.composite}
              </span>
            ) : status === "failed" ? (
              <AlertTriangle className="mb-0.5 h-3.5 w-3.5 text-rose-300" />
            ) : null}
          </div>
          {status === "passed" && (
            <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: "#84e6c0", boxShadow: "0 0 8px rgba(132,230,192,.7)" }}>
              <Check className="h-2.5 w-2.5 text-black" strokeWidth={3.5} />
            </div>
          )}
        </div>
      </div>

      <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-white/55">{clip.label}</span>
      <span className="mt-px h-3 font-mono text-[8px] uppercase tracking-[.08em]"
        style={{ color: ringColor }}>
        {status === "correcting" && clip.correction ? clip.correction
          : status === "rendering" ? "rendering"
          : status === "auditing" ? "auditing"
          : status === "failed" ? (clip.priority ?? "failed")
          : status === "passed" ? (clip.engine ?? "ok")
          : ""}
      </span>
      {/* attempt pips */}
      {clip.maxAttempts > 1 && (status === "correcting" || status === "rendering") && (
        <div className="mt-0.5 flex gap-0.5">
          {Array.from({ length: clip.maxAttempts }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full"
              style={{ background: i <= clip.attempt ? ringColor : "rgba(255,255,255,.18)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuity index ring
// ─────────────────────────────────────────────────────────────────────────────

const DIMS: Array<{ key: keyof NonNullable<ClipProgress["scores"]>; label: string }> = [
  { key: "identity", label: "ID" },
  { key: "boundary", label: "Seam" },
  { key: "temporal", label: "Motion" },
  { key: "color", label: "Colour" },
];

function ContinuityRing({ value, clips }: { value?: number; clips: ClipProgress[] }) {
  const v = value ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, v)) / 100) * c;
  const col = scoreColor(value);

  // Mean per-dimension across audited clips, for the mini bars.
  const dimMeans = useMemo(() => {
    const acc: Record<string, { sum: number; n: number }> = {};
    for (const cl of clips) {
      if (!cl.scores) continue;
      for (const d of DIMS) {
        const s = cl.scores[d.key];
        if (typeof s === "number") {
          acc[d.key] = acc[d.key] ?? { sum: 0, n: 0 };
          acc[d.key].sum += s; acc[d.key].n += 1;
        }
      }
    }
    return DIMS.map((d) => ({ ...d, val: acc[d.key] ? Math.round(acc[d.key].sum / acc[d.key].n) : null }));
  }, [clips]);

  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/[0.035] p-5 backdrop-blur-xl"
      style={{ boxShadow: "0 30px 80px -40px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}>
      <div className="font-mono text-[10px] uppercase tracking-[.24em] text-white/45">Continuity index</div>
      <div className="relative mt-3 h-[128px] w-[128px]">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
          <motion.circle cx="64" cy="64" r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - dash }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[40px] font-semibold leading-none tabular-nums"
            style={{ color: col }}>{value == null ? "—" : value}</span>
          <span className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[.2em] text-white/40">/ 100</span>
        </div>
      </div>
      {/* per-dimension mini bars */}
      <div className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-2">
        {dimMeans.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-9 font-mono text-[8.5px] uppercase tracking-[.1em] text-white/40">{d.label}</span>
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div className="h-full rounded-full"
                style={{ background: scoreColor(d.val ?? undefined) }}
                initial={{ width: 0 }} animate={{ width: `${d.val ?? 0}%` }} transition={{ duration: .8, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

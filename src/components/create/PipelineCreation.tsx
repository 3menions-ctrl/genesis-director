/**
 * PipelineCreation — the premium "Building your story" creation view.
 *
 * The Small Bridges metaphor made literal: your film is built as a luminous
 * bridge spanning from your IDEA (near bank) to the finished STORY (far bank).
 * The bridge lights up and builds left→right as the real generation stages
 * progress — a dim base bridge with a bright, progress-clipped reveal layer and
 * a glowing build-front where it's actively being assembled.
 *
 * Purely presentational: pass `progress` (0–100) + `stageIndex`; the parent
 * derives those from the live generation status bus. No fake timers.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const PIPELINE_STAGES = [
  "Analyzing idea",
  "Building scenes",
  "Generating motion",
  "Enhancing details",
  "Finalizing film",
] as const;

interface Props {
  /** 0–100, overall build progress (drives the bridge reveal). */
  progress: number;
  /** 0–4 current stage; if omitted, derived from progress. */
  stageIndex?: number;
  /** The user's prompt — shown on the near bank. */
  prompt?: string;
  /** Optional live preview of the developing film (far bank). */
  previewSrc?: string | null;
  /** Visual backdrop. */
  variant?: "aurora" | "gold";
  onCancel?: () => void;
}

export function PipelineCreation({
  progress,
  stageIndex,
  prompt,
  previewSrc,
  variant = "aurora",
  onCancel,
}: Props) {
  const p = Math.max(0, Math.min(100, progress));
  const stage = stageIndex ?? Math.min(PIPELINE_STAGES.length - 1, Math.floor((p / 100) * PIPELINE_STAGES.length));
  const bg = variant === "gold" ? "/create/bridge-gold.png" : "/create/bridge-aurora.png";

  // A few drifting embers at the build-front (deterministic, no Math.random
  // re-render churn).
  const embers = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({
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
        {/* dim, unbuilt base */}
        <motion.img
          src={bg} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(.34) saturate(.62) blur(.5px)" }}
          initial={{ scale: 1.08 }} animate={{ scale: 1.14 }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
        />
        {/* bright, built reveal — clipped to progress */}
        <motion.img
          src={bg} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(1.06) saturate(1.18) contrast(1.04)" }}
          initial={{ scale: 1.08 }} animate={{ scale: 1.14 }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
        />
        {/* mask layer sits ABOVE the bright image to hide the unbuilt part:
            a dimming veil covering from the build-front to the right edge. */}
        <div
          className="absolute inset-y-0 right-0 transition-[width] duration-1000 ease-out"
          style={{
            width: `${100 - p}%`,
            background: "linear-gradient(90deg, rgba(4,5,11,0) 0%, rgba(4,5,11,.62) 14%, rgba(4,5,11,.82) 100%)",
            backdropFilter: "brightness(.4) saturate(.6)",
            WebkitBackdropFilter: "brightness(.4) saturate(.6)",
          }}
        />
        {/* build-front: a luminous seam + bloom + embers, parked at progress */}
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
        {/* atmosphere scrims for legibility + depth */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 38%, transparent 40%, rgba(4,5,11,.55) 100%)" }} />
        <div className="absolute inset-x-0 top-0 h-64" style={{ background: "linear-gradient(180deg, rgba(4,5,11,.8), transparent)" }} />
        <div className="absolute inset-x-0 bottom-0 h-80" style={{ background: "linear-gradient(0deg, rgba(4,5,11,.92), transparent)" }} />
      </div>

      {/* ── UI overlay ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-full flex-col">
        {/* wordmark */}
        <motion.div className="pt-12 text-center"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="inline-flex items-center gap-4 font-display text-[30px] font-medium tracking-[.26em]">
            SMALL
            <span aria-hidden className="inline-block h-4 w-9" style={{
              maskImage: "radial-gradient(closest-side at 50% 100%, #000 98%, transparent)",
              WebkitMaskImage: "radial-gradient(closest-side at 50% 100%, #000 98%, transparent)",
              background: "linear-gradient(#fff,#8fbfff)", boxShadow: "0 0 14px rgba(150,200,255,.6)",
            }} />
            BRIDGES
          </div>
          <div className="mt-2.5 font-mono text-[11.5px] uppercase tracking-[.4em] text-white/45">
            Building your story
          </div>
        </motion.div>

        {/* stage rail */}
        <div className="mt-10 flex items-start justify-center gap-0 px-8">
          {PIPELINE_STAGES.map((label, i) => {
            const done = i < stage, now = i === stage;
            return (
              <div key={label} className="flex items-center">
                <motion.div className="flex w-[150px] flex-col items-center text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 + i * .08, duration: .5 }}>
                  <span className={cn("relative flex h-3 w-3 items-center justify-center rounded-full",
                    done ? "bg-white" : now ? "bg-cyan-200" : "bg-white/25")}
                    style={done || now ? { boxShadow: "0 0 14px 3px rgba(150,210,255,.7)" } : undefined}>
                    {now && <span className="absolute h-3 w-3 animate-ping rounded-full bg-cyan-200/70" />}
                  </span>
                  <span className={cn("mt-3 font-mono text-[10px] tracking-[.16em]",
                    done ? "text-white/55" : now ? "text-cyan-100" : "text-white/30")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("mt-1 text-[13.5px] font-medium leading-tight",
                    done ? "text-white/80" : now ? "text-white" : "text-white/35")}>
                    {label}
                  </span>
                </motion.div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <span className="mt-[5px] h-px w-8 self-start" style={{
                    background: i < stage ? "linear-gradient(90deg,#fff,rgba(255,255,255,.3))" : "rgba(255,255,255,.12)",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* bottom: idea · progress · preview */}
        <div className="flex items-end justify-between gap-8 px-14 pb-12">
          {/* idea card */}
          <motion.div className="w-[320px] rounded-2xl bg-white/[0.04] p-5 backdrop-blur-xl"
            style={{ boxShadow: "0 30px 80px -40px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3, duration: .6 }}>
            <div className="font-mono text-[10.5px] uppercase tracking-[.24em] text-cyan-200/80">Your idea</div>
            <div className="mt-2.5 font-display text-[19px] font-normal leading-snug text-white/90 line-clamp-3">
              {prompt?.trim() || "Your story is being built into a film."}
            </div>
          </motion.div>

          {/* progress */}
          <motion.div className="flex-1 max-w-[560px] pb-1 text-center"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6 }}>
            <div className="font-mono text-[12px] uppercase tracking-[.34em] text-white/55">
              {PIPELINE_STAGES[stage]}
            </div>
            <div className="my-2 font-display text-[68px] font-semibold leading-none tracking-[-.03em] tabular-nums"
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
                className="mt-7 font-mono text-[10.5px] uppercase tracking-[.2em] text-white/40 transition-colors hover:text-white/70">
                Cancel creation
              </button>
            )}
          </motion.div>

          {/* live preview */}
          <motion.div className="w-[320px] overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl"
            style={{ boxShadow: "0 30px 80px -40px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3, duration: .6 }}>
            <div className="relative h-[180px]">
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
        </div>

        <div className="pb-7 text-center font-mono text-[11px] uppercase tracking-[.4em] text-white/30">
          Small Bridges · big connections · endless possibilities
        </div>
      </div>
    </div>
  );
}

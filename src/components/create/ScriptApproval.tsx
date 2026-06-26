/**
 * ScriptApproval — the premium "approve your script" step.
 *
 * After Generate + a passing credit check, the user reads the actual screenplay
 * that will drive the film, scene by scene (heading · action · the spoken line),
 * and approves it — which kicks off the bridge PipelineCreation. They can also
 * regenerate or edit before committing the credits.
 *
 * Presentational: the parent supplies the generated scenes + the credit numbers
 * and wires the buttons to the real flow.
 */
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Pencil, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

export interface ScriptScene {
  id: string;
  /** Slugline, e.g. "EXT. FUTURISTIC CITY — SUNSET". */
  heading: string;
  /** What we see — the action/description that becomes the shot. */
  action: string;
  /** The line spoken over the shot (voiceover / dialogue), if any. */
  voiceover?: string;
  durationSec: number;
  /** Two CSS colors for the scene's look strip. */
  gradient?: [string, string];
}

interface Props {
  /** Film title / working title. */
  title?: string;
  /** One-line logline summarising the film. */
  logline?: string;
  scenes: ScriptScene[];
  costCredits: number;
  balanceCredits: number;
  onApprove: () => void;
  onRegenerate: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  busy?: boolean;
}

const DEFAULT_GRADIENT: [string, string] = ["#2b3b8f", "#7d2d6b"];

export function ScriptApproval({
  title = "Untitled film",
  logline,
  scenes,
  costCredits,
  balanceCredits,
  onApprove,
  onRegenerate,
  onEdit,
  onClose,
  busy,
}: Props) {
  const totalSec = scenes.reduce((a, s) => a + (s.durationSec || 0), 0);
  const affordable = balanceCredits >= costCredits;

  // Portal to <body> so this full-screen takeover escapes FoundationShell's
  // stacking context (otherwise the always-on LeftRail renders over its edge).
  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#05060d] font-sans text-white">
      {/* aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-32 -top-40 h-[760px] w-[760px] rounded-full blur-[150px]" style={{ background: "radial-gradient(closest-side, rgba(120,140,255,.26), transparent 70%)" }} />
        <span className="absolute -right-24 bottom-[-220px] h-[720px] w-[720px] rounded-full blur-[150px]" style={{ background: "radial-gradient(closest-side, rgba(255,150,210,.16), transparent 70%)" }} />
        <span className="absolute left-1/2 top-1/3 h-[680px] w-[680px] rounded-full blur-[150px]" style={{ background: "radial-gradient(closest-side, rgba(120,235,255,.12), transparent 70%)" }} />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-[1280px] gap-12 px-12 pb-10 pt-12">
        {/* ── Screenplay column ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
            <div className="font-mono text-[11px] uppercase tracking-[.34em] text-cyan-200/70">Approve your script</div>
            <h1 className="mt-3 font-display text-[42px] font-semibold leading-none tracking-tight">
              Your <span className="italic text-[hsl(213_100%_88%)]">script</span>.
            </h1>
            <p className="mt-3 max-w-xl text-[14px] font-light leading-relaxed text-white/50">
              This is the screenplay we'll film — scene by scene, with the lines that will be spoken.
              Read it through and approve, or regenerate.
            </p>
          </motion.div>

          {/* the script surface */}
          <div className="mt-7 min-h-0 flex-1 overflow-y-auto pr-3 scrollbar-hide">
            <div className="mb-6 flex items-baseline gap-3">
              <span className="font-display text-[20px] font-medium">{title}</span>
              {logline && <span className="text-[13px] font-light italic text-white/45">— {logline}</span>}
            </div>

            <div className="mb-6 font-mono text-[12px] tracking-[.2em] text-white/35">FADE IN:</div>

            <div className="space-y-3.5">
              {scenes.map((s, i) => {
                const g = s.gradient ?? DEFAULT_GRADIENT;
                return (
                  <motion.div key={s.id}
                    className="flex gap-5 rounded-2xl bg-white/[0.025] p-5"
                    style={{ boxShadow: "0 24px 60px -40px #000" }}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 * i, duration: .45 }}>
                    {/* look strip */}
                    <div className="relative h-[96px] w-[150px] shrink-0 overflow-hidden rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${g[0]}, ${g[1]})` }}>
                      <span className="absolute inset-0" style={{ background: "radial-gradient(80% 60% at 25% 15%, rgba(255,255,255,.3), transparent 60%)" }} />
                      <span className="absolute left-2.5 top-2 font-mono text-[10px] tracking-[.16em] text-white/85">SC {String(i + 1).padStart(2, "0")}</span>
                      <span className="absolute bottom-2 right-2.5 flex items-center gap-1 font-mono text-[10px] text-white/85"><Clock className="h-2.5 w-2.5" /> {s.durationSec}s</span>
                    </div>
                    {/* screenplay text */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="font-mono text-[12.5px] font-medium uppercase tracking-[.12em] text-white/85">{s.heading}</div>
                      <p className="mt-2 text-[14.5px] font-light leading-relaxed text-white/65">{s.action}</p>
                      {s.voiceover && (
                        <div className="mt-3 border-l border-white/0 pl-0">
                          <span className="font-mono text-[10.5px] uppercase tracking-[.22em] text-cyan-200/70">V.O.</span>
                          <p className="mt-1 font-display text-[15px] italic leading-snug text-white/85">“{s.voiceover}”</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-6 font-mono text-[12px] tracking-[.2em] text-white/35">FADE OUT.</div>
          </div>
        </div>

        {/* ── Approval rail ─────────────────────────────────────────────── */}
        <motion.div className="flex w-[330px] shrink-0 flex-col"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5, delay: .1 }}>
          <div className="rounded-3xl bg-white/[0.03] p-7 backdrop-blur-xl"
            style={{ boxShadow: "0 40px 110px -50px #000, inset 0 1px 0 rgba(255,255,255,.07)" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
              <Sparkles className="h-5 w-5 text-[hsl(213_100%_88%)]" strokeWidth={1.7} />
            </div>
            <div className="mt-5 font-display text-[22px] font-semibold leading-tight">Ready to create</div>
            <p className="mt-2 text-[13px] font-light leading-relaxed text-white/50">
              Approving locks this script and starts building your film.
            </p>

            <div className="mt-6 space-y-3 text-[13px]">
              <Row label="Scenes" value={`${scenes.length}`} />
              <Row label="Runtime" value={`${Math.round(totalSec)}s`} />
              <div className="my-3 h-px bg-white/[0.06]" />
              <Row label="Cost" value={`${costCredits} credits`} accent />
              <Row label="Your balance" value={`${balanceCredits} credits`} dim={affordable} warn={!affordable} />
            </div>

            <button type="button" onClick={onApprove} disabled={busy || !affordable}
              className={cn(
                "group/btn mt-7 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14px] font-semibold transition-transform",
                affordable && !busy ? "bg-white text-[#06070a] hover:-translate-y-0.5" : "cursor-not-allowed bg-white/15 text-white/50",
              )}
              style={affordable && !busy ? { boxShadow: "0 18px 50px -14px rgba(150,210,255,.7)" } : undefined}>
              {busy ? "Starting…" : affordable ? <>Approve &amp; create <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" /></> : "Not enough credits"}
            </button>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onRegenerate} disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.05] px-4 py-2.5 text-[12.5px] font-medium text-white/75 transition-colors hover:bg-white/[0.1] disabled:opacity-40">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
              {onEdit && (
                <button type="button" onClick={onEdit} disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.05] px-4 py-2.5 text-[12.5px] font-medium text-white/75 transition-colors hover:bg-white/[0.1] disabled:opacity-40">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
          </div>

          {onClose && (
            <button type="button" onClick={onClose}
              className="mt-5 text-center font-mono text-[10.5px] uppercase tracking-[.2em] text-white/40 transition-colors hover:text-white/70">
              Back to create
            </button>
          )}
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value, accent, dim, warn }: { label: string; value: string; accent?: boolean; dim?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span className={cn("font-mono tabular-nums", accent ? "text-[hsl(213_100%_88%)]" : warn ? "text-rose-300" : dim ? "text-white/70" : "text-white/80")}>{value}</span>
    </div>
  );
}

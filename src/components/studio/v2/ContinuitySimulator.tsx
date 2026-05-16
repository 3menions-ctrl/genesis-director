/**
 * ContinuitySimulator
 * ───────────────────────────────────────────────────────────────────────────
 * Visual "what will actually happen" panel for the batch generator.
 *
 * For every scene it predicts:
 *   • Whether the chain will hold (continuous) or break (independent / no anchor)
 *   • Which image will be used as `startImageUrl` (prior tail frame, scene ref,
 *     brief ref, cast image, or NONE → pure text-to-video)
 *   • What changes if the user fires all scenes in PARALLEL vs. SEQUENTIAL —
 *     because parallel renders cannot inherit a tail frame that doesn't exist
 *     yet, so continuous chains silently degrade to brief/cast fallback.
 *
 * Pure presentation — reads scenes/cast/brief and renders chips. No mutations.
 */
import { useMemo, useState } from "react";
import { Link2, Scissors, ImageIcon, AlertTriangle, ChevronDown, Activity, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CastMember, SceneDraft, StudioBrief } from "./types";

type Mode = "sequential" | "parallel";

type StartSource =
  | { kind: "tail";    label: "Prior tail frame";    detail: string; url?: string }
  | { kind: "sceneRef"; label: "Scene reference";    detail: string; url: string }
  | { kind: "briefRef"; label: "Brief reference";    detail: string; url: string }
  | { kind: "cast";     label: "Cast portrait";      detail: string; url: string }
  | { kind: "none";     label: "None (pure T2V)";    detail: string };

interface Row {
  scene: SceneDraft;
  chained: boolean;          // user intent (chainFromPrevious !== false)
  willChain: boolean;        // actually chains in this mode
  start: StartSource;
  warning?: string;
}

function resolveStart(
  scene: SceneDraft,
  prev: SceneDraft | undefined,
  brief: StudioBrief,
  cast: CastMember[],
  mode: Mode,
): { start: StartSource; willChain: boolean; warning?: string } {
  const chained = scene.chainFromPrevious !== false && !!prev;
  const speaker = cast.find(c => c.id === scene.speakerId) || cast[0];

  if (chained) {
    if (mode === "sequential") {
      // Sequential gate extracts the tail frame at render-time, so as long as
      // the predecessor will actually produce a clip, the chain holds.
      return {
        start: {
          kind: "tail",
          label: "Prior tail frame",
          detail: `Last frame of scene ${prev!.index + 1} extracted at render time`,
          url: prev!.clipUrl,
        },
        willChain: true,
      };
    }
    // Parallel: the prior clip won't exist yet, so we degrade to whatever
    // anchor the scene already has (matches useScenePipeline fallback order).
    const fallbackUrl = scene.refImageUrl || brief.refImageUrl || speaker?.imageUrl;
    if (!fallbackUrl) {
      return {
        start: { kind: "none", label: "None (pure T2V)", detail: "No anchor — engine improvises composition" },
        willChain: false,
        warning: "Continuous intent — parallel render has no tail frame and no fallback image. Chain will break.",
      };
    }
    const source: StartSource =
      scene.refImageUrl
        ? { kind: "sceneRef", label: "Scene reference", detail: "Per-scene image (chain degraded)", url: scene.refImageUrl }
        : brief.refImageUrl
          ? { kind: "briefRef", label: "Brief reference", detail: "Project ref image (chain degraded)", url: brief.refImageUrl }
          : { kind: "cast", label: "Cast portrait", detail: `${speaker?.name || "Cast"} headshot (chain degraded)`, url: speaker!.imageUrl };
    return {
      start: source,
      willChain: false,
      warning: "Continuous intent — parallel render falls back to a static reference. Frame continuity will drift.",
    };
  }

  // Independent: never chains. Use scene → cast → none.
  if (scene.refImageUrl) {
    return { start: { kind: "sceneRef", label: "Scene reference", detail: "Standalone shot from this image", url: scene.refImageUrl }, willChain: false };
  }
  if (speaker?.imageUrl) {
    return { start: { kind: "cast", label: "Cast portrait", detail: `${speaker.name} headshot`, url: speaker.imageUrl }, willChain: false };
  }
  return {
    start: { kind: "none", label: "None (pure T2V)", detail: "No anchor — engine improvises composition" },
    willChain: false,
    warning: "Independent scene with no anchor — identity/composition is unpredictable.",
  };
}

export interface ContinuitySimulatorProps {
  scenes: SceneDraft[];
  cast: CastMember[];
  brief: StudioBrief;
}

export function ContinuitySimulator({ scenes, cast, brief }: ContinuitySimulatorProps) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("sequential");

  const rows = useMemo<Row[]>(() => {
    return scenes.map((scene, i) => {
      const prev = i > 0 ? scenes[i - 1] : undefined;
      const chained = scene.chainFromPrevious !== false && !!prev;
      const { start, willChain, warning } = resolveStart(scene, prev, brief, cast, mode);
      return { scene, chained, willChain, start, warning };
    });
  }, [scenes, cast, brief, mode]);

  const counts = useMemo(() => {
    const chains = rows.filter(r => r.willChain).length;
    const breaks = rows.filter(r => !r.willChain && r.scene.index > 0).length;
    const warns = rows.filter(r => r.warning).length;
    return { chains, breaks, warns };
  }, [rows]);

  if (!scenes.length) return null;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-black/60 to-black/30 backdrop-blur-md">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Activity className="h-4 w-4 text-accent" />
          <span className="font-display text-sm text-white/90">Continuity simulator</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            {counts.chains} chain · {counts.breaks} break · {counts.warns} warn
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-white/40 transition-transform", open ? "rotate-180" : "")} />
        </button>

        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/40 p-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
          <ModeChip active={mode === "sequential"} onClick={() => setMode("sequential")} icon={<Layers className="h-3 w-3" />}>
            Sequential
          </ModeChip>
          <ModeChip active={mode === "parallel"} onClick={() => setMode("parallel")} icon={<Activity className="h-3 w-3" />}>
            Parallel
          </ModeChip>
        </div>
      </header>

      {open && (
        <>
          <div className="border-t border-white/[0.05] px-4 py-2.5 text-[11px] text-white/55">
            {mode === "sequential" ? (
              <>Render-all gates each continuous scene on its predecessor and extracts the tail frame before the next clip starts — chains hold.</>
            ) : (
              <>Firing all scenes at once skips the tail-frame extract — continuous intents fall back to the static reference chain (Scene ref → Brief ref → Cast portrait).</>
            )}
          </div>

          <ol className="divide-y divide-white/[0.05] px-2 pb-2">
            {rows.map((row, idx) => (
              <li key={row.scene.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-black/40 font-mono text-[10px] text-white/60">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {idx === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
                        Anchor
                      </span>
                    ) : row.chained ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]",
                        row.willChain
                          ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300"
                          : "border-amber-400/30 bg-amber-400/[0.08] text-amber-300",
                      )}>
                        <Link2 className="h-2.5 w-2.5" />
                        {row.willChain ? "Will chain" : "Chain breaks"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">
                        <Scissors className="h-2.5 w-2.5" />
                        Independent
                      </span>
                    )}
                    <span className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-white/65">
                      {row.scene.location || "EXT. UNTITLED"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <SourceBadge source={row.start} />
                    <span className="truncate text-white/45">{row.start.detail}</span>
                  </div>
                  {row.warning && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/[0.06] px-2 py-1 text-[10.5px] text-amber-300/90">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{row.warning}</span>
                    </div>
                  )}
                </div>

                {/* Preview thumb */}
                {"url" in row.start && row.start.url ? (
                  <img
                    src={row.start.url}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded-md border border-white/[0.08] object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-white/[0.08] text-white/30">
                    <ImageIcon className="h-3.5 w-3.5" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function ModeChip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
        active ? "bg-accent/20 text-accent" : "text-white/55 hover:text-white/80",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SourceBadge({ source }: { source: StartSource }) {
  const palette: Record<StartSource["kind"], string> = {
    tail:     "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300",
    sceneRef: "border-sky-400/30 bg-sky-400/[0.08] text-sky-300",
    briefRef: "border-indigo-400/30 bg-indigo-400/[0.08] text-indigo-300",
    cast:     "border-fuchsia-400/30 bg-fuchsia-400/[0.08] text-fuchsia-300",
    none:     "border-white/15 bg-white/[0.04] text-white/55",
  };
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em]",
      palette[source.kind],
    )}>
      {source.label}
    </span>
  );
}

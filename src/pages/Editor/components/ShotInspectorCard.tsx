/**
 * ShotInspectorCard — the ONE approval gate, made visible.
 *
 * Reads from the document-store + status-bus. Surfaces:
 *   - Identity + framing + duration
 *   - Engine + tier (with override picker)
 *   - Estimated credit cost
 *   - Sanity warnings (prompt empty, aspect mismatch, etc)
 *   - The big CTA: Approve & Render / Rendering / Re-render
 *   - Status pill + progress arc when a job is in flight
 *
 * The CTA is the single gate the user clicks before a shot reaches
 * an engine. No render happens without this.
 */
import { useMemo, useSyncExternalStore } from "react";
import {
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Film,
  Lock,
  XCircle,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import type { Shot, ScriptDocument, ModelEngine } from "@/lib/editor/script-document";
import { findShot } from "@/lib/editor/script-document";
import {
  getDocumentState,
  subscribeDocument,
  setShotApproval,
  setShotEngine,
} from "@/lib/editor/document-store";
import {
  getStatusBus,
  subscribeStatusBus,
  latestEventForShot,
  isShotRendering,
} from "@/lib/editor/generation/status-bus";
import {
  selectEngineForShot,
  shotSanity,
  type ShotSanityIssue,
} from "@/lib/editor/generation/pipeline";
import {
  MODEL_CATALOG,
  enginesForAspect,
} from "@/lib/editor/model-catalog";
import {
  isVfxShot,
  vfxRecipeSlugForShot,
} from "@/lib/editor/crossover-bridge";
import { toast } from "sonner";

interface Props {
  shotId: string;
  /** Called when the user clicks "Approve & Render" — the editor's
   *  runtime wires this to the orchestrator's enqueueShot. Kept as
   *  a prop so the inspector doesn't import the orchestrator
   *  directly (cleaner test surface). */
  onApproveAndRender: (shotId: string) => void;
}

export function ShotInspectorCard({ shotId, onApproveAndRender }: Props) {
  const docState = useSyncExternalStore(
    subscribeDocument,
    getDocumentState,
    getDocumentState,
  );
  // Re-subscribe to status events so we re-render on stage changes.
  useSyncExternalStore(subscribeStatusBus, getStatusBus, getStatusBus);

  const doc = docState.doc;
  const shot = useMemo(
    () => (doc ? findShot(doc, shotId) : null),
    [doc, shotId],
  );

  if (!doc || !shot) {
    return (
      <div className="px-5 py-8 text-center">
        <Sparkles className="h-5 w-5 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 tracking-[0.28em]")}>
          ◆ Shot
        </p>
        <p className="mt-2 text-[13px] text-foreground/65">
          Select a shot to approve or render it.
        </p>
      </div>
    );
  }

  const engine = selectEngineForShot(shot, doc);
  const engineRow = MODEL_CATALOG[engine];
  const sanityIssues = shotSanity(shot, doc);
  const event = latestEventForShot(shotId);
  const inFlight = isShotRendering(shotId);
  const vfx = isVfxShot(shot);
  const recipeSlug = vfxRecipeSlugForShot(shot);

  const eligibleEngines = enginesForAspect(doc.meta.aspectRatio);

  return (
    <div className="space-y-5">
      <header>
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] flex items-center gap-2")}>
          {vfx ? (
            <Wand2 className="h-3 w-3 text-amber-300" strokeWidth={1.5} />
          ) : (
            <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
          )}
          <span>◆ Shot</span>
          {vfx && recipeSlug && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-amber-200/85">{recipeSlug}</span>
            </>
          )}
        </div>
        <h3
          className="mt-1 font-display italic text-[18px] text-foreground/95 leading-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {shot.cameraDirection || `Shot ${shot.number}`}
        </h3>
        <p className={cn(TYPE_META, "mt-0.5 text-muted-foreground/55")}>
          {shot.framing} · {shot.durationSec.toFixed(1)}s · {engineRow.displayName}
        </p>
      </header>

      {/* Prompt preview */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] px-3.5 py-3">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em]")}>
          ◆ Prompt
        </div>
        <p
          className="mt-1 text-[13px] text-foreground/90 leading-snug whitespace-pre-wrap line-clamp-5"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {shot.modelPrompt || "(empty prompt)"}
        </p>
      </div>

      {/* Engine picker */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] px-3.5 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em]")}>
            ◆ Engine
          </div>
          {shot.engineOverride && (
            <button
              type="button"
              onClick={() => setShotEngine(shotId, null)}
              className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground/65 hover:text-foreground"
              title="Use document default engine"
            >
              Reset
            </button>
          )}
        </div>
        <select
          value={engine}
          onChange={(e) => setShotEngine(shotId, e.target.value as ModelEngine)}
          disabled={inFlight}
          className={cn(
            "block w-full h-8 rounded-md px-2",
            "bg-white/[0.02] text-foreground text-[12.5px]",
            "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {eligibleEngines.map((row) => (
            <option
              key={row.engine}
              value={row.engine}
              className="bg-[hsl(220_30%_6%)]"
            >
              {row.displayName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground/65 leading-snug">
          {engineRow.tagline}
        </p>
      </div>

      {/* Cost preview */}
      <div className="rounded-xl ring-1 ring-inset ring-accent/25 bg-[hsl(var(--accent)/0.05)] px-3.5 py-3 flex items-center gap-3">
        <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-foreground/90 font-mono tabular-nums">
            {shot.cost.credits} credits
          </p>
          <p className="text-[10.5px] text-muted-foreground/65 font-mono uppercase tracking-[0.18em]">
            {engineRow.displayName} · {doc.capabilities.qualityTier} tier
          </p>
        </div>
      </div>

      {/* Sanity warnings */}
      {sanityIssues.length > 0 && (
        <div className="rounded-xl ring-1 ring-inset ring-amber-300/35 bg-amber-500/[0.06] px-3.5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" strokeWidth={1.5} />
            <p className={cn(TYPE_META, "text-amber-200/85 tracking-[0.24em]")}>
              ◆ Check
            </p>
          </div>
          <ul className="space-y-1">
            {sanityIssues.map((issue) => (
              <li key={issue} className="text-[12px] text-foreground/85 leading-snug">
                {sanityCopy(issue)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status — when something's in flight */}
      {event && (
        <div
          className={cn(
            "rounded-xl ring-1 ring-inset px-3.5 py-3",
            event.stage === "failed"
              ? "ring-rose-400/35 bg-rose-500/[0.06]"
              : event.stage === "completed"
              ? "ring-emerald-400/35 bg-emerald-500/[0.06]"
              : "ring-accent/30 bg-[hsl(var(--accent)/0.06)]",
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {event.stage === "failed" ? (
              <XCircle className="h-3.5 w-3.5 text-rose-300" strokeWidth={1.5} />
            ) : event.stage === "completed" ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" strokeWidth={1.5} />
            ) : (
              <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" strokeWidth={1.5} />
            )}
            <p className={cn(TYPE_META, "tracking-[0.24em]", event.stage === "failed" ? "text-rose-200/85" : event.stage === "completed" ? "text-emerald-200/85" : "text-foreground/85")}>
              ◆ {event.stage.replace("-", " ")}
            </p>
            {typeof event.progress === "number" && event.stage !== "completed" && event.stage !== "failed" && (
              <span className="ml-auto text-[11px] font-mono tabular-nums text-foreground/75">
                {Math.round(event.progress * 100)}%
              </span>
            )}
          </div>
          <p className="text-[12px] text-foreground/85 leading-snug">{event.message}</p>
          {/* Progress bar */}
          {typeof event.progress === "number" && event.stage !== "completed" && event.stage !== "failed" && (
            <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent/60 transition-[width] duration-300"
                style={{ width: `${Math.min(100, event.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* The gate */}
      <ApprovalGateCta
        shot={shot}
        inFlight={inFlight}
        sanityIssues={sanityIssues}
        onApproveAndRender={onApproveAndRender}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalGateCta — the big shape-shifting button
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalGateCta({
  shot,
  inFlight,
  sanityIssues,
  onApproveAndRender,
}: {
  shot: Shot;
  inFlight: boolean;
  sanityIssues: ShotSanityIssue[];
  onApproveAndRender: (shotId: string) => void;
}) {
  const blocking = sanityIssues.some(
    (i) =>
      i === "no-prompt" ||
      i === "engine-aspect-mismatch" ||
      i === "engine-duration-too-long" ||
      i === "engine-duration-too-short",
  );

  // Status === completed → "Re-render" (the safe path)
  if (shot.approval.state === "completed" && !inFlight) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onApproveAndRender(shot.id)}
          disabled={blocking}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full",
            "text-[12px] font-mono uppercase tracking-[0.18em] transition-colors",
            "bg-white/[0.03] text-foreground/85 ring-1 ring-inset ring-white/[0.06]",
            "hover:bg-white/[0.07]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          <span>Re-render</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShotApproval(shot.id, "draft", { reason: "User unlocked" });
            toast.message("Unlocked — edit beats freely now.");
          }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-full",
            "text-[12px] font-mono uppercase tracking-[0.18em] transition-colors",
            "bg-emerald-500/[0.18] text-emerald-200 ring-1 ring-inset ring-emerald-400/40",
            "hover:bg-emerald-500/[0.28]",
          )}
        >
          <Lock className="h-3 w-3" strokeWidth={1.8} />
          <span>Locked</span>
        </button>
      </div>
    );
  }

  // In flight → spinner button
  if (inFlight) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 h-10 rounded-full",
          "text-[12.5px] font-mono uppercase tracking-[0.22em]",
          "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/35",
          "opacity-90 cursor-not-allowed",
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
        <span>Rendering…</span>
      </button>
    );
  }

  // Needs regen → "Approve & Re-render"
  if (shot.approval.state === "needs-regen") {
    return (
      <button
        type="button"
        onClick={() => onApproveAndRender(shot.id)}
        disabled={blocking}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 h-10 rounded-full",
          "text-[12.5px] font-mono uppercase tracking-[0.22em] transition-colors",
          "bg-amber-500/[0.18] text-amber-200 ring-1 ring-inset ring-amber-400/40",
          "hover:bg-amber-500/[0.28]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Approve & Re-render</span>
      </button>
    );
  }

  // Failed → "Retry"
  if (shot.approval.state === "failed") {
    return (
      <button
        type="button"
        onClick={() => onApproveAndRender(shot.id)}
        disabled={blocking}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 h-10 rounded-full",
          "text-[12.5px] font-mono uppercase tracking-[0.22em] transition-colors",
          "bg-rose-500/[0.14] text-rose-200 ring-1 ring-inset ring-rose-400/40",
          "hover:bg-rose-500/[0.22]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Retry generation</span>
      </button>
    );
  }

  // Draft / ready → "Approve & Render" (the canonical gate)
  return (
    <button
      type="button"
      onClick={() => onApproveAndRender(shot.id)}
      disabled={blocking}
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 h-10 rounded-full",
        "text-[13px] font-display italic transition-colors",
        "bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40",
        "hover:bg-[hsl(var(--accent)/0.22)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      <Film className="h-3.5 w-3.5" strokeWidth={1.5} />
      <span>Approve & Render</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanity copy
// ─────────────────────────────────────────────────────────────────────────────

function sanityCopy(issue: ShotSanityIssue): string {
  switch (issue) {
    case "no-prompt":
      return "Prompt is empty. Write the camera direction + subject + action before rendering.";
    case "engine-aspect-mismatch":
      return "This engine doesn't support the project's aspect ratio. Pick a different engine or change the project aspect.";
    case "engine-duration-too-long":
      return "Duration is longer than this engine can render in one shot. Split or shorten.";
    case "engine-duration-too-short":
      return "Duration is below this engine's minimum. Increase to at least the minimum.";
    case "missing-character-anchor":
      return "Beats mention characters but no character anchors exist. Add Characters to lock identity across shots.";
    case "vfx-recipe-but-not-vfx-engine":
      return "This shot has a VFX recipe but isn't routed through the VFX engine. Switch to ComfyUI · Local.";
    default:
      return issue;
  }
}

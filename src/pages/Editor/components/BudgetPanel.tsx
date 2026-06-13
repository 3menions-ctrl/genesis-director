/**
 * BudgetPanel — generation cost preview.
 *
 * Reads the ScriptDocument. Walks every scene's shots. Surfaces:
 *   - Project total credits (potential + already-committed)
 *   - Per-scene breakdown (clip count, sum, average shot length)
 *   - Per-shot row with engine, duration, credits, approval state
 *
 * The user opens this BEFORE approving shots so they see the
 * committed cost — supports informed approval. Trigger: Cmd+B
 * (budget) + chip in the top status bar.
 */
import { useSyncExternalStore } from "react";
import { Sparkles, ShieldCheck, Loader2, Lock, AlertOctagon, FilmIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import {
  Surface,
  SurfaceHeader,
  SurfaceBody,
  SurfaceFooter,
  SurfaceKbdHint,
} from "./Surface";
import {
  getDocumentState,
  subscribeDocument,
} from "@/lib/editor/document-store";
import {
  flatShots,
  totalCommittedCredits,
  totalPotentialCredits,
} from "@/lib/editor/script-document";
import { getEngine } from "@/lib/editor/model-catalog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BudgetPanel({ open, onClose }: Props) {
  const docState = useSyncExternalStore(
    subscribeDocument,
    getDocumentState,
    getDocumentState,
  );
  const doc = docState.doc;

  return (
    <Surface open={open} onClose={onClose} size="lg" labelledBy="budget-title">
      <SurfaceHeader
        id="budget-title"
        eyebrow="◆ Budget"
        title={
          doc
            ? `${totalPotentialCredits(doc).toLocaleString()} credits if everything renders`
            : "Open a project to see its budget."
        }
        description="The cost of generating every shot in this document at the current engines + tiers. Committed credits are already burning; the rest awaits your approval."
        onClose={onClose}
      />
      <SurfaceBody>
        {!doc ? (
          <p className={cn(TYPE_META, "text-center text-muted-foreground/55 py-10")}>
            ◆ No document loaded
          </p>
        ) : flatShots(doc).length === 0 ? (
          <div className="text-center py-12">
            <FilmIcon className="h-7 w-7 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-4 font-display italic text-[16px] text-foreground/75"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No shots yet — this document is empty.
            </p>
          </div>
        ) : (
          <>
            <BudgetSummary doc={doc} />
            <div className="mt-8 space-y-6">
              {doc.scenes.map((scene) => (
                <SceneBudget key={scene.id} scene={scene} />
              ))}
            </div>
          </>
        )}
      </SurfaceBody>
      <SurfaceFooter>
        <span className="flex items-center gap-2">
          <SurfaceKbdHint keys="⌘B" label="budget" />
          <span aria-hidden>·</span>
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
        {doc && (
          <span>
            {flatShots(doc).length} {flatShots(doc).length === 1 ? "shot" : "shots"} · {doc.scenes.length} {doc.scenes.length === 1 ? "scene" : "scenes"}
          </span>
        )}
      </SurfaceFooter>
    </Surface>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary header — totals at a glance
// ─────────────────────────────────────────────────────────────────────────────

function BudgetSummary({
  doc,
}: {
  doc: ReturnType<typeof getDocumentState>["doc"];
}) {
  if (!doc) return null;
  const committed = totalCommittedCredits(doc);
  const potential = totalPotentialCredits(doc);
  const remaining = potential - committed;

  return (
    <div className="grid grid-cols-3 gap-3">
      <SummaryCard
        label="Total potential"
        value={potential}
        accent="accent"
        sub="if every shot rendered at current engine"
      />
      <SummaryCard
        label="Committed"
        value={committed}
        accent="emerald"
        sub={`${doc.scenes.flatMap((s) => s.shots).filter((sh) => sh.approval.state !== "draft").length} shots approved`}
      />
      <SummaryCard
        label="Awaiting approval"
        value={remaining}
        accent="amber"
        sub={`${doc.scenes.flatMap((s) => s.shots).filter((sh) => sh.approval.state === "draft").length} shots in draft`}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number;
  accent: "accent" | "emerald" | "amber";
  sub: string;
}) {
  const ring =
    accent === "accent"
      ? "ring-accent/35 bg-[hsl(var(--accent)/0.06)]"
      : accent === "emerald"
      ? "ring-emerald-400/35 bg-emerald-500/[0.05]"
      : "ring-amber-400/35 bg-amber-500/[0.05]";
  const tone =
    accent === "accent"
      ? "text-accent"
      : accent === "emerald"
      ? "text-emerald-300"
      : "text-amber-200";

  return (
    <div className={cn("rounded-xl ring-1 ring-inset px-4 py-3", ring)}>
      <p className={cn(TYPE_META, "tracking-[0.24em] text-muted-foreground/65")}>
        ◆ {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display italic text-[26px] font-light tracking-tight leading-none tabular-nums",
          tone,
        )}
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground/65 leading-snug">
        {sub}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneBudget — one scene's shots
// ─────────────────────────────────────────────────────────────────────────────

function SceneBudget({
  scene,
}: {
  scene: import("@/lib/editor/script-document").Scene;
}) {
  if (scene.shots.length === 0) return null;
  const total = scene.shots.reduce((s, sh) => s + sh.cost.credits, 0);
  const committed = scene.shots
    .filter((sh) => sh.approval.state !== "draft")
    .reduce((s, sh) => s + sh.cost.credits, 0);

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-3 px-2">
        <div className="min-w-0">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
            ◆ Scene {String(scene.number).padStart(2, "0")}
          </div>
          <p
            className="mt-0.5 font-display italic text-[15px] text-foreground/90 truncate"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {scene.slug}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono tabular-nums text-[14px] text-foreground/90">
            {total.toLocaleString()} cr
          </p>
          <p className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em]")}>
            {committed.toLocaleString()} committed
          </p>
        </div>
      </header>
      <ul className="space-y-1.5">
        {scene.shots.map((sh) => (
          <ShotRow key={sh.id} shot={sh} />
        ))}
      </ul>
    </section>
  );
}

function ShotRow({ shot }: { shot: import("@/lib/editor/script-document").Shot }) {
  const engineRow = getEngine(shot.cost.computedFor.engine);
  const stateLabel = shot.approval.state;
  const stateIcon =
    stateLabel === "completed" ? (
      <ShieldCheck className="h-3 w-3 text-emerald-300" strokeWidth={1.5} />
    ) : stateLabel === "rendering" ? (
      <Loader2 className="h-3 w-3 text-accent animate-spin" strokeWidth={1.5} />
    ) : stateLabel === "needs-regen" ? (
      <Loader2 className="h-3 w-3 text-amber-300" strokeWidth={1.5} />
    ) : stateLabel === "ready" ? (
      <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
    ) : stateLabel === "failed" ? (
      <AlertOctagon className="h-3 w-3 text-rose-300" strokeWidth={1.5} />
    ) : (
      <Lock className="h-3 w-3 text-muted-foreground/55" strokeWidth={1.5} />
    );

  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded-md hover:bg-white/[0.02] transition-colors">
      <span className="text-[13px] text-foreground/85 truncate font-display italic" style={{ fontFamily: "'Fraunces', serif" }}>
        Shot {String(shot.number).padStart(2, "0")}
        <span className="ml-2 text-muted-foreground/60 not-italic font-mono text-[11px] uppercase tracking-[0.14em]">
          {shot.framing}
        </span>
      </span>
      <span className={cn(TYPE_META, "text-muted-foreground/60 font-mono tabular-nums")}>
        {shot.durationSec.toFixed(1)}s
      </span>
      <span className={cn(TYPE_META, "text-muted-foreground/60 font-mono tracking-[0.14em] truncate max-w-[140px]")} title={engineRow.displayName}>
        {engineRow.displayName}
      </span>
      <span className="inline-flex items-center gap-2 justify-end min-w-[100px]">
        {stateIcon}
        <span className="font-mono tabular-nums text-[12.5px] text-foreground/90">
          {shot.cost.credits.toLocaleString()}
        </span>
      </span>
    </li>
  );
}

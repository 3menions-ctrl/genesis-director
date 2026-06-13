/**
 * Storyboard — scene cards, drag-to-reorder, beat-sheet overlay.
 *
 * Each scene is a card with thumbnail + index + title + time-of-day +
 * mood + clip count. Drag-and-drop reorders scenes (framer-motion's
 * Reorder.Group for the magnetic feel + auto-renumber). A subtle
 * beat-sheet overlay groups scenes by act_number when the project
 * carries one.
 */
import { useEffect, useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useReducedMotion,
} from "framer-motion";
import { Film, Sparkles, GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject, EditorScene } from "@/lib/editor/types";
import { selectScene, moveScene, setPlayhead } from "@/lib/editor/store";

interface Props {
  project: EditorProject;
  selectedSceneId: string | null;
  /** Opens the CreatePanel in the editor's shell so the user can
   *  generate the new scene without leaving the storyboard. */
  onOpenCreate?: () => void;
  /** When a scene card is clicked we also tell the shell to switch
   *  back to edit mode so the user immediately sees the scene
   *  playing in Stage. Storyboard is "look at the film" view;
   *  selecting a scene is the act of saying "now let's work on
   *  this one." */
  onLeaveToEdit?: () => void;
}

/**
 * Anchor a scene click to a concrete playhead position. The
 * storyboard is conceptually scene-first, but every action that
 * moves the user (clicking a card) needs to read in Stage too —
 * so we set the playhead to the scene's first clip's start.
 */
function jumpToScene(scene: EditorScene): void {
  selectScene(scene.id);
  const firstClip = scene.clips.find((c) => c.kind !== "title");
  if (firstClip) setPlayhead(firstClip.timelineStartSec);
}

export function Storyboard({
  project,
  selectedSceneId,
  onOpenCreate,
  onLeaveToEdit,
}: Props) {
  const reducedMotion = useReducedMotion();
  const scenes = project.scenes;

  // Optimistic order driven by framer-motion's Reorder.
  const [localOrder, setLocalOrder] = useState<EditorScene[]>(scenes);
  useEffect(() => {
    setLocalOrder(scenes);
  }, [scenes]);

  const onReorder = (next: EditorScene[]) => {
    setLocalOrder(next);
    for (let i = 0; i < next.length; i++) {
      if (next[i].id !== scenes[i]?.id) {
        moveScene(next[i].id, i);
        return;
      }
    }
  };

  // Group scenes by act_number for the beat-sheet overlay. If no
  // acts are set, all scenes group under a synthetic "act 1".
  const acts = useMemo(() => {
    const map = new Map<number, EditorScene[]>();
    for (const s of localOrder) {
      const act = s.actNumber ?? 1;
      const list = map.get(act) ?? [];
      list.push(s);
      map.set(act, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [localOrder]);

  return (
    <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-[1180px] py-8 pb-24">
        <header className="flex items-end justify-between flex-wrap gap-3 mb-7">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
              <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
              <span>◆ Storyboard</span>
            </div>
            <h2
              className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}.
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {scenes.length > 1 && (
              <p className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.30em]")}>
                drag a card to reorder
              </p>
            )}
            {onOpenCreate && (
              <button
                type="button"
                onClick={onOpenCreate}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                  "text-[12px] font-mono uppercase tracking-[0.18em]",
                  "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/35",
                  "hover:bg-[hsl(var(--accent)/0.20)] transition-colors",
                )}
                title="Add a scene to this film (N)"
              >
                <Plus className="h-3 w-3" strokeWidth={1.8} />
                <span>Add scene</span>
              </button>
            )}
          </div>
        </header>

        {scenes.length === 0 ? (
          <div className="py-16 text-center">
            <Film className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No scenes yet.
            </p>
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
              Press N or click "Add scene" above to generate the first one inline
            </p>
            {onOpenCreate && (
              <button
                type="button"
                onClick={onOpenCreate}
                className={cn(
                  "mt-7 inline-flex items-center gap-2 px-4 h-9 rounded-full",
                  "bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40",
                  "text-[13px] font-display italic",
                  "hover:bg-[hsl(var(--accent)/0.22)] transition-colors",
                )}
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span>Generate the first scene</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {acts.length > 1 ? (
              // Multi-act layout: each act gets a floating eyebrow
              acts.map(([act, sceneList]) => (
                <ActSection
                  key={act}
                  act={act}
                  scenes={sceneList}
                  allScenes={localOrder}
                  selectedSceneId={selectedSceneId}
                  onReorder={onReorder}
                  reducedMotion={reducedMotion ?? false}
                  onLeaveToEdit={onLeaveToEdit}
                />
              ))
            ) : (
              <Reorder.Group
                axis="y"
                values={localOrder}
                onReorder={onReorder}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10"
                as="ul"
              >
                <AnimatePresence initial={false}>
                  {localOrder.map((s) => (
                    <SceneCard
                      key={s.id}
                      scene={s}
                      isActive={s.id === selectedSceneId}
                      reducedMotion={reducedMotion ?? false}
                      onLeaveToEdit={onLeaveToEdit}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </div>
        )}

        <p className={cn(TYPE_META, "mt-16 text-muted-foreground/40 tracking-[0.30em] text-center")}>
          ◆ Beat-sheet templates · pacing analyzer · coming next
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActSection — beat-sheet overlay group
// ─────────────────────────────────────────────────────────────────────────────
function ActSection({
  act,
  scenes,
  allScenes,
  selectedSceneId,
  onReorder,
  reducedMotion,
  onLeaveToEdit,
}: {
  act: number;
  scenes: EditorScene[];
  allScenes: EditorScene[];
  selectedSceneId: string | null;
  onReorder: (next: EditorScene[]) => void;
  reducedMotion: boolean;
  onLeaveToEdit?: () => void;
}) {
  // Reorder inside an act = reorder among allScenes with the act's
  // scenes shifted around. For v1 we constrain reorders to within
  // the act for simplicity.
  const handleReorder = (newActOrder: EditorScene[]) => {
    const next = [...allScenes];
    const actIds = new Set(scenes.map((s) => s.id));
    // Replace each "slot" that was an act scene with the new order
    let cursor = 0;
    for (let i = 0; i < next.length; i++) {
      if (actIds.has(next[i].id)) {
        next[i] = newActOrder[cursor++];
      }
    }
    onReorder(next);
  };

  return (
    <section>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-5")}>
        ◆ Act {act} · {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
      </div>
      <Reorder.Group
        axis="y"
        values={scenes}
        onReorder={handleReorder}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10"
        as="ul"
      >
        <AnimatePresence initial={false}>
          {scenes.map((s) => (
            <SceneCard
              key={s.id}
              scene={s}
              isActive={s.id === selectedSceneId}
              reducedMotion={reducedMotion}
              onLeaveToEdit={onLeaveToEdit}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneCard — single draggable scene
// ─────────────────────────────────────────────────────────────────────────────
function SceneCard({
  scene,
  isActive,
  reducedMotion,
  onLeaveToEdit,
}: {
  scene: EditorScene;
  isActive: boolean;
  reducedMotion: boolean;
  onLeaveToEdit?: () => void;
}) {
  const cover = scene.clips[0]?.thumbnailUrl ?? null;
  return (
    <Reorder.Item
      value={scene}
      as="li"
      whileDrag={{ scale: 1.02, zIndex: 5 }}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.36, ease: EASE_PREMIUM }}
      >
        <button
          type="button"
          onClick={() => {
            jumpToScene(scene);
            onLeaveToEdit?.();
          }}
          className="group/scene block w-full text-left transition-transform duration-300 hover:-translate-y-0.5"
        >
          {/* Thumbnail frame — content, not chrome */}
          <div
            className={cn(
              "relative aspect-[16/9] overflow-hidden rounded-lg bg-[hsl(220_30%_8%)]",
              "ring-1 transition-all",
              isActive
                ? "ring-accent/85"
                : "ring-white/[0.06] group-hover/scene:ring-white/[0.18]",
            )}
          >
            {cover ? (
              <img
                src={cover}
                alt=""
                className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover/scene:scale-[1.04]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.4} />
              </div>
            )}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.90)] via-transparent to-transparent"
            />
            <div className="absolute top-2 left-2">
              <span className={cn(
                TYPE_META,
                "font-mono tabular-nums tracking-[0.28em] mix-blend-difference",
                isActive ? "text-accent" : "text-foreground/70",
              )}>
                SCENE {String(scene.number).padStart(2, "0")}
              </span>
            </div>
            {scene.isKeyScene && (
              <div className="absolute top-2 right-2">
                <span
                  className={cn(
                    TYPE_META,
                    "px-1.5 py-0.5 rounded font-mono tracking-[0.22em]",
                    "bg-accent/85 text-[hsl(220_30%_4%)]",
                  )}
                >
                  KEY
                </span>
              </div>
            )}
            {/* Document-aware badges — VFX marker + per-scene approval
                state aggregate. Reads via the SceneDocBadges helper
                that subscribes to the document store. */}
            <SceneDocBadges sceneId={scene.id} />
            {/* Drag grip — only on hover */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover/scene:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4 text-foreground/65 mix-blend-difference" strokeWidth={1.5} />
            </div>
          </div>

          {/* Floating typography below */}
          <div className="mt-3 px-0.5">
            <h3
              className="font-display italic text-[18px] font-light tracking-tight text-foreground/95 truncate"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {scene.title}
            </h3>
            <div className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-3")}>
              {scene.timeOfDay && <span>{scene.timeOfDay}</span>}
              {scene.timeOfDay && scene.mood && <span className="text-muted-foreground/40">·</span>}
              {scene.mood && <span>{scene.mood}</span>}
              <span className="ml-auto font-mono tabular-nums">
                {scene.clips.length} {scene.clips.length === 1 ? "clip" : "clips"}
              </span>
            </div>
          </div>
        </button>
      </motion.div>
    </Reorder.Item>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneDocBadges — reads the document store to surface VFX + scene
// approval state on every Storyboard card.
//
// Approval aggregate:
//   all completed  → emerald check chip
//   any rendering  → amber spinner
//   any ready      → accent sparkle
//   any failed     → rose alert
//   all draft      → no chip (cards stay clean for un-started scenes)
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore as useSyncExternalStoreForStoryboard } from "react";
import {
  getDocumentState as getDocStateForStoryboard,
  subscribeDocument as subDocForStoryboard,
} from "@/lib/editor/document-store";
import { isVfxScene as isVfxSceneFn } from "@/lib/editor/crossover-bridge";
import {
  Wand2 as Wand2ForStoryboard,
  Loader2 as Loader2ForStoryboard,
  Check as CheckForStoryboard,
  AlertTriangle as AlertForStoryboard,
  Sparkles as SparklesForStoryboard,
} from "lucide-react";

function SceneDocBadges({ sceneId }: { sceneId: string }) {
  const docState = useSyncExternalStoreForStoryboard(
    subDocForStoryboard,
    getDocStateForStoryboard,
    getDocStateForStoryboard,
  );
  const doc = docState.doc;
  if (!doc) return null;
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;

  const isVfx = isVfxSceneFn(scene);
  const shots = scene.shots;
  const stateChip = (() => {
    if (shots.length === 0) return null;
    const states = shots.map((sh) => sh.approval.state);
    if (states.some((s) => s === "failed")) {
      return { icon: <AlertForStoryboard className="h-2.5 w-2.5" strokeWidth={1.8} />, tone: "bg-rose-500/[0.24] ring-rose-400/55", title: "Failed shot in scene" };
    }
    if (states.some((s) => s === "rendering")) {
      return { icon: <Loader2ForStoryboard className="h-2.5 w-2.5 animate-spin" strokeWidth={1.8} />, tone: "bg-amber-500/[0.24] ring-amber-400/55", title: "Rendering" };
    }
    if (states.every((s) => s === "completed")) {
      return { icon: <CheckForStoryboard className="h-2.5 w-2.5" strokeWidth={2} />, tone: "bg-emerald-500/[0.24] ring-emerald-400/55", title: "All shots completed" };
    }
    if (states.some((s) => s === "ready")) {
      return { icon: <SparklesForStoryboard className="h-2.5 w-2.5" strokeWidth={1.8} />, tone: "bg-[hsl(var(--accent)/0.22)] ring-accent/55", title: "Approved — awaiting render" };
    }
    return null; // all draft → no chip
  })();

  if (!isVfx && !stateChip) return null;

  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
      {isVfx && (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 h-5 rounded",
            "text-[9.5px] font-mono uppercase tracking-[0.14em]",
            "bg-amber-500/[0.20] text-amber-200 ring-1 ring-inset ring-amber-400/45",
          )}
          title="VFX recipe shot in this scene"
        >
          <Wand2ForStoryboard className="h-2.5 w-2.5" strokeWidth={1.8} />
          <span>VFX</span>
        </span>
      )}
      {stateChip && (
        <span
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-full",
            "ring-1 ring-inset",
            stateChip.tone,
          )}
          title={stateChip.title}
        >
          <span className="text-foreground">{stateChip.icon}</span>
        </span>
      )}
    </div>
  );
}

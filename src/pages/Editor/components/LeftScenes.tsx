/**
 * LeftScenes — persistent left rail of scene cards.
 *
 * Compact vertical list (~240px wide). Each scene = thumbnail + title
 * + clip count. Click selects the scene + jumps the playhead to its
 * first clip's timelineStartSec. Currently-selected scene rings
 * accent. The full storyboard grid view is now a focus mode reached
 * via the toolbar; the rail keeps the user oriented while editing.
 */
import { Film, GripVertical } from "lucide-react";
import { motion, AnimatePresence, Reorder, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject, EditorScene } from "@/lib/editor/types";
import { moveScene, selectScene, setPlayhead } from "@/lib/editor/store";

interface Props {
  project: EditorProject;
  selectedSceneId: string | null;
}

export function LeftScenes({ project, selectedSceneId }: Props) {
  const reducedMotion = useReducedMotion();
  const scenes = project.scenes;

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

  const onPickScene = (s: EditorScene) => {
    selectScene(s.id);
    const firstClip = s.clips[0];
    if (firstClip) setPlayhead(firstClip.timelineStartSec);
  };

  return (
    <aside
      aria-label="Scenes"
      className="shrink-0 w-[240px] border-r border-white/[0.04] flex flex-col bg-[hsl(220_30%_4%/0.35)]"
    >
      <header className="shrink-0 px-4 pt-4 pb-3">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
          <Film className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Scenes</span>
        </div>
        <h2
          className="mt-1.5 font-display italic text-[15.5px] font-light tracking-tight text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}.
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-3">
        {scenes.length === 0 ? (
          <p className={cn(TYPE_META, "text-muted-foreground/55 px-2 pt-2")}>
            No scenes — render a project in Studio.
          </p>
        ) : (
          <Reorder.Group
            axis="y"
            values={localOrder}
            onReorder={onReorder}
            className="space-y-1.5"
            as="ul"
          >
            <AnimatePresence initial={false}>
              {localOrder.map((s) => (
                <SceneRow
                  key={s.id}
                  scene={s}
                  isActive={s.id === selectedSceneId}
                  onClick={() => onPickScene(s)}
                  reducedMotion={reducedMotion ?? false}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>
    </aside>
  );
}

function SceneRow({
  scene,
  isActive,
  onClick,
  reducedMotion,
}: {
  scene: EditorScene;
  isActive: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const cover = scene.clips[0]?.thumbnailUrl ?? null;
  return (
    <Reorder.Item
      value={scene}
      as="li"
      whileDrag={{ scale: 1.02, zIndex: 5 }}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <motion.button
        type="button"
        onClick={onClick}
        initial={reducedMotion ? false : { opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE_PREMIUM }}
        className={cn(
          "group/scene relative w-full flex items-stretch gap-2.5 p-1.5 rounded-md text-left transition-colors",
          isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
        )}
      >
        {/* Thumbnail */}
        <div
          className={cn(
            "shrink-0 relative w-[60px] aspect-video overflow-hidden rounded-sm bg-[hsl(220_30%_8%)]",
            "ring-1 transition-all",
            isActive ? "ring-accent/85" : "ring-white/[0.06] group-hover/scene:ring-white/[0.16]",
          )}
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="h-3 w-3 text-muted-foreground/40" strokeWidth={1.4} />
            </div>
          )}
          <span
            className={cn(
              "absolute top-0.5 left-1 font-mono text-[9px] tabular-nums tracking-[0.18em] mix-blend-difference",
              isActive ? "text-accent" : "text-foreground/70",
            )}
          >
            {String(scene.number).padStart(2, "0")}
          </span>
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1 py-0.5">
          <div
            className="font-display italic text-[12.5px] leading-tight font-light text-foreground/95 truncate"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {scene.title}
          </div>
          <div className={cn(TYPE_META, "mt-0.5 text-muted-foreground/50 flex items-center gap-1.5")}>
            {scene.timeOfDay && <span className="truncate">{scene.timeOfDay}</span>}
            <span className="ml-auto font-mono tabular-nums">
              {scene.clips.length}
            </span>
          </div>
        </div>

        {/* Drag grip — only on hover */}
        <GripVertical
          className="absolute top-1/2 -translate-y-1/2 right-0.5 h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/scene:opacity-100 transition-opacity"
          strokeWidth={1.5}
        />
      </motion.button>
    </Reorder.Item>
  );
}

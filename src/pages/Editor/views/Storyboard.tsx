/**
 * Storyboard — scene-card view. For v1 first commit, surfaces each
 * scene as a floating card with its title + thumbnail. Drag-to-reorder
 * + beat-sheet overlay land in the next commit.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Film, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";
import { selectScene } from "@/lib/editor/store";

interface Props {
  project: EditorProject;
  selectedSceneId: string | null;
}

export function Storyboard({ project, selectedSceneId }: Props) {
  const reducedMotion = useReducedMotion();
  return (
    <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-[1180px] py-8 pb-24">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2 mb-6")}>
          <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Storyboard</span>
        </div>

        {project.scenes.length === 0 ? (
          <div className="py-16 text-center">
            <Film className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No scenes yet.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {project.scenes.map((s, i) => {
              const active = s.id === selectedSceneId;
              const cover = s.clips[0]?.thumbnailUrl ?? null;
              return (
                <motion.li
                  key={s.id}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.42,
                    ease: EASE_PREMIUM,
                    delay: 0.04 + i * 0.04,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => selectScene(s.id)}
                    className={cn(
                      "group/scene block w-full text-left",
                      "transition-transform duration-300 hover:-translate-y-0.5",
                    )}
                  >
                    {/* Thumbnail frame — content, not chrome */}
                    <div
                      className={cn(
                        "relative aspect-[16/9] overflow-hidden rounded-lg bg-[hsl(220_30%_8%)]",
                        "ring-1 transition-all",
                        active
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
                          active ? "text-accent" : "text-foreground/70",
                        )}>
                          SCENE {String(s.number).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    {/* Floating typography below */}
                    <div className="mt-3 px-0.5">
                      <h3
                        className="font-display italic text-[18px] font-light tracking-tight text-foreground/95 truncate"
                        style={{ fontFamily: "'Fraunces', serif" }}
                      >
                        {s.title}
                      </h3>
                      <div className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-3")}>
                        {s.timeOfDay && <span>{s.timeOfDay}</span>}
                        {s.mood && <span className="text-muted-foreground/40">·</span>}
                        {s.mood && <span>{s.mood}</span>}
                        <span className="ml-auto font-mono tabular-nums">
                          {s.clips.length} {s.clips.length === 1 ? "clip" : "clips"}
                        </span>
                      </div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}

        <p className={cn(TYPE_META, "mt-16 text-muted-foreground/40 tracking-[0.32em] text-center")}>
          ◆ Drag to reorder · beat-sheet overlay · coming next
        </p>
      </div>
    </section>
  );
}

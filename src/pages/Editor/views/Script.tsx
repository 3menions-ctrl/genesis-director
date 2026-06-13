/**
 * Script — Descript-style text-as-edit placeholder. Next commit:
 * delete-a-word-trims-a-clip + AI re-record on changed lines.
 *
 * For v1 we surface the project's existing script_content so the
 * director sees their screenplay floating on the canvas, ready to
 * be edited when the wiring lands.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";

interface Props {
  project: EditorProject;
}

export function Script({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const script = project.scriptContent?.trim() ?? "";
  return (
    <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
        className="mx-auto max-w-[760px] py-10 pb-24"
      >
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2 mb-3")}>
          <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Script</span>
        </div>

        {script ? (
          <article
            className="font-display italic font-light text-foreground/85 whitespace-pre-wrap leading-[1.6]"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)",
            }}
          >
            {script}
          </article>
        ) : (
          <div className="py-16 text-center">
            <p
              className="font-display italic text-[22px] font-light text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No script yet.
            </p>
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
              Generate a script in Studio first — it will appear here, fully editable
            </p>
          </div>
        )}

        <p className={cn(TYPE_META, "mt-12 text-muted-foreground/40 tracking-[0.32em] text-center")}>
          ◆ Editing tied to AI re-record · coming next
        </p>
      </motion.div>
    </section>
  );
}

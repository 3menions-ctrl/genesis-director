/**
 * ViewSwitcher — the 1/2/3/4 view picker.
 *
 * Floats over the top-center of the Editor. Each view chip uses the
 * same underline-on-active pattern the LeftRail uses (gradient pen
 * stroke that slides between selections via layoutId). Pure typography
 * — no card backdrops, no chips. Cinematic.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import type { EditorView } from "@/lib/editor/types";

const VIEWS: Array<{ id: EditorView; label: string; key: string }> = [
  { id: "stage", label: "Stage", key: "1" },
  { id: "timeline", label: "Timeline", key: "2" },
  { id: "script", label: "Script", key: "3" },
  { id: "storyboard", label: "Storyboard", key: "4" },
];

interface Props {
  view: EditorView;
  onChange: (view: EditorView) => void;
}

export function ViewSwitcher({ view, onChange }: Props) {
  return (
    <nav
      aria-label="Editor views"
      className="flex items-center gap-7"
    >
      {VIEWS.map((v) => {
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              "group/v relative flex items-center gap-2 transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground/65 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums tracking-[0.32em] transition-colors",
                active ? "text-accent/85" : "text-muted-foreground/40",
              )}
            >
              {v.key}
            </span>
            <span className="relative inline-block text-[13px] tracking-tight">
              {v.label}
              {active && (
                <motion.span
                  layoutId="editor-view-bar"
                  className="pointer-events-none absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-accent via-accent to-accent/30"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                  }}
                />
              )}
            </span>
            {!active && (
              <span className={cn(TYPE_META, "text-muted-foreground/30 hidden md:inline")}>
                {/* spacer for symmetry — keeps the rhythm even if mono changes */}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

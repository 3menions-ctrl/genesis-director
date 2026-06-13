/**
 * VideoEditor — rebuild placeholder.
 *
 * The previous Editor (Twick Studio wrapper + ~22 panels + 444 lines
 * of CSS overrides) has been destroyed. The replacement is being
 * designed from first principles: four views (Stage / Timeline /
 * Script / Storyboard), AI as a first-class collaborator, versions-
 * not-undo, magnetic timeline with beat snap, Smart Reframe, real-
 * time multiplayer, Cmd+K palette consistent with the rest of the
 * app. Web-first; Tauri desktop ships in v2.
 *
 * Underlying schema (movie_projects, shot_takes, genesis_scenes,
 * etc.) and the AI edge functions are preserved — only the surface
 * was wiped. Existing renders can still be managed from /studio and
 * /library while the new editor is built.
 */
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Film, Scissors, Wand2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

const PILLARS: Array<{ label: string; sub: string; Icon: typeof Film }> = [
  { label: "Stage", sub: "Full-bleed cinematic player — your film while you make it", Icon: Film },
  { label: "Timeline", sub: "Magnetic, ripple-by-default, beat & scene snap, multicam, speed ramps", Icon: Scissors },
  { label: "Script", sub: "Every line editable; delete a word, the clip trims; AI re-voices for free", Icon: Layers },
  { label: "AI inline", sub: "Regenerate, continue, outpaint, inpaint, style-match — keyboard summoned", Icon: Wand2 },
];

export default function VideoEditor() {
  usePageMeta({
    title: "Editor — being rebuilt — Small Bridges",
    description:
      "The Small Bridges Editor is being rebuilt from first principles. Web-first now, Tauri desktop next. Existing renders still live in Studio + Library.",
  });

  const { id } = useParams<{ id?: string }>();
  const reducedMotion = useReducedMotion();

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1100px] px-6 pt-24 pb-32 sm:px-10 lg:px-12">
        {/* Eyebrow */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM }}
          className={cn(
            TYPE_META,
            "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2",
          )}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span>◆ Cutting room · rebuild in progress</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_PREMIUM, delay: 0.08 }}
          className="mt-6 font-display italic font-light tracking-tight leading-[0.95]"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(2.8rem, 6vw, 5.4rem)",
            textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
          }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/55 bg-clip-text text-transparent">
            The editor is being rebuilt.
          </span>
        </motion.h1>

        {/* Lead */}
        <motion.p
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_PREMIUM, delay: 0.16 }}
          className="mt-7 max-w-[640px] text-[clamp(1.05rem,1.45vw,1.2rem)] leading-[1.55] font-light text-foreground/75 italic font-display"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Designed from first principles. AI as a first-class collaborator,
          not a sidebar widget. Versions, not undo. Magnetic timeline.
          Script-as-edit. Web first; native desktop next.
        </motion.p>

        {/* Project-context note when arriving via /editor/:id */}
        {id && (
          <motion.p
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.24 }}
            className={cn(TYPE_META, "mt-6 text-muted-foreground/55")}
          >
            Looking for project{" "}
            <span className="font-mono text-foreground/75">{id.slice(0, 8)}</span>?
            Your renders, clips, and takes are still safe — review and
            re-render them from{" "}
            <Link
              to={`/studio?project=${id}`}
              className="relative text-accent group/p"
            >
              <span className="relative">
                Studio
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/p:scale-x-100"
                />
              </span>
            </Link>{" "}
            or browse them in your{" "}
            <Link
              to="/library"
              className="relative text-accent group/l"
            >
              <span className="relative">
                Library
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/l:scale-x-100"
                />
              </span>
            </Link>
            .
          </motion.p>
        )}

        {/* CTAs — floating */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.28 }}
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3"
        >
          <Link
            to="/studio"
            className="group/cta inline-flex items-center gap-2 text-[14.5px] text-accent"
          >
            <Film className="h-4 w-4" strokeWidth={1.5} />
            <span className="relative">
              Continue in Studio
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent to-accent/40 transition-transform duration-500 ease-out group-hover/cta:scale-x-100"
              />
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
          <Link
            to="/library"
            className="group/lib inline-flex items-center gap-2 text-[14.5px] text-foreground/80 hover:text-foreground transition-colors"
          >
            <span className="relative">
              Browse Library
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-foreground/80 to-transparent transition-transform duration-500 ease-out group-hover/lib:scale-x-100"
              />
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover/lib:translate-x-0.5 group-hover/lib:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </motion.div>

        {/* What's coming — four pillars, floating */}
        <motion.section
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_PREMIUM, delay: 0.36 }}
          className="mt-24"
        >
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
            ◆ What's coming
          </div>
          <h2
            className="mt-2 font-display italic font-light tracking-tight leading-[1.0]"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Four ways to look at one film.
            </span>
          </h2>
          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
            {PILLARS.map((p, i) => (
              <motion.li
                key={p.label}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  ease: EASE_PREMIUM,
                  delay: 0.44 + i * 0.05,
                }}
              >
                <div className="flex items-center gap-2">
                  <p.Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  <span className={cn(TYPE_META, "text-muted-foreground/60 tracking-[0.30em]")}>
                    {p.label}
                  </span>
                </div>
                <p className="mt-3 text-[15px] leading-[1.5] font-light text-foreground/80">
                  {p.sub}
                </p>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* Footnote */}
        <motion.p
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.7 }}
          className={cn(TYPE_META, "mt-20 text-muted-foreground/35 tracking-[0.30em]")}
        >
          Schema, renders, edge functions all preserved · only the surface was wiped
        </motion.p>
      </div>
    </FoundationShell>
  );
}

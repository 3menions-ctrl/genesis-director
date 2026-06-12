/**
 * StudioHero — the cinematic hero header used across Small Bridges consumer pages.
 *
 * Same identity language as /create: a small "live" ping eyebrow, a giant
 * display title with a gradient italic accent, a muted subtitle, and an
 * optional mono status strip on the right. Below the title is a hairline
 * separator and an optional row for tabs / metadata.
 *
 *   <StudioHero
 *     eyebrow="Small Bridges · Lobby"
 *     title="Watch"
 *     accent="now."
 *     subtitle="Cinematic AI reels, programmed for tonight."
 *     status={['Engine', 'Render', 'Stream']}
 *   >
 *     <StudioTabs … />
 *   </StudioHero>
 */
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Wand2 } from "lucide-react";

interface Props {
  eyebrow: string;
  title: string;
  accent?: string;
  subtitle?: string;
  status?: string[];
  children?: ReactNode;
  /** Right-aligned label below the hairline, beside the tab row. */
  subhead?: ReactNode;
}

export function StudioHero({
  eyebrow, title, accent, subtitle, status = ["Engine", "Render", "Stream"], children, subhead,
}: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10 sm:mb-14"
    >
      {/* Live ping + eyebrow */}
      <div className="flex items-center gap-2 mb-5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground font-medium">
          {eyebrow}
        </span>
      </div>

      <div className="flex items-end justify-between gap-8 flex-wrap">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.035em] font-medium">
            <span className="text-foreground/95">{title}</span>
            {accent && (
              <>
                {" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg, hsl(212 100% 70%) 0%, hsl(190 100% 70%) 45%, hsl(212 100% 85%) 100%)",
                  }}
                >
                  {accent}
                </span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="text-base sm:text-lg text-muted-foreground mt-5 leading-relaxed font-light max-w-xl">
              {subtitle}
            </p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 text-[10px] uppercase tracking-[0.32em] text-foreground/80 font-medium">
          <span className="inline-flex items-center gap-2 mr-1">
            <Wand2 className="w-3.5 h-3.5 text-primary/80" />
            Director Mode
          </span>
          {status.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span
                className="w-1 h-1 rounded-full bg-[hsl(var(--primary))]"
                style={{ animation: `studioTick 2.4s ease-in-out ${i * 0.4}s infinite` }}
              />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Hairline */}
      <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />

      {(children || subhead) && (
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>{children}</div>
          {subhead && (
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {subhead}
            </div>
          )}
        </div>
      )}
    </motion.header>
  );
}

export default StudioHero;

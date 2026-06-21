/**
 * BeforeAfter — "From a line to a finished scene." ONE container, split: the
 * PROMPT (the words) on the left, the finished FILM on the right. It auto-
 * shuffles through the whole gallery — each change slides a new prompt in on the
 * left and wipes the new film in on the right (an accent line sweeping across:
 * the sentence becoming the scene). A thumbnail rail lets you jump between clips.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { GALLERY } from "./assets";
import { FILMS } from "@/data/filmsLibrary";
import { Glass, Eyebrow, Reveal, ACCENT, EASE } from "./ui";

// pull a film clip from the library by title (falls back to first film)
const lib = (title: string) => (FILMS.find((f) => f.title === title) ?? FILMS[0]).clips[0];

interface Item { prompt: string; caption: string; genre: string; src: string }

const ITEMS: Item[] = [
  { prompt: "A winding coastal road at golden hour, top-down, endless horizon.", caption: "One sentence → a finished travel film.", genre: GALLERY[0].genre, src: GALLERY[0].src },
  { prompt: "Sunlight breaking through an untouched rainforest canopy.", caption: "A line of text, grown into a living jungle.", genre: GALLERY[1].genre, src: GALLERY[1].src },
  { prompt: "A drone sweep over a volcano erupting at dusk, ash and ember.", caption: "Words become an aerial spectacle.", genre: GALLERY[2].genre, src: GALLERY[2].src },
  { prompt: "A fog-drowned manor, candlelight flickering in empty halls.", caption: "A sentence, cut into noir.", genre: GALLERY[3].genre, src: GALLERY[3].src },
  { prompt: "A child's chocolate-factory dream, rivers of cocoa, candy clouds.", caption: "A daydream, rendered frame-perfect.", genre: GALLERY[4].genre, src: GALLERY[4].src },
  { prompt: "A lone knight kneeling in the ruins of a fallen citadel at dawn.", caption: "One line, an epic in widescreen.", genre: GALLERY[5].genre, src: GALLERY[5].src },
  { prompt: "A predator prowling tall savanna grass, golden light, slow motion.", caption: "Words stalk into the wild.", genre: GALLERY[6].genre, src: GALLERY[6].src },
  { prompt: "An empty city street after the storm, neon bleeding in the rain.", caption: "A sentence, soaked in mood.", genre: GALLERY[7].genre, src: GALLERY[7].src },
  { prompt: "A flower-crowned bunny in dungarees exploring a sunlit green park.", caption: "A character, born from one line.", genre: GALLERY[8].genre, src: GALLERY[8].src },
  { prompt: "A cheerful cartoon rabbit waves hello, golden morning light.", caption: "Your mascot, animated and lip-synced.", genre: GALLERY[9].genre, src: GALLERY[9].src },
  { prompt: "A man's hands press against the glass as reality tears open behind him.", caption: "A line of text, ripped into another world.", genre: "Sci-Fi", src: lib("Reality Rip") },
  { prompt: "Two figures square off on a rain-slicked rooftop, neon city below.", caption: "Words, staged into a standoff.", genre: "Action", src: lib("Epic Urban Showdown") },
  { prompt: "A knight crosses a moonlit courtyard to win her heart.", caption: "One sentence, turned romantic epic.", genre: "Romance", src: lib("Battle for Her Heart") },
  { prompt: "Candlelight flickers across endless shelves in a library of magic.", caption: "A daydream, shelved into a scene.", genre: "Fantasy", src: lib("Enchanted Library Chronicles") },
  { prompt: "A family sits down to dinner — and every one of them is undead.", caption: "A gag line, brought to (un)life.", genre: "Comedy", src: lib("Zombie Family Reunion") },
  { prompt: "A lone figure drifts through a cosmic void scattered with stars.", caption: "Words, whispered into the infinite.", genre: "Cosmic", src: lib("Whispers Of The Infinite") },
];

const HOLD_MS = 5200;

export function BeforeAfter() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const dir = useRef(1);

  const go = useCallback((next: number) => {
    dir.current = next > active || (active === ITEMS.length - 1 && next === 0) ? 1 : -1;
    setActive((next + ITEMS.length) % ITEMS.length);
  }, [active]);

  // auto-shuffle through the gallery
  useEffect(() => {
    if (reduced || paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % ITEMS.length), HOLD_MS);
    return () => clearInterval(id);
  }, [reduced, paused]);

  const it = ITEMS[active];

  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-28 sm:py-36">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>Before · After</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(2.2rem,5.6vw,3.9rem)] font-semibold tracking-[-0.03em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">From a line to a finished <span className="italic">scene</span>.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[17px] font-normal leading-relaxed text-white/70 sm:text-[18px]">Every frame below started as the words on the left. Watch the prompt become the film — and shuffle through the gallery.</p>
      </Reveal>

      <Reveal>
        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <Glass className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr]">
            {/* ── LEFT: the words ── */}
            <div className="flex flex-col justify-between gap-8 border-b border-white/[0.07] p-7 lg:border-b-0 lg:border-r lg:p-9">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: `hsl(${ACCENT})` }}>Prompt</span>
                  <span className="font-mono text-[10px] tracking-[0.15em] text-white/40">{String(active + 1).padStart(2, "0")} / {String(ITEMS.length).padStart(2, "0")}</span>
                </div>

                <div className="relative mt-4 min-h-[7.5em] sm:min-h-[6em] lg:min-h-[7.5em]">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={active}
                      initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduced ? undefined : { opacity: 0, y: -10, filter: "blur(6px)" }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="font-display text-[clamp(1.25rem,2.5vw,1.95rem)] font-light italic leading-snug text-white/90"
                    >
                      “{it.prompt}”
                      {!reduced && <span className="ml-1 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] animate-pulse" style={{ background: `hsl(${ACCENT})` }} />}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <p className="mt-5 text-[13.5px] font-light text-white/55">{it.caption}</p>
              </div>

              {/* thumbnail / shuffle rail */}
              <div>
                <div className="flex flex-wrap gap-2">
                  {ITEMS.map((t, i) => (
                    <button
                      key={t.src}
                      type="button"
                      onClick={() => go(i)}
                      className="group relative overflow-hidden rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] transition-colors"
                      style={{
                        color: i === active ? "#fff" : "rgba(255,255,255,0.5)",
                        background: i === active ? `hsl(${ACCENT} / 0.18)` : "rgba(255,255,255,0.04)",
                        boxShadow: i === active ? `inset 0 0 0 1px hsl(${ACCENT} / 0.6)` : "inset 0 0 0 1px rgba(255,255,255,0.07)",
                      }}
                    >
                      {t.genre}
                      {i === active && !reduced && !paused && (
                        <motion.span
                          key={`p${active}`}
                          aria-hidden
                          className="absolute bottom-0 left-0 h-[2px]"
                          style={{ background: `hsl(${ACCENT})` }}
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: HOLD_MS / 1000, ease: "linear" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: the film ── */}
            <div className="relative aspect-[16/10] bg-black lg:aspect-auto">
              <AnimatePresence>
                <motion.video
                  key={active}
                  src={it.src}
                  autoPlay muted loop playsInline preload="auto"
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={reduced ? { opacity: 1 } : { opacity: 0, clipPath: "inset(0 0 0 100%)" }}
                  animate={{ opacity: 1, clipPath: "inset(0 0 0 0%)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
                />
              </AnimatePresence>

              {/* accent wipe line synced to the reveal */}
              {!reduced && (
                <motion.div
                  key={`wipe${active}`}
                  aria-hidden
                  className="absolute bottom-0 top-0 z-10 w-[2px]"
                  style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 24px 2px hsl(${ACCENT} / 0.85)` }}
                  initial={{ left: "0%", opacity: 0 }}
                  animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.9, ease: EASE }}
                />
              )}

              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              {/* letterbox + slate */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-black/80" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[7%] bg-black/80" />
              <div className="absolute inset-x-4 top-[7%] flex items-center justify-between pt-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})` }} />
                  Result
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">{it.genre}</span>
              </div>
              <div className="absolute inset-x-5 bottom-[7%] flex items-end justify-between pb-2">
                <span className="font-display text-[15px] font-light text-white/90">Generated · 4K</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Small Bridges</span>
              </div>
            </div>
          </div>
        </Glass>
        </div>
      </Reveal>
    </section>
  );
}

/**
 * FilmsGallery (/films) — the full library of generated films. Browse all 58 as
 * a grid (hover to preview), click any to play full-screen — the lightbox chains
 * that film's clips in order, with prev/next to move through the library.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Play, X, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PLAYABLE_FILMS as FILMS } from "@/data/filmsLibrary";
import { Button, Eyebrow, ACCENT, EASE } from "@/components/cinema/ui";
import { BrandTile } from "@/components/cinema/Logo";

function FilmTile({ title, clips, onOpen }: { title: string; clips: string[]; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => ref.current?.pause()}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl transition-transform duration-300 hover:-translate-y-1"
    >
      <video ref={ref} src={clips[0]} muted loop playsInline preload="metadata" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent transition-opacity duration-300 group-hover:from-black/70" />
      <span aria-hidden className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
        <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3 text-left">
        <div className="truncate font-display text-[14px] font-medium text-white">{title}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{clips.length} clip{clips.length > 1 ? "s" : ""}</div>
      </div>
    </button>
  );
}

function Lightbox({ index, onClose, onPrev, onNext }: { index: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const film = FILMS[index];
  const [clip, setClip] = useState(0);
  useEffect(() => { setClip(0); }, [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onNext(); if (e.key === "ArrowLeft") onPrev(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/92 px-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white backdrop-blur-md transition-colors hover:bg-white/16"><X className="h-5 w-5" /></button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-white backdrop-blur-md transition-colors hover:bg-white/16 sm:flex"><ChevronLeft className="h-6 w-6" /></button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next" className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-white backdrop-blur-md transition-colors hover:bg-white/16 sm:flex"><ChevronRight className="h-6 w-6" /></button>

      <motion.div className="relative w-full max-w-5xl" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} onClick={(e) => e.stopPropagation()}>
        <video
          key={`${index}-${clip}`}
          src={film.clips[clip]}
          autoPlay
          playsInline
          controls
          className="w-full rounded-xl bg-black shadow-[0_60px_160px_-40px_rgba(0,0,0,0.95)]"
          onEnded={() => setClip((c) => (c + 1 < film.clips.length ? c + 1 : c))}
          onError={() => setClip((c) => (c + 1 < film.clips.length ? c + 1 : c))}
        />
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="font-display text-[20px] font-semibold text-white">{film.title}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Film {index + 1} / {FILMS.length} · clip {clip + 1} of {film.clips.length}</div>
          </div>
          {film.clips.length > 1 && (
            <div className="flex gap-1.5">
              {film.clips.map((_, i) => (
                <button key={i} type="button" onClick={() => setClip(i)} aria-label={`Clip ${i + 1}`} className="h-1.5 w-6 rounded-full transition-colors" style={{ background: i === clip ? `hsl(${ACCENT})` : "rgba(255,255,255,0.2)" }} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FilmsGallery() {
  usePageMeta({ title: "The Films — Small Bridges" });
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070809] text-white antialiased">
      <header className="sticky top-0 z-50 flex items-center justify-between bg-[#070809]/60 px-5 py-3 backdrop-blur-xl sm:px-8">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <BrandTile className="h-8 w-8" />
          <span className="font-display text-[16px] tracking-tight">Small <span className="font-semibold italic">Bridges</span></span>
        </button>
        <Button onClick={() => navigate("/studio")} className="px-5 py-2.5 text-[14px]">Open the editor <ArrowRight className="h-4 w-4" /></Button>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 pb-28 pt-16 sm:pt-20">
        <motion.div initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE }} className="mb-12 text-center">
          <Eyebrow>The library</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,6.5vw,4.8rem)] font-semibold tracking-[-0.03em]">Every film, one <span className="italic">sentence</span>.</h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] font-light text-white/60">{FILMS.length} films generated in the studio. Hover to preview, click to play.</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {FILMS.map((f, i) => (
            <motion.div key={f.id} initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-8%" }} transition={{ duration: 0.5, ease: EASE, delay: (i % 4) * 0.04 }}>
              <FilmTile title={f.title} clips={f.clips} onOpen={() => setActive(i)} />
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {active !== null && (
          <Lightbox
            index={active}
            onClose={() => setActive(null)}
            onPrev={() => setActive((a) => (a === null ? a : (a - 1 + FILMS.length) % FILMS.length))}
            onNext={() => setActive((a) => (a === null ? a : (a + 1) % FILMS.length))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

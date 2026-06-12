/**
 * The Hidden Room — /loft
 *
 * An unmarked door. Daily-generated cinematic installation. Never the
 * same twice — the seed is `userId × calendarDate`, so each visitor on
 * each day gets a unique piece of generative art.
 *
 * No nav entry. Discovery is word of mouth. The route's not in the
 * sitemap. Sometimes the best feature is the one most people never see.
 *
 * Today: a procedural noise + parallax piece with a poem composed from
 * a small lexicon. Later waves can swap the renderer for a MusicGen +
 * generative-video pipeline.
 */
import { useEffect, useMemo, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";

// Tiny deterministic PRNG so the same (userId, date) always renders the
// same piece. Keeps the "today's room" promise stable for 24 hours.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

// Lexicon — three columns. Cherry-pick one of each for the composed line.
const ATMOS = ["amber", "indigo", "graphite", "vermilion", "sodium", "pewter", "cobalt", "rose", "celadon", "obsidian"];
const VERBS = ["unfolds", "dilates", "smolders", "drifts", "settles", "breathes", "blooms", "tightens", "ripples", "kneels"];
const OBJECTS = ["the corridor", "the hour", "an empty stage", "the projector", "the cut", "the room", "the frame", "the last shot", "the curtain", "the pause"];

function poem(rand: () => number): string[] {
  const line = (a: string[], b: string[], c: string[]) =>
    `${pick(rand, a)} — ${pick(rand, b)} ${pick(rand, c)}.`;
  return [
    line(ATMOS, VERBS, OBJECTS),
    line(ATMOS, VERBS, OBJECTS),
    line(ATMOS, VERBS, OBJECTS),
  ];
}
function pick<T>(rand: () => number, arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }

export default function HiddenRoom() {
  usePageMeta({ title: "—" });
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const seed = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return hashString(`${user?.id ?? "anon"}:${date}`);
  }, [user?.id]);

  const lines = useMemo(() => poem(mulberry32(seed)), [seed]);
  const hue = useMemo(() => (seed % 360), [seed]);

  // Procedural noise canvas — a quiet, breathing background.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width  = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    const rand = mulberry32(seed);

    // Sparse star-field rendered once.
    ctx.fillStyle = `hsl(${hue}, 30%, 4%)`;
    ctx.fillRect(0, 0, w, h);
    const count = 280 + Math.floor(rand() * 220);
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = rand() * 1.5 + 0.3;
      const lum = 40 + rand() * 50;
      ctx.fillStyle = `hsla(${(hue + rand() * 60 - 30) | 0}, 70%, ${lum}%, ${0.4 + rand() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few soft glowing orbs that slowly drift.
    let raf = 0;
    const orbs = Array.from({ length: 3 }).map(() => ({
      x: rand() * w,
      y: rand() * h,
      r: 80 + rand() * 220,
      vx: (rand() - 0.5) * 0.3,
      vy: (rand() - 0.5) * 0.3,
      hue: (hue + rand() * 80 - 40) | 0,
    }));
    const draw = () => {
      // Redraw base (cheap)
      ctx.fillStyle = `hsla(${hue}, 30%, 4%, 0.18)`;
      ctx.fillRect(0, 0, w, h);
      for (const o of orbs) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -o.r) o.x = w + o.r;
        if (o.x > w + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = h + o.r;
        if (o.y > h + o.r) o.y = -o.r;
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grad.addColorStop(0, `hsla(${o.hue}, 80%, 60%, 0.12)`);
        grad.addColorStop(1, `hsla(${o.hue}, 80%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [seed, hue]);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} aria-hidden className="fixed inset-0 -z-10" />

      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="max-w-2xl text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/40 mb-8">
            no exit
          </div>
          {lines.map((l, i) => (
            <p
              key={i}
              className="font-display text-2xl md:text-4xl text-white/85 leading-tight mb-2"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              {l}
            </p>
          ))}
          <p className="mt-12 text-[10px] uppercase tracking-[0.24em] text-white/40">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}

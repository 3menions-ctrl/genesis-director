/**
 * ProjectAtlas — pinch-out 3D star-field view of every project a
 * Director has made. Click any star to dive back into the project.
 *
 * Pure CSS 3D — no WebGL — so it works on every device and stays under
 * 10 KB. Star positions are deterministic from the project id (so a
 * given project always appears in the same spot) and sized by recency
 * (newer = closer = brighter).
 *
 * Open/close: pass `open` prop, or wire to the `sb:atlas-open` /
 * `sb:atlas-close` window events for global trigger.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Project {
  id: string;
  title: string | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
}

interface StarLayout {
  id: string;
  title: string | null;
  x: number;
  y: number;
  z: number;
  size: number;
  hue: number;
  thumbnail_url: string | null;
}

function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return Math.abs(h);
}

function layout(projects: Project[]): StarLayout[] {
  const now = Date.now();
  return projects.map((p) => {
    const h = hashId(p.id);
    const angle = (h % 360) * (Math.PI / 180);
    const radius = 8 + ((h >> 8) % 92);            // 8..100
    const x = Math.cos(angle) * radius;            // -100..100
    const y = Math.sin(angle) * radius;
    const updatedAt = p.updated_at ? Date.parse(p.updated_at) : now;
    const ageDays = Math.max(0, (now - updatedAt) / (1000 * 60 * 60 * 24));
    const z = Math.min(1, 1 / (1 + ageDays / 30));  // recency → 0..1
    const size = 6 + z * 32;
    const hue = (h % 360);
    return { id: p.id, title: p.title, x, y, z, size, hue, thumbnail_url: p.thumbnail_url ?? null };
  });
}

export function ProjectAtlas({ open, onClose, projects }: Props) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<StarLayout | null>(null);
  const stars = layout(projects);

  // Esc closes; pinch / Cmd+Down opens via the global event.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Project atlas"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[55] overflow-hidden bg-black/95 backdrop-blur-xl"
          onWheel={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close atlas"
            className="absolute top-6 right-6 z-10 p-2 rounded-full bg-glass-active text-foreground/80 hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>

          <header className="absolute top-6 left-6 z-10">
            <div className="text-[10px] uppercase tracking-[0.24em] text-foreground/55">
              Atlas
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-foreground/55 mt-1">
              Click a star to open · Esc to close
            </div>
          </header>

          {/* The starfield, centered. CSS 3D for perspective. */}
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ perspective: "1200px" }}
          >
            <div
              className="relative w-[120vmin] h-[120vmin]"
              style={{ transformStyle: "preserve-3d", transform: "rotateX(8deg)" }}
            >
              {stars.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/production/${s.id}`)}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(null)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{
                    left: `${50 + s.x * 0.45}%`,
                    top:  `${50 + s.y * 0.45}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    background: s.thumbnail_url
                      ? `center / cover no-repeat url(${s.thumbnail_url})`
                      : `radial-gradient(circle, hsla(${s.hue}, 90%, 70%, 0.95), hsla(${s.hue}, 90%, 40%, 0.35))`,
                    boxShadow: `0 0 ${s.size * 0.8}px hsla(${s.hue}, 90%, 60%, ${0.4 + s.z * 0.4})`,
                    opacity: 0.5 + s.z * 0.5,
                    transform: `translate3d(0, 0, ${(s.z - 0.5) * 80}px)`,
                  }}
                  aria-label={s.title ?? "Untitled project"}
                />
              ))}
            </div>
          </div>

          {hover && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 max-w-[60vw] text-center"
              aria-live="polite"
            >
              <div className="text-xs uppercase tracking-[0.16em] text-foreground/55">Project</div>
              <div className="text-base text-foreground font-medium truncate">
                {hover.title ?? "Untitled project"}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * OnThisDayNudge — surfaces a project from this same calendar day in
 * a previous year, month, or week, with a one-click "remix it" CTA.
 *
 * Fires once per day per user (durable via localStorage so a hard
 * refresh doesn't re-nudge). Sits in the bottom-right corner; Esc or
 * the close button dismisses for the day.
 *
 * Picks the oldest matching project: 1y > 3mo > 1mo > 7d. If nothing
 * matches, renders nothing.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PastProject {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

const DISMISS_KEY = (uid: string) => `sb.onthisday.dismissed.${uid}.${new Date().toISOString().slice(0, 10)}`;

const WINDOWS: { label: string; daysBack: number; tolerance: number }[] = [
  { label: "a year ago today",   daysBack: 365, tolerance: 1 },
  { label: "three months ago",   daysBack: 90,  tolerance: 2 },
  { label: "a month ago",        daysBack: 30,  tolerance: 1 },
  { label: "a week ago",         daysBack: 7,   tolerance: 1 },
];

export function OnThisDayNudge() {
  const { user } = useAuth();
  const [project, setProject] = useState<PastProject | null>(null);
  const [label, setLabel] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(DISMISS_KEY(user.id))) return;
    } catch { /* localStorage blocked — proceed */ }

    let cancelled = false;
    (async () => {
      // Try each window; first that lands a project wins.
      for (const w of WINDOWS) {
        const target = new Date(Date.now() - w.daysBack * 86400 * 1000);
        const start = new Date(target); start.setDate(start.getDate() - w.tolerance);
        const end = new Date(target); end.setDate(end.getDate() + w.tolerance + 1);
        const { data } = await supabase
          .from("movie_projects")
          .select("id, title, thumbnail_url, created_at")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: true })
          .limit(1);
        if (cancelled) return;
        if (data && data.length > 0) {
          setProject(data[0] as PastProject);
          setLabel(w.label);
          setOpen(true);
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dismiss = () => {
    setOpen(false);
    if (user) {
      try { localStorage.setItem(DISMISS_KEY(user.id), "1"); } catch { /* noop */ }
    }
  };

  // Esc closes for today.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && project && (
        <motion.aside
          role="region"
          aria-label="On this day"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={[
            "fixed bottom-6 left-6 z-40",
            "w-[min(360px,calc(100vw-3rem))]",
            "rounded-2xl border border-glass-active bg-glass backdrop-blur-xl",
            "shadow-xl shadow-black/60 overflow-hidden",
          ].join(" ")}
        >
          <div className="flex">
            {project.thumbnail_url ? (
              <img src={project.thumbnail_url} alt="" className="w-24 h-24 object-cover" />
            ) : (
              <div className="w-24 h-24 bg-black/40" aria-hidden />
            )}
            <div className="flex-1 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary">
                <Clock className="w-3 h-3" aria-hidden />
                On this day · {label}
              </div>
              <div className="text-sm font-medium text-foreground mt-0.5 line-clamp-1">
                {project.title ?? "Untitled project"}
              </div>
              <Link
                to={`/production/${project.id}`}
                className="inline-flex items-center gap-1 mt-1 text-xs text-foreground/70 hover:text-foreground"
              >
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss for today"
              className="p-2 text-foreground/55 hover:text-foreground self-start"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

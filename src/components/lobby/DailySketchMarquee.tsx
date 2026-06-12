/**
 * DailySketchMarquee — Lobby hero strip showing today's prompt + top 10
 * community submissions. Click any submission to open the Theater for
 * that reel. Heart to vote.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Sparkles, ArrowRight } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MarqueeEntry {
  submission_id: string;
  reel_id: string | null;
  caption: string | null;
  votes: number;
  creator_id: string;
  is_featured: boolean;
}

interface Marquee {
  date: string;
  prompt: string;
  hint: string | null;
  top: MarqueeEntry[];
}

export function DailySketchMarquee() {
  const { user } = useAuth();
  const [data, setData] = useState<Marquee | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase.rpc("daily_sketch_marquee");
      if (!cancelled) setData(row as Marquee | null);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleVote = async (submissionId: string) => {
    if (!user) {
      toast.message("Sign in to vote on today's sketch.");
      return;
    }
    setVoted((s) => {
      const next = new Set(s);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        top: d.top.map((e) => e.submission_id === submissionId
          ? { ...e, votes: e.votes + (voted.has(submissionId) ? -1 : 1) }
          : e),
      };
    });
    const { error } = await supabase.rpc("toggle_daily_sketch_vote", { p_submission_id: submissionId });
    if (error) {
      toast.error("Couldn't register your vote. Try again.");
      // Roll back the optimistic flip.
      setVoted((s) => {
        const next = new Set(s);
        if (next.has(submissionId)) next.delete(submissionId);
        else next.add(submissionId);
        return next;
      });
    }
  };

  if (!data || !data.prompt) return null;

  return (
    <section className="relative rounded-3xl border border-glass bg-glass overflow-hidden p-6 mb-10">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.24em] font-semibold">
            Daily Sketch · {new Date(data.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        <Link
          to="/create?prompt=daily"
          className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground"
        >
          Take the prompt <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <p className="text-2xl md:text-3xl text-foreground leading-snug max-w-3xl font-display">
        {data.prompt}
      </p>
      {data.hint && (
        <p className="text-xs text-foreground/55 mt-2 max-w-2xl">{data.hint}</p>
      )}

      {data.top.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/45 mb-2">
            Top sketches
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {data.top.slice(0, 5).map((entry) => (
              <li key={entry.submission_id}>
                <div className="rounded-xl border border-glass bg-background/40 overflow-hidden">
                  {entry.reel_id ? (
                    <Link
                      to={`/watch/${entry.reel_id}`}
                      className="aspect-video bg-black/60 block hover:opacity-80 transition-opacity"
                      aria-label={`Watch sketch by ${entry.creator_id}`}
                    />
                  ) : (
                    <div className="aspect-video bg-black/60" />
                  )}
                  <div className="p-2 flex items-center justify-between gap-2">
                    {entry.caption ? (
                      <span className="text-[11px] text-foreground/70 line-clamp-1">{entry.caption}</span>
                    ) : (
                      <span className="text-[11px] text-foreground/40">(no caption)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleVote(entry.submission_id)}
                      className={
                        "inline-flex items-center gap-1 text-[11px] tabular-nums "
                        + (voted.has(entry.submission_id) ? "text-primary" : "text-foreground/55 hover:text-foreground")
                      }
                      aria-pressed={voted.has(entry.submission_id)}
                      aria-label={voted.has(entry.submission_id) ? "Remove vote" : "Vote for this sketch"}
                    >
                      <Heart className="w-3.5 h-3.5" fill={voted.has(entry.submission_id) ? "currentColor" : "none"} />
                      <AnimatedCounter value={entry.votes} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

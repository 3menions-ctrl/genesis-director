/**
 * SuggestedPeopleRail — small horizontal rail of creators whose interests
 * overlap with the signed-in viewer's. Renders nothing for anon visitors.
 *
 * Powered by a single PostgREST query against profiles_public + a Postgres
 * array-overlap filter (`interests=ov.{...}`).
 *
 * Click → /c/:id (full profile). Hover the avatar → quick follow CTA on
 * the profile page.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, MapPin, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface PersonRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  location: string | null;
  interests: string[];
}

export function SuggestedPeopleRail({ className }: { className?: string }) {
  const { user } = useAuth();
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1: read my own interests so we can find overlap.
  useEffect(() => {
    if (!user) {
      setMyInterests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interests")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const next = ((data as { interests?: string[] } | null)?.interests ?? []).filter(Boolean);
      setMyInterests(next);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Step 2: pull profiles_public where interests overlap. If I have no
  // interests yet, fall back to "people with any interests at all" so
  // the rail still teaches the feature instead of staying empty.
  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const overlap = myInterests.length > 0
          ? `interests.ov.{${myInterests.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`
          : null;
        let q = supabase
          .from("profiles_public" as never)
          .select("id, display_name, avatar_url, tagline, location, interests")
          .neq("id", user.id)
          .not("display_name", "is", null)
          .order("display_name", { ascending: true })
          .limit(12);
        if (overlap) q = q.or(overlap);
        const { data, error } = await q;
        if (cancelled) return;
        if (error) throw error;
        const list = ((data ?? []) as unknown as PersonRow[])
          .filter((r) => (r.interests?.length ?? 0) > 0)
          .slice(0, 8);
        setRows(list);
      } catch (e) {
        console.warn("[SuggestedPeopleRail] load failed", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, myInterests]);

  // Hide entirely when signed out or there's nothing meaningful to show.
  if (!user) return null;
  if (!loading && rows.length === 0) return null;

  return (
    <section className={cn("relative", className)}>
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-3.5 h-3.5 text-accent/85" strokeWidth={1.6} />
        <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/85">
          Suggested for you
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/55">
          {myInterests.length > 0 ? `shared interests · ${myInterests.slice(0, 3).join(", ")}` : "people to follow"}
        </span>
        <div className="ml-auto">
          <Link
            to="/search?tab=people"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            Browse all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="-mx-2 px-2 overflow-x-auto">
        <div className="flex gap-3 pb-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              to={`/c/${p.id}`}
              className="shrink-0 w-[260px] rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 p-4 transition-colors group/sug"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/[0.08] bg-glass-hover shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground/55 font-mono text-[12px]">
                      {(p.display_name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-foreground truncate font-light">
                    {p.display_name ?? "Anonymous"}
                  </div>
                  {p.location && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/65">
                      <MapPin className="w-2.5 h-2.5" />{p.location}
                    </div>
                  )}
                </div>
              </div>
              {p.tagline && (
                <p className="mt-2 text-[12px] italic text-muted-foreground/85 line-clamp-2 leading-snug">
                  {p.tagline}
                </p>
              )}
              {p.interests?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.interests.slice(0, 3).map((i) => {
                    const shared = myInterests.includes(i);
                    return (
                      <span
                        key={i}
                        className={cn(
                          "inline-block h-5 px-1.5 rounded-full text-[9.5px] font-mono uppercase tracking-[0.14em]",
                          shared
                            ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                            : "bg-white/[0.04] text-muted-foreground/75",
                        )}
                      >
                        {i}
                      </span>
                    );
                  })}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

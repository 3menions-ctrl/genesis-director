/**
 * BranchChoice — interactive narrative decision overlay.
 *
 * When a reel has branches, the Theater renders this component as a full-
 * frame overlay near the end of playback. Each branch shows the decision
 * text + the child reel's thumbnail. Viewers vote (which writes to
 * `reel_branch_votes` via the `vote_branch` RPC) and are auto-routed to
 * the highest-voted child after a short countdown.
 *
 * Behaviour rules:
 *   • Already-voted viewers see their pick highlighted and the leader.
 *   • Anonymous viewers can see the choices but voting routes them to /auth.
 *   • If no one votes within 8 seconds, the leader auto-plays so the page
 *     keeps moving (Netflix-style auto-advance).
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Branch {
  id: string;
  child_reel_id: string;
  decision_text: string;
  vote_count: number;
  child_title: string | null;
  child_thumbnail: string | null;
}

interface Props {
  branches: Branch[];
  /** Existing vote (matching `id` in branches), if the viewer has already voted. */
  myVote: string | null;
  open: boolean;
  onClose: () => void;
}

export function BranchChoice({ branches, myVote, open, onClose }: Props) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState<string | null>(myVote);
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map(branches.map((b) => [b.id, b.vote_count])));
  const [countdown, setCountdown] = useState<number | null>(null);

  // Reset internal state whenever branches change.
  useEffect(() => {
    setVoted(myVote);
    setCounts(new Map(branches.map((b) => [b.id, b.vote_count])));
  }, [branches, myVote]);

  // Auto-advance to the leader after 8s of inactivity.
  useEffect(() => {
    if (!open || voted) return;
    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown((c) => (c === null ? null : Math.max(0, c - 1)));
    }, 1000);
    const fire = setTimeout(() => {
      const leader = leadingBranch();
      if (leader) {
        navigate(`/watch/${leader.child_reel_id}`);
      }
    }, 8000);
    return () => { clearInterval(interval); clearTimeout(fire); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voted]);

  const total = useMemo(() => Array.from(counts.values()).reduce((a, b) => a + b, 0), [counts]);

  const leadingBranch = () => {
    let best: Branch | null = null;
    let bestVotes = -1;
    for (const b of branches) {
      const c = counts.get(b.id) ?? 0;
      if (c > bestVotes) { best = b; bestVotes = c; }
    }
    return best;
  };

  const vote = async (branch: Branch) => {
    if (!user) {
      toast.message("Sign in to vote on the path.");
      navigate("/auth");
      return;
    }
    if (voted === branch.id) return;
    setVoting(true);
    // Optimistic update.
    setCounts((prev) => {
      const next = new Map(prev);
      if (voted) next.set(voted, Math.max(0, (next.get(voted) ?? 0) - 1));
      next.set(branch.id, (next.get(branch.id) ?? 0) + 1);
      return next;
    });
    setVoted(branch.id);
    setCountdown(3);
    try {
      const { error } = await supabase.rpc("vote_branch" as never, { p_branch_id: branch.id } as never);
      if (error) throw error;
      // Pause then route.
      setTimeout(() => navigate(`/watch/${branch.child_reel_id}`), 1500);
    } catch (e) {
      // Roll back optimistic update on failure.
      setCounts((prev) => {
        const next = new Map(prev);
        next.set(branch.id, Math.max(0, (next.get(branch.id) ?? 0) - 1));
        return next;
      });
      setVoted(myVote);
      toast.error(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setVoting(false);
    }
  };

  if (!open || branches.length === 0) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/[0.10] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close branch choice"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative w-full max-w-[1100px] px-6 lg:px-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-[0.32em] text-primary/90">
                <Sparkles className="w-3 h-3" /> Choose what happens next
              </div>
              <h2
                className="font-display font-medium text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.05] tracking-[-0.02em] text-foreground"
              >
                The story branches.
              </h2>
              {countdown !== null && (
                <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  {voted ? `Routing in ${Math.max(0, countdown)}…` : `Top pick plays in ${Math.max(0, countdown)}…`}
                </p>
              )}
            </div>

            <div className={cn(
              "grid gap-4",
              branches.length === 2 ? "grid-cols-1 md:grid-cols-2"
              : branches.length === 3 ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-2 lg:grid-cols-4",
            )}>
              {branches.map((b) => {
                const c = counts.get(b.id) ?? 0;
                const pct = total === 0 ? 0 : Math.round((c / total) * 100);
                const isVoted = voted === b.id;
                return (
                  <motion.button
                    key={b.id}
                    onClick={() => vote(b)}
                    disabled={voting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "group relative rounded-2xl overflow-hidden border text-left transition-colors",
                      isVoted
                        ? "border-primary/60 ring-1 ring-primary/40"
                        : "border-white/[0.10] hover:border-white/30",
                    )}
                    style={isVoted ? {
                      boxShadow: "0 0 32px -8px hsla(215,100%,60%,0.45)",
                    } : undefined}
                  >
                    <div className="aspect-video relative bg-black/40">
                      {b.child_thumbnail ? (
                        <img src={b.child_thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/30">
                          <Sparkles className="w-7 h-7" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/55 mb-1.5">
                          If you choose…
                        </div>
                        <div className="text-[14px] font-light text-white leading-snug">{b.decision_text}</div>
                      </div>
                      {isVoted && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-mono uppercase tracking-[0.28em]">
                          Your pick
                        </div>
                      )}
                    </div>
                    {/* Vote bar */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1.5">
                        <span>{pct}%</span>
                        <span>{c.toLocaleString()} {c === 1 ? "vote" : "votes"}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isVoted
                              ? "linear-gradient(90deg, hsl(215 100% 60%), hsl(195 90% 65%))"
                              : "linear-gradient(90deg, hsla(215, 100%, 60%, 0.45), hsla(195, 90%, 65%, 0.45))",
                          }}
                        />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


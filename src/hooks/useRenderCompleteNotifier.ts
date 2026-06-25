/**
 * useRenderCompleteNotifier — global subscription that fires a toast
 * whenever any of the user's films transitions to a terminal "completed"
 * status. Mounted once inside FoundationShell so it runs on every
 * Foundation surface; pages don't have to opt-in individually.
 *
 * The notifier deduplicates by project id within the session so a
 * spurious double-fire from Postgres replication (or a mid-render
 * publish that flips status more than once) only surfaces once. It
 * also gates on "the row was previously seen in a non-terminal state"
 * — completion-on-first-load (e.g. the user navigates back to the app
 * after a render finished while they were away) does NOT toast,
 * because the Inbox covers that case and a toast would be stale.
 *
 * The toast itself uses sonner (the app-wide vocabulary) with an
 * action button that opens the matching reel. Subtitle includes the
 * title; styling stays default — the design system keeps it on-brand
 * via sonner's tailwind preset.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ACTIVE_STATUSES = new Set([
  "draft",
  "generating",
  "rendering",
  "stitching",
]);

const COMPLETED_STATUSES = new Set(["completed"]);

export function useRenderCompleteNotifier() {
  const { user } = useAuth();
  /** Last-seen status per project id. Lets us require an active→completed
   *  transition before firing — completion-on-first-load is silent. */
  const lastStatusRef = useRef<Map<string, string>>(new Map());
  /** Project ids we've already toasted this session, so a duplicate event
   *  from Postgres logical replication doesn't double-fire. */
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`render-complete:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "movie_projects",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as {
            id?: string;
            title?: string | null;
            status?: string;
          } | null;
          if (!next?.id || !next.status) return;

          const prevStatus = lastStatusRef.current.get(next.id);
          lastStatusRef.current.set(next.id, next.status);

          if (!COMPLETED_STATUSES.has(next.status)) {
            // Left the completed state (e.g. a re-render). Clear the fired flag
            // so a genuine future active→completed transition can notify again —
            // firedRef should only dedupe duplicate replication events for the
            // SAME completion, not suppress all future completions this session.
            firedRef.current.delete(next.id);
            return;
          }
          if (firedRef.current.has(next.id)) return;
          // Only toast on a genuine active→completed transition.
          if (!prevStatus || !ACTIVE_STATUSES.has(prevStatus)) return;

          firedRef.current.add(next.id);
          const title = next.title?.trim() || "Your film";
          toast.success("Render complete", {
            description: `${title} is ready to watch.`,
            duration: 8000,
            action: {
              label: "Play",
              onClick: () => {
                // Sonner's action handler is invoked outside React-Router
                // context, so we navigate via location rather than useNavigate.
                window.location.href = `/r/${next.id}`;
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
}

/**
 * usePresence — supabase realtime presence for the project.
 *
 * Tracks who's currently looking at this project. Returns the live
 * count; future expansion will surface avatars + cursor positions
 * on the timeline. For v1 we keep it minimal: a single number for
 * the "N people viewing" pill in the top bar.
 *
 * Joins the `presence-{projectId}` channel keyed by user_id, so two
 * tabs from the same person count as one. Channel is torn down on
 * unmount; supabase removes the presence row.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Presence {
  count: number;
  others: Array<{
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
}

export function usePresence(projectId: string | undefined): Presence {
  const { user, profile } = useAuth();
  const [state, setState] = useState<Presence>({ count: 1, others: [] });

  useEffect(() => {
    if (!projectId || !user) {
      setState({ count: 1, others: [] });
      return;
    }

    const channel = supabase.channel(`presence-${projectId}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const ps = channel.presenceState() as Record<
        string,
        Array<{ displayName?: string | null; avatarUrl?: string | null }>
      >;
      const ids = Object.keys(ps);
      const others = ids
        .filter((id) => id !== user.id)
        .map((id) => {
          const first = ps[id][0];
          return {
            userId: id,
            displayName: first?.displayName ?? null,
            avatarUrl: first?.avatarUrl ?? null,
          };
        });
      setState({ count: ids.length, others });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          joinedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, user, profile?.display_name, profile?.avatar_url]);

  return state;
}

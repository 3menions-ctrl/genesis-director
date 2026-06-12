/**
 * useReelPublisher — single hook surface for the publish_reel RPC.
 *
 * Any page that wants to push a project to the Lobby just calls
 * `await publish(projectId, { world, notes, tags })`. The RPC handles
 * permission, snapshotting, idempotency, and the audit row. We return
 * loading/error so the caller can render a button state.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PublishOptions {
  worldSlug?: string | null;
  directorNotes?: string | null;
  tags?: string[];
  /** When provided, the toast shows "Reel published in <world>". */
  toastWorldLabel?: string;
}

export function useReelPublisher() {
  const [publishing, setPublishing] = useState(false);
  const [lastReelId, setLastReelId] = useState<string | null>(null);

  const publish = useCallback(
    async (projectId: string, opts: PublishOptions = {}): Promise<string | null> => {
      setPublishing(true);
      try {
        const { data, error } = await supabase.rpc("publish_reel" as never, {
          p_project_id: projectId,
          p_world_slug: opts.worldSlug ?? null,
          p_director_notes: opts.directorNotes ?? null,
          p_tags: opts.tags ?? [],
        } as never);
        if (error) throw error;
        const out = data as unknown as { reel_id: string };
        setLastReelId(out.reel_id);
        toast.success(
          opts.toastWorldLabel
            ? `Reel published in ${opts.toastWorldLabel}`
            : "Reel published to the Lobby",
          {
            action: { label: "View", onClick: () => { window.location.href = `/watch/${out.reel_id}`; } },
          },
        );
        return out.reel_id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Publish failed";
        toast.error(msg);
        return null;
      } finally {
        setPublishing(false);
      }
    },
    [],
  );

  return { publish, publishing, lastReelId };
}

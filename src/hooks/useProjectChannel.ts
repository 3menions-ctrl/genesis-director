import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribes to realtime changes for a single project across `video_clips`
 * and `movie_projects`. One multiplexed channel per projectId.
 *
 * Polling elsewhere is retained as a 15s safety belt — this hook delivers
 * sub-second updates the moment the DB writes change.
 */
type ClipHandler = (clip: {
  shot_index: number;
  status: string | null;
  video_url: string | null;
  error_message: string | null;
}) => void;

type ProjectHandler = (project: Record<string, any>) => void;

export function useProjectChannel(
  projectId: string | null | undefined,
  handlers: { onClip?: ClipHandler; onProject?: ProjectHandler },
) {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!projectId) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    channel = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "video_clips", filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          if (cancelled) return;
          const row = (payload?.new ?? payload?.record) as any;
          if (!row) return;
          handlersRef.current.onClip?.({
            shot_index: row.shot_index,
            status: row.status ?? null,
            video_url: row.video_url ?? null,
            error_message: row.error_message ?? null,
          });
        },
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "movie_projects", filter: `id=eq.${projectId}` },
        (payload: any) => {
          if (cancelled) return;
          const row = (payload?.new ?? payload?.record) as any;
          if (row) handlersRef.current.onProject?.(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, [projectId]);
}
/**
 * useActiveProjects — live view of the user's in-progress films.
 *
 * Fetches every project whose status is generating / rendering /
 * stitching, then subscribes to Supabase realtime UPDATEs for that
 * user's rows so the UI ticks in lockstep with the pipeline. Used by
 * Library's ActiveRendersCard (Vercel-style dashboard at the top of
 * Your Films) and by the Foundation chrome timecode.
 *
 * The progress derivation mirrors Production.tsx so the two surfaces
 * never disagree about how close a render is to wrapping.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ACTIVE_STATUSES = ["generating", "rendering", "stitching"] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export interface ActiveProject {
  id: string;
  title: string;
  status: ActiveStatus;
  /** 0–100. Derived from pending_video_tasks.progress with sensible fallbacks. */
  progress: number;
  /** Short human-readable stage label (e.g. "Rendering", "Stitching scenes…"). */
  stage: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  thumbnail_url: string | null;
  video_url: string | null;
  pending_video_tasks: Record<string, unknown> | null;
  pipeline_state: Record<string, unknown> | string | null;
  created_at: string;
  updated_at: string;
}

const STAGE_LABEL: Record<string, string> = {
  generating: "Generating",
  rendering: "Rendering",
  stitching: "Stitching scenes",
};

function deriveProgress(row: ProjectRow): number {
  // Completed films sneak in as edge cases when status flips mid-fetch.
  if (row.video_url) return 100;
  if (row.status === "stitching_failed") return 90;
  const tasks = row.pending_video_tasks as { progress?: number } | null;
  const raw = tasks?.progress;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }
  // Reasonable defaults per stage so the bar isn't stuck at 0.
  if (row.status === "generating") return 12;
  if (row.status === "rendering") return 40;
  if (row.status === "stitching") return 80;
  return 0;
}

function deriveStage(row: ProjectRow): string {
  const tasks = row.pending_video_tasks as { stage?: string } | null;
  if (tasks?.stage && typeof tasks.stage === "string") return tasks.stage;
  return STAGE_LABEL[row.status] ?? "Working";
}

function mapRow(row: ProjectRow): ActiveProject {
  return {
    id: row.id,
    title: row.title ?? "Untitled film",
    status: row.status as ActiveStatus,
    progress: deriveProgress(row),
    stage: deriveStage(row),
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useActiveProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const refresh = useCallback(async () => {
    if (!userIdRef.current) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("movie_projects")
      .select(
        "id, user_id, title, status, thumbnail_url, video_url, pending_video_tasks, pipeline_state, created_at, updated_at",
      )
      .eq("user_id", userIdRef.current)
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .order("updated_at", { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[useActiveProjects] fetch failed", error);
      setProjects([]);
      setLoading(false);
      return;
    }
    setProjects(((data ?? []) as ProjectRow[]).map(mapRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  // Realtime subscription — drop / patch / insert rows as the pipeline
  // moves. Filtered to the current user so a busy server doesn't fan
  // every event into every session.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`active-projects:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movie_projects",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as ProjectRow | null;
          if (!row) return;
          setProjects((prev) => {
            const next = [...prev];
            const idx = next.findIndex((p) => p.id === row.id);
            const isActive =
              row.status &&
              (ACTIVE_STATUSES as unknown as string[]).includes(row.status);
            if (payload.eventType === "DELETE" || !isActive) {
              if (idx >= 0) next.splice(idx, 1);
              return next;
            }
            const mapped = mapRow(row);
            if (idx >= 0) next[idx] = mapped;
            else next.unshift(mapped);
            return next.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime(),
            );
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { projects, loading, refresh };
}

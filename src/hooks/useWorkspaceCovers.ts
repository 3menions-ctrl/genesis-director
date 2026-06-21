import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Recent production thumbnails for the active workspace, used as the rotating
 * cover imagery on every BusinessPage hero. Cached per-org for the session so
 * navigating between business pages doesn't refetch. Returns [] until loaded /
 * when the workspace has no media yet (callers fall back to the aurora cover).
 */
const cache = new Map<string, string[]>();

export function useWorkspaceCovers(): string[] {
  const { currentOrg } = useWorkspace();
  const orgId = currentOrg?.id ?? null;
  const [covers, setCovers] = useState<string[]>(() => (orgId && cache.get(orgId)) || []);

  useEffect(() => {
    if (!orgId) { setCovers([]); return; }
    const cached = cache.get(orgId);
    if (cached) { setCovers(cached); return; }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("movie_projects")
        .select("thumbnail_url")
        .eq("organization_id", orgId)
        .not("thumbnail_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      const urls = (data ?? [])
        .map((d) => (d as { thumbnail_url: string | null }).thumbnail_url)
        .filter((u): u is string => !!u);
      if (cancelled) return;
      cache.set(orgId, urls);
      setCovers(urls);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  return covers;
}

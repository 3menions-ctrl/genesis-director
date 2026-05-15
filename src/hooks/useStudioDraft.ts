import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_DRAFT, newScene, type StudioDraft } from "@/components/studio/v2/types";
import { engineToBackend } from "@/lib/video/engines";

const LS_KEY = "studio:v2:draft";

export function useStudioDraft() {
  const [draft, setDraft] = useState<StudioDraft>(EMPTY_DRAFT);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Load
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // anonymous fallback to localStorage
          const raw = localStorage.getItem(LS_KEY);
          if (raw) try { setDraft({ ...EMPTY_DRAFT, ...JSON.parse(raw) }); } catch {}
          setLoading(false); return;
        }
        const { data: rows } = await supabase
          .from("creation_canvases")
          .select("id,nodes")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (cancel) return;
        if (rows && rows[0]) {
          setCanvasId(rows[0].id);
          const stored = (rows[0].nodes as any);
          if (stored && stored.v === 2) setDraft(stored as StudioDraft);
        } else {
          const { data: created } = await supabase
            .from("creation_canvases")
            .insert({ user_id: user.id, name: "Studio", nodes: EMPTY_DRAFT as any, edges: [] })
            .select("id")
            .single();
          if (created && !cancel) setCanvasId(created.id);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const persist = useCallback((next: StudioDraft) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    if (!canvasId) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!mounted.current) return;
      setSaving(true);
      try {
        await supabase
          .from("creation_canvases")
          .update({ nodes: next as any, updated_at: new Date().toISOString() })
          .eq("id", canvasId);
      } finally {
        if (mounted.current) setSaving(false);
      }
    }, 600);
  }, [canvasId]);

  const update = useCallback((mut: (d: StudioDraft) => StudioDraft) => {
    setDraft(prev => {
      const next = mut(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  // Convenience mutators
  const addScene = useCallback(() => update(d => {
    const s = newScene(d.scenes.length);
    return { ...d, scenes: [...d.scenes, s], activeSceneId: s.id };
  }), [update]);

  const removeScene = useCallback((id: string) => update(d => ({
    ...d,
    scenes: d.scenes.filter(s => s.id !== id).map((s, i) => ({ ...s, index: i })),
    activeSceneId: d.activeSceneId === id ? undefined : d.activeSceneId,
  })), [update]);

  const patchScene = useCallback((id: string, patch: Partial<import("@/components/studio/v2/types").SceneDraft>) =>
    update(d => ({ ...d, scenes: d.scenes.map(s => s.id === id ? { ...s, ...patch } : s) })),
  [update]);

  const setActive = useCallback((id?: string) => update(d => ({ ...d, activeSceneId: id })), [update]);

  /**
   * Lazily ensure a `movie_projects` row exists for this draft and return its
   * id. Generation pipelines (`generate-single-clip`, `hollywood-pipeline`)
   * require a projectId; the engine lock, mutex, and credit accounting all
   * key off it. We create it on first render to avoid charging users for an
   * empty project.
   */
  const ensureProjectId = useCallback(async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in to start a render");

    const backendEngine = engineToBackend(draft.defaults.engine);
    const title = (draft.brief.title || "Untitled film").slice(0, 120);

    // 1. Already bound — keep the DB engine lock in sync with the live draft.
    // generate-single-clip treats movie_projects.video_engine as source of truth;
    // without this, switching Kling → Seedance after project creation silently
    // reverts renders back to the stale persisted engine.
    if (draft.projectId) {
      const { error } = await supabase
        .from("movie_projects")
        .update({
          title,
          video_engine: backendEngine,
          engine: draft.defaults.engine,
          aspect_ratio: draft.defaults.aspect,
          mode: draft.cast.length ? "avatar" : draft.brief.refImageUrl ? "image-to-video" : "text-to-video",
          synopsis: draft.brief.logline?.slice(0, 500) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.projectId);
      if (error) throw new Error(`Could not lock project to ${draft.defaults.engine}`);
      return draft.projectId;
    }

    const { data: row, error } = await supabase
      .from("movie_projects")
      .insert({
        user_id: user.id,
        title,
        video_engine: backendEngine,
        engine: draft.defaults.engine,
        aspect_ratio: draft.defaults.aspect,
        mode: draft.cast.length ? "avatar" : draft.brief.refImageUrl ? "image-to-video" : "text-to-video",
        status: "draft",
        synopsis: draft.brief.logline?.slice(0, 500) || null,
      })
      .select("id")
      .single();
    if (error || !row) throw error || new Error("Could not create project");

    update(d => ({ ...d, projectId: row.id }));
    return row.id;
  }, [draft.projectId, draft.defaults.engine, draft.defaults.aspect, draft.brief.title, draft.brief.logline, draft.brief.refImageUrl, draft.cast.length, update]);

  return { draft, setDraft: update, loading, saving, addScene, removeScene, patchScene, setActive, ensureProjectId };
}
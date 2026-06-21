import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CanvasGraph, CanvasNode, CanvasEdge } from '@/lib/canvas/types';

const DEFAULT_GRAPH: CanvasGraph = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

export function useCanvas() {
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [graph, setGraph] = useState<CanvasGraph>(DEFAULT_GRAPH);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load (or create) the user's active canvas.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: rows } = await supabase
        .from('creation_canvases')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (rows && rows.length) {
        const row = rows[0];
        setCanvasId(row.id);
        setGraph({
          nodes: (row.nodes as unknown as CanvasNode[]) ?? [],
          edges: (row.edges as unknown as CanvasEdge[]) ?? [],
          viewport: (row.viewport as any) ?? { x: 0, y: 0, zoom: 1 },
        });
      } else {
        const { data: created } = await supabase
          .from('creation_canvases')
          .insert({ user_id: user.id, name: 'New Canvas', nodes: [], edges: [] })
          .select()
          .single();
        if (created) setCanvasId(created.id);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced save.
  const persist = useCallback((next: CanvasGraph) => {
    if (!canvasId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      await supabase
        .from('creation_canvases')
        .update({
          nodes: next.nodes as any,
          edges: next.edges as any,
          viewport: next.viewport as any,
        })
        .eq('id', canvasId);
      setSaving(false);
    }, 600);
  }, [canvasId]);

  const updateGraph = useCallback((updater: (g: CanvasGraph) => CanvasGraph) => {
    setGraph((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  return { canvasId, graph, setGraph: updateGraph, loading, saving };
}
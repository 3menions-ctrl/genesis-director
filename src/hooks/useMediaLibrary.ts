import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MediaKind = 'image' | 'audio' | 'video';

export interface MediaAsset {
  id: string;
  user_id: string;
  project_id: string | null;
  media_type: MediaKind;
  asset_url: string;
  thumbnail_url: string | null;
  source: string | null;
  engine: string | null;
  generation_mode: string | null;
  prompt: string | null;
  title: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface Options {
  mediaType?: MediaKind | null;
  projectId?: string | null;
  limit?: number;
}

/**
 * Fetches the signed-in user's full media history (images, audio, video)
 * via the `get_user_media_library` RPC. RLS guarantees only the caller's
 * own rows are returned.
 */
export function useMediaLibrary(opts: Options = {}) {
  const { mediaType = null, projectId = null, limit = 200 } = opts;
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_user_media_library', {
        p_media_type: mediaType,
        p_project_id: projectId,
        p_limit: limit,
        p_offset: 0,
      });
      if (rpcErr) throw rpcErr;
      setAssets((data ?? []) as MediaAsset[]);
    } catch (e) {
      setError((e as Error).message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [mediaType, projectId, limit]);

  useEffect(() => { void refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const prev = assets;
    setAssets((a) => a.filter((x) => x.id !== id));
    const { error: delErr } = await supabase.from('user_media_assets').delete().eq('id', id);
    if (delErr) {
      setAssets(prev);
      throw delErr;
    }
  }, [assets]);

  const toggleFavorite = useCallback(async (asset: MediaAsset) => {
    const next = !asset.is_favorite;
    setAssets((a) => a.map((x) => x.id === asset.id ? { ...x, is_favorite: next } : x));
    await supabase.from('user_media_assets').update({ is_favorite: next }).eq('id', asset.id);
  }, []);

  return { assets, loading, error, refresh, remove, toggleFavorite };
}
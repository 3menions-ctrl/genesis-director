import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useSignedAsset
 * --------------
 * Resolves a private storage object into a time-limited signed URL.
 *
 * Use this for any bucket that is (or should be) `public:false`.
 * For public/distribution buckets (thumbnails, final-videos, avatars,
 * scene-images, video-thumbnails) keep using `getPublicUrl()` directly —
 * signing those is wasted overhead.
 *
 * @example
 *   const { url, loading } = useSignedAsset('user-uploads', `${userId}/poster.jpg`);
 */
export function useSignedAsset(
  bucket: string,
  path: string | null | undefined,
  expiresInSeconds = 3600,
) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error);
          setUrl(null);
        } else {
          setUrl(data?.signedUrl ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresInSeconds]);

  return { url, loading, error };
}

/**
 * Imperative variant for non-React contexts (loaders, exporters).
 */
export async function getSignedAssetUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn(`[useSignedAsset] sign failed for ${bucket}/${path}:`, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
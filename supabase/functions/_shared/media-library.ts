/**
 * Shared helper to record every generated asset (image, audio, video) into
 * the unified `user_media_assets` table so users can browse their full
 * media history in the UI.
 *
 * All fields except user_id, media_type, and asset_url are optional. The
 * underlying RPC is idempotent on (user_id, asset_url).
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type MediaKind = "image" | "audio" | "video";

export interface RecordMediaInput {
  userId: string;
  mediaType: MediaKind;
  assetUrl: string;
  projectId?: string | null;
  source?: string | null;
  engine?: string | null;
  generationMode?: string | null;
  prompt?: string | null;
  title?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
}

let cachedAdmin: SupabaseClient | null = null;
function admin(): SupabaseClient | null {
  if (cachedAdmin) return cachedAdmin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

/**
 * Best-effort: records the asset in the user's media library. Never throws —
 * a media-library failure must never break a generation pipeline.
 */
export async function recordUserMedia(
  input: RecordMediaInput,
  client?: SupabaseClient,
): Promise<string | null> {
  try {
    if (!input.userId || !input.assetUrl || !input.mediaType) return null;
    const sb = client ?? admin();
    if (!sb) return null;
    const { data, error } = await sb.rpc("record_user_media", {
      p_user_id: input.userId,
      p_media_type: input.mediaType,
      p_asset_url: input.assetUrl,
      p_project_id: input.projectId ?? null,
      p_source: input.source ?? null,
      p_engine: input.engine ?? null,
      p_generation_mode: input.generationMode ?? null,
      p_prompt: input.prompt?.slice(0, 4000) ?? null,
      p_title: input.title?.slice(0, 240) ?? null,
      p_thumbnail_url: input.thumbnailUrl ?? null,
      p_duration_seconds: input.durationSeconds ?? null,
      p_width: input.width ?? null,
      p_height: input.height ?? null,
      p_file_size_bytes: input.fileSizeBytes ?? null,
      p_mime_type: input.mimeType ?? null,
      p_metadata: (input.metadata ?? {}) as unknown as Record<string, unknown>,
    });
    if (error) {
      console.warn("[recordUserMedia] non-fatal:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.warn("[recordUserMedia] threw (non-fatal):", (e as Error).message);
    return null;
  }
}

export async function recordUserMediaBatch(
  items: RecordMediaInput[],
  client?: SupabaseClient,
): Promise<void> {
  await Promise.allSettled(items.map((i) => recordUserMedia(i, client)));
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DELETE CLIP - Complete Clip & Asset Removal
 * 
 * Performs FULL deletion:
 * 1. Cancels any active Replicate prediction for this clip
 * 2. Deletes video file from storage
 * 3. Deletes thumbnail from storage
 * 4. Deletes the clip record from database
 * 
 * Nothing is left behind.
 */

interface DeleteClipRequest {
  clipId: string;
  userId?: string; // Deprecated - now extracted from JWT
}

// Extract storage path from Supabase URL
function extractStoragePath(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  
  try {
    const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (supabaseMatch) {
      return {
        bucket: supabaseMatch[1],
        path: decodeURIComponent(supabaseMatch[2]),
      };
    }
    
    const authMatch = url.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
    if (authMatch) {
      return {
        bucket: authMatch[1],
        path: decodeURIComponent(authMatch[2]),
      };
    }
  } catch {
    return null;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ═══ JWT AUTHENTICATION ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    const { clipId }: DeleteClipRequest = await req.json();

    if (!clipId) {
      return new Response(
        JSON.stringify({ error: "clipId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DeleteClip] Starting FULL deletion for clip ${clipId}`);

    // 1. Get clip with project verification
    const { data: clip, error: clipError } = await supabase
      .from('video_clips')
      .select(`
        *,
        project:movie_projects!inner(user_id)
      `)
      .eq('id', clipId)
      .single();

    if (clipError || !clip) {
      return new Response(
        JSON.stringify({ error: "Clip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (clip.project?.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deletionLog: string[] = [];

    // 2. Cancel prediction if generating
    if (clip.veo_operation_name && ['pending', 'generating'].includes(clip.status)) {
      if (replicateApiKey) {
        try {
          await fetch(
            `https://api.replicate.com/v1/predictions/${clip.veo_operation_name}/cancel`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${replicateApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          deletionLog.push(`Cancelled prediction: ${clip.veo_operation_name}`);
        } catch (err) {
          console.error('[DeleteClip] Error cancelling prediction:', err);
        }
      }
    }

    // 3. Delete video from storage
    if (clip.video_url) {
      const storage = extractStoragePath(clip.video_url);
      if (storage) {
        try {
          await supabase.storage.from(storage.bucket).remove([storage.path]);
          deletionLog.push(`Deleted video: ${storage.path}`);
        } catch (err) {
          console.error('[DeleteClip] Error deleting video:', err);
        }
      }
    }

    // 4. Delete thumbnail from storage
    if (clip.thumbnail_url) {
      const storage = extractStoragePath(clip.thumbnail_url);
      if (storage) {
        try {
          await supabase.storage.from(storage.bucket).remove([storage.path]);
          deletionLog.push(`Deleted thumbnail: ${storage.path}`);
        } catch (err) {
          console.error('[DeleteClip] Error deleting thumbnail:', err);
        }
      }
    }

    // 5. Delete clip record from database
    const { error: deleteError } = await supabase
      .from('video_clips')
      .delete()
      .eq('id', clipId);

    if (deleteError) {
      throw new Error(`Failed to delete clip record: ${deleteError.message}`);
    }

    deletionLog.push('Clip record deleted');
    console.log(`[DeleteClip] Clip ${clipId} FULLY deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        clipId,
        message: 'Clip completely deleted. All files removed.',
        deletionLog,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DeleteClip] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

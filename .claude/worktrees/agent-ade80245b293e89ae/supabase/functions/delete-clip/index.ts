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

    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const userId = auth.userId;

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
      .maybeSingle();

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

    // 5. Refund credits if clip was pending/generating (never produced output)
    let creditsRefunded = 0;
    if (['pending', 'generating'].includes(clip.status) && !clip.video_url) {
      try {
        // Look up the usage charge for this project
        const { data: usageCharge } = await supabase
          .from('credit_transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('project_id', clip.project_id)
          .eq('transaction_type', 'usage')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usageCharge) {
          // Get total clips and this clip's share
          const { count: totalClips } = await supabase
            .from('video_clips')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', clip.project_id);

          if (totalClips && totalClips > 0) {
            creditsRefunded = Math.round(Math.abs(usageCharge.amount) / totalClips);
          }
        }

        if (creditsRefunded > 0) {
          // Restore balance
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance')
            .eq('id', userId)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ credits_balance: profile.credits_balance + creditsRefunded })
              .eq('id', userId);
          }

          // Record refund
          await supabase.from('credit_transactions').insert({
            user_id: userId,
            amount: creditsRefunded,
            transaction_type: 'refund',
            description: `Clip deleted (was ${clip.status}): shot ${clip.shot_index}`,
            project_id: clip.project_id,
          });

          deletionLog.push(`Refunded ${creditsRefunded} credits`);
        }
      } catch (refundErr) {
        console.error('[DeleteClip] Refund error (non-fatal):', refundErr);
      }
    }

    // 6. Delete clip record from database
    const { error: deleteError } = await supabase
      .from('video_clips')
      .delete()
      .eq('id', clipId);

    if (deleteError) {
      throw new Error(`Failed to delete clip record: ${deleteError.message}`);
    }

    deletionLog.push('Clip record deleted');
    console.log(`[DeleteClip] Clip ${clipId} FULLY deleted${creditsRefunded > 0 ? ` (${creditsRefunded} credits refunded)` : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        clipId,
        message: creditsRefunded > 0 
          ? `Clip deleted. ${creditsRefunded} credits refunded.`
          : 'Clip completely deleted. All files removed.',
        deletionLog,
        creditsRefunded,
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

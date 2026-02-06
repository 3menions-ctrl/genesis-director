import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CLEANUP-STALE-DRAFTS
 * 
 * Automatically removes phantom draft projects that:
 * 1. Status = 'draft'
 * 2. No generated script (never started)
 * 3. No video_url (never completed)
 * 4. Never modified after creation (created_at = updated_at)
 * 5. Older than specified threshold (default 7 days)
 * 
 * This prevents database pollution from abandoned projects and 
 * improves completion rate metrics.
 * 
 * Designed to run as a scheduled cron job (weekly recommended).
 */

interface CleanupRequest {
  daysOld?: number; // How old drafts must be (default: 7)
  dryRun?: boolean; // If true, just report what would be deleted
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let daysOld = 7;
    let dryRun = false;

    // Parse request body if provided
    try {
      const body = await req.json();
      if (body.daysOld && typeof body.daysOld === 'number') {
        daysOld = Math.max(1, Math.min(365, body.daysOld)); // Clamp between 1-365
      }
      if (typeof body.dryRun === 'boolean') {
        dryRun = body.dryRun;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`[CleanupDrafts] Starting cleanup (daysOld: ${daysOld}, dryRun: ${dryRun})`);

    // First, identify drafts to clean
    const { data: staleDrafts, error: selectError } = await supabase
      .from('movie_projects')
      .select('id, title, user_id, created_at')
      .eq('status', 'draft')
      .is('generated_script', null)
      .is('video_url', null)
      .is('script_content', null)
      .lt('created_at', new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString());

    if (selectError) {
      throw new Error(`Failed to query stale drafts: ${selectError.message}`);
    }

    // Filter to only include untouched drafts (created_at = updated_at)
    // We need a separate query because Supabase doesn't support column comparison in filters
    const untouchedDrafts = [];
    
    for (const draft of staleDrafts || []) {
      const { data: fullDraft } = await supabase
        .from('movie_projects')
        .select('created_at, updated_at')
        .eq('id', draft.id)
        .single();
      
      if (fullDraft && fullDraft.created_at === fullDraft.updated_at) {
        untouchedDrafts.push(draft);
      }
    }

    console.log(`[CleanupDrafts] Found ${untouchedDrafts.length} stale untouched drafts`);

    if (dryRun) {
      // Just report what would be deleted
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          wouldDelete: untouchedDrafts.length,
          drafts: untouchedDrafts.map(d => ({
            id: d.id,
            title: d.title,
            createdAt: d.created_at,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Actually delete the drafts
    if (untouchedDrafts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          deleted: 0,
          message: "No stale drafts to clean up",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idsToDelete = untouchedDrafts.map(d => d.id);
    
    const { error: deleteError, count } = await supabase
      .from('movie_projects')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      throw new Error(`Failed to delete drafts: ${deleteError.message}`);
    }

    console.log(`[CleanupDrafts] Successfully deleted ${count || idsToDelete.length} stale drafts`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: count || idsToDelete.length,
        message: `Cleaned up ${count || idsToDelete.length} stale draft projects`,
        details: untouchedDrafts.map(d => ({
          id: d.id,
          title: d.title,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CleanupDrafts] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

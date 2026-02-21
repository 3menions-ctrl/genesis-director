import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * REPLICATE AUDIT — Find ALL predictions and cross-reference with our DB
 * 
 * This function:
 * 1. Lists recent Replicate predictions (last N hours)
 * 2. Cross-references with video_clips and pending_video_tasks
 * 3. Identifies orphaned completed predictions we never tracked
 * 4. Optionally recovers them (downloads video to storage, creates clip records)
 */

interface ReplicatePrediction {
  id: string;
  status: string;
  model: string;
  version: string;
  created_at: string;
  completed_at: string | null;
  output: string | string[] | null;
  error: string | null;
  input: Record<string, any>;
}

interface AuditResult {
  predictionId: string;
  status: string;
  model: string;
  createdAt: string;
  completedAt: string | null;
  hasOutput: boolean;
  videoUrl: string | null;
  trackedInDb: boolean;
  projectId: string | null;
  clipIndex: number | null;
  recoverable: boolean;
  recovered: boolean;
  recoveredVideoUrl: string | null;
  inputPrompt: string | null;
  inputStartImage: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

  if (!REPLICATE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "REPLICATE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Auth is optional for service-role calls (watchdog, admin)
  // but required for user-facing calls
  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    // Allow service-role key (Authorization: Bearer <service_role_key>)
    if (!auth.authenticated) {
      // Check if this is a service-role call via the key header
      const authHeader = req.headers.get('authorization') || '';
      const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'NONE');
      if (!isServiceRole) {
        return unauthorizedResponse(corsHeaders, auth.error);
      }
    }
  } catch {
    // Allow through for testing
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      hoursBack = 24,    // How far back to look
      recover = false,    // Whether to actually recover orphaned videos
      userId,             // Filter to specific user
      limit = 100,        // Max predictions to fetch from Replicate
    } = body;

    console.log(`[ReplicateAudit] Starting audit: ${hoursBack}h back, recover=${recover}, limit=${limit}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Fetch ALL recent predictions from Replicate
    // ═══════════════════════════════════════════════════════════════════════════
    const allPredictions: ReplicatePrediction[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;

    do {
      const url = nextCursor 
        ? nextCursor 
        : `https://api.replicate.com/v1/predictions?limit=50`;
      
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const predictions = data.results || [];
      
      // Filter by time window
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      for (const pred of predictions) {
        if (pred.created_at < cutoff) {
          nextCursor = null; // Stop pagination
          break;
        }
        allPredictions.push(pred);
      }

      if (allPredictions.length >= limit) {
        nextCursor = null;
        break;
      }

      nextCursor = data.next || null;
      pageCount++;
      
      // Safety limit on pages
      if (pageCount >= 10) break;
    } while (nextCursor);

    console.log(`[ReplicateAudit] Found ${allPredictions.length} predictions in last ${hoursBack}h`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Get ALL tracked prediction IDs from our database
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Get from video_clips (veo_operation_name stores predictionId)
    const { data: trackedClips } = await supabase
      .from('video_clips')
      .select('veo_operation_name, project_id, shot_index, status, video_url')
      .not('veo_operation_name', 'is', null)
      .gt('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

    const trackedPredictionIds = new Set<string>();
    const clipsByPrediction = new Map<string, { projectId: string; shotIndex: number; status: string; videoUrl: string | null }>();
    
    for (const clip of (trackedClips || [])) {
      if (clip.veo_operation_name) {
        trackedPredictionIds.add(clip.veo_operation_name);
        clipsByPrediction.set(clip.veo_operation_name, {
          projectId: clip.project_id,
          shotIndex: clip.shot_index,
          status: clip.status,
          videoUrl: clip.video_url,
        });
      }
    }

    // Get from pending_video_tasks in movie_projects
    const { data: avatarProjects } = await supabase
      .from('movie_projects')
      .select('id, pending_video_tasks, user_id')
      .gt('updated_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

    const projectByPrediction = new Map<string, { projectId: string; clipIndex: number; userId: string }>();
    
    for (const project of (avatarProjects || [])) {
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      if (tasks.predictions && Array.isArray(tasks.predictions)) {
        for (const pred of tasks.predictions) {
          if (pred.predictionId) {
            trackedPredictionIds.add(pred.predictionId);
            projectByPrediction.set(pred.predictionId, {
              projectId: project.id,
              clipIndex: pred.clipIndex,
              userId: project.user_id,
            });
          }
        }
      }
    }

    console.log(`[ReplicateAudit] Tracked predictions in DB: ${trackedPredictionIds.size}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Cross-reference and identify orphans
    // ═══════════════════════════════════════════════════════════════════════════
    const auditResults: AuditResult[] = [];
    let orphanedCount = 0;
    let recoverableCount = 0;
    let recoveredCount = 0;

    for (const pred of allPredictions) {
      // Only audit video generation predictions (Kling)
      const isVideoModel = pred.model?.includes('kling') || 
                          pred.model?.includes('video') ||
                          pred.input?.start_image; // Kling always has start_image
      
      if (!isVideoModel) continue;

      const isTracked = trackedPredictionIds.has(pred.id);
      const clipInfo = clipsByPrediction.get(pred.id);
      const projectInfo = projectByPrediction.get(pred.id);
      
      let videoUrl: string | null = null;
      if (pred.output) {
        videoUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      }

      const isRecoverable = pred.status === 'succeeded' && videoUrl && !isTracked;

      const result: AuditResult = {
        predictionId: pred.id,
        status: pred.status,
        model: pred.model || 'unknown',
        createdAt: pred.created_at,
        completedAt: pred.completed_at,
        hasOutput: !!videoUrl,
        videoUrl,
        trackedInDb: isTracked,
        projectId: clipInfo?.projectId || projectInfo?.projectId || null,
        clipIndex: clipInfo?.shotIndex ?? projectInfo?.clipIndex ?? null,
        recoverable: !!isRecoverable,
        recovered: false,
        recoveredVideoUrl: null,
        inputPrompt: pred.input?.prompt?.substring(0, 200) || null,
        inputStartImage: pred.input?.start_image?.substring(0, 100) || null,
      };

      if (!isTracked) {
        orphanedCount++;
        if (isRecoverable) recoverableCount++;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 4: Recover orphaned videos (if requested)
      // ═══════════════════════════════════════════════════════════════════════
      if (recover && isRecoverable && videoUrl) {
        try {
          console.log(`[ReplicateAudit] 🔥 RECOVERING orphaned prediction ${pred.id}...`);
          
          // Download and store the video
          const videoResp = await fetch(videoUrl);
          if (videoResp.ok) {
            const videoBlob = await videoResp.blob();
            const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
            
            const fileName = `recovered_${pred.id.substring(0, 8)}_${Date.now()}.mp4`;
            const storagePath = `recovered/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('video-clips')
              .upload(storagePath, videoBytes, { contentType: 'video/mp4', upsert: true });
            
            if (!uploadError) {
              const permanentUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${storagePath}`;
              result.recovered = true;
              result.recoveredVideoUrl = permanentUrl;
              recoveredCount++;
              
              // Try to find user who owns this - look for matching project
              const targetUserId = userId || projectInfo?.userId;
              
              if (targetUserId) {
                // Create a movie_project for this recovered video
                const { data: recoveredProject } = await supabase
                  .from('movie_projects')
                  .insert({
                    user_id: targetUserId,
                    title: `Recovered: ${pred.id.substring(0, 8)}`,
                    status: 'completed',
                    mode: 'avatar',
                    video_url: permanentUrl,
                    pending_video_tasks: {
                      stage: 'complete',
                      progress: 100,
                      source: 'replicate_audit_recovery',
                      originalPredictionId: pred.id,
                      recoveredAt: new Date().toISOString(),
                    },
                    pipeline_stage: 'completed',
                  })
                  .select('id')
                  .single();
                
                if (recoveredProject) {
                  result.projectId = recoveredProject.id;
                  console.log(`[ReplicateAudit] ✅ Created recovered project ${recoveredProject.id}`);
                }
              }
              
              console.log(`[ReplicateAudit] ✅ Recovered: ${permanentUrl}`);
            } else {
              console.error(`[ReplicateAudit] Storage upload failed:`, uploadError);
            }
          }
        } catch (recoverErr) {
          console.error(`[ReplicateAudit] Recovery failed for ${pred.id}:`, recoverErr);
        }
      }

      auditResults.push(result);
    }

    console.log(`[ReplicateAudit] ═══ AUDIT COMPLETE ═══`);
    console.log(`[ReplicateAudit] Total predictions: ${auditResults.length}`);
    console.log(`[ReplicateAudit] Tracked in DB: ${auditResults.length - orphanedCount}`);
    console.log(`[ReplicateAudit] Orphaned: ${orphanedCount}`);
    console.log(`[ReplicateAudit] Recoverable: ${recoverableCount}`);
    console.log(`[ReplicateAudit] Recovered: ${recoveredCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalPredictions: auditResults.length,
          trackedInDb: auditResults.length - orphanedCount,
          orphaned: orphanedCount,
          recoverable: recoverableCount,
          recovered: recoveredCount,
          hoursBack,
        },
        predictions: auditResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ReplicateAudit] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

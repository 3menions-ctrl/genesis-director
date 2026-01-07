import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * RESUME PIPELINE
 * 
 * Resumes the Hollywood Pipeline from various stages:
 * - After script approval (awaiting_approval -> qualitygate)
 * - After production failure (failed/generating -> production)
 * - After any interruption
 */

interface ResumeRequest {
  projectId: string;
  userId: string;
  resumeFrom?: 'qualitygate' | 'assets' | 'production' | 'postproduction';
  approvedShots?: Array<{
    id: string;
    title: string;
    description: string;
    durationSeconds: number;
    dialogue?: string;
    mood?: string;
    [key: string]: any;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ResumeRequest = await req.json();
    console.log("[ResumePipeline] Resuming project:", request.projectId);

    if (!request.projectId || !request.userId) {
      throw new Error("Missing projectId or userId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current project state
    const { data: project, error: fetchError } = await supabase
      .from('movie_projects')
      .select('*')
      .eq('id', request.projectId)
      .single();

    if (fetchError || !project) {
      throw new Error(`Project not found: ${fetchError?.message}`);
    }

    const pendingTasks = project.pending_video_tasks || {};
    const currentStage = pendingTasks.stage;
    
    // Determine resume stage based on current state and explicit request
    let resumeFrom = request.resumeFrom;
    
    if (!resumeFrom) {
      // Auto-detect based on current stage
      if (currentStage === 'awaiting_approval') {
        resumeFrom = 'qualitygate';
      } else if (currentStage === 'production' || currentStage === 'error' || project.status === 'failed' || project.status === 'generating') {
        resumeFrom = 'production';
      } else if (currentStage === 'assets') {
        resumeFrom = 'assets';
      } else {
        throw new Error(`Cannot resume from stage: ${currentStage}. Current status: ${project.status}`);
      }
    }
    
    console.log(`[ResumePipeline] Resuming from stage: ${resumeFrom}`);

    // Update shots if user made edits (only for script approval)
    let script = pendingTasks.script;
    if (request.approvedShots && request.approvedShots.length > 0) {
      script = { shots: request.approvedShots };
      console.log("[ResumePipeline] Using user-edited shots:", request.approvedShots.length);
    }

    // Update project to indicate resumption
    await supabase
      .from('movie_projects')
      .update({
        status: 'generating',
        pending_video_tasks: {
          ...pendingTasks,
          stage: 'resuming',
          progress: resumeFrom === 'production' ? 75 : 30,
          script,
          resumedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.projectId);

    // Call hollywood-pipeline to continue
    const pipelineRequest = {
      userId: request.userId,
      projectId: request.projectId,
      resumeFrom,
      skipApproval: true,
      approvedScript: script,
      // Pass through original config from pending tasks
      includeVoice: pendingTasks.config?.includeVoice ?? true,
      includeMusic: pendingTasks.config?.includeMusic ?? true,
      genre: pendingTasks.config?.genre || 'cinematic',
      mood: pendingTasks.config?.mood || 'epic',
      colorGrading: pendingTasks.config?.colorGrading || 'cinematic',
      clipCount: script?.shots?.length || pendingTasks.clipCount || 6,
      referenceImageAnalysis: pendingTasks.referenceAnalysis,
      identityBible: pendingTasks.identityBible,
      extractedCharacters: pendingTasks.extractedCharacters,
    };

    console.log("[ResumePipeline] Calling hollywood-pipeline with resume config:", resumeFrom);

    const response = await fetch(`${supabaseUrl}/functions/v1/hollywood-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(pipelineRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ResumePipeline] Pipeline call failed:", errorText);
      throw new Error(`Pipeline resume failed: ${errorText}`);
    }

    const pipelineResult = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Pipeline resumed from ${resumeFrom}`,
        projectId: request.projectId,
        resumedFrom: resumeFrom,
        ...pipelineResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ResumePipeline] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FinalizeRequest {
  projectId: string;
  videoUrl: string;
  durationSeconds?: number;
  clipsProcessed?: number;
  status?: 'completed' | 'failed';
  errorMessage?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      projectId, 
      videoUrl, 
      durationSeconds, 
      clipsProcessed,
      status = 'completed',
      errorMessage 
    } = await req.json() as FinalizeRequest;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FinalizeStitch] Finalizing project ${projectId} with status: ${status}`);

    // Initialize Supabase with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed' && videoUrl) {
      updateData.video_url = videoUrl;
      updateData.current_stage = 'completed';
      updateData.progress = 100;
    }

    if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
    }

    // Update the project
    const { data, error } = await supabase
      .from('movie_projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('[FinalizeStitch] Error updating project:', error);
      return new Response(
        JSON.stringify({ error: `Failed to update project: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FinalizeStitch] Project ${projectId} updated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        project: data,
        videoUrl,
        durationSeconds,
        clipsProcessed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[FinalizeStitch] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

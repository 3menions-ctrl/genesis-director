import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrailerRequest {
  snippetDuration?: number; // seconds per snippet (default 2)
  partsPerVideo?: number; // parts per video (default 2)
  maxVideos?: number; // max videos to include (default 10)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      snippetDuration = 3, // 3 seconds per clip
      partsPerVideo = 1, // 1 snippet per video for cleaner transitions
      maxVideos = 10 
    }: TrailerRequest = await req.json().catch(() => ({}));

    console.log('[generate-trailer] Fetching public videos...');

    // Fetch public videos with direct video URLs (not manifests)
    const { data: videos, error: fetchError } = await supabase
      .from('movie_projects')
      .select('id, title, video_url')
      .eq('is_public', true)
      .not('video_url', 'is', null)
      .order('likes_count', { ascending: false })
      .limit(maxVideos);

    if (fetchError) {
      throw new Error(`Failed to fetch videos: ${fetchError.message}`);
    }

    // Filter out manifest files
    const directVideos = (videos || []).filter(v => 
      v.video_url && !v.video_url.endsWith('.json')
    );

    if (directVideos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No public videos available for trailer' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[generate-trailer] Found ${directVideos.length} videos`);

    // Create a manifest-style response with clip information
    // The client will use this to stitch in the browser with proper timing info
    const clips: { url: string; title: string; startSec: number; durationSec: number }[] = [];
    
    for (const video of directVideos) {
      // For each video, add snippets at different points
      // Estimate video duration based on project settings (default 5 min = 300 sec)
      const estimatedDuration = 60; // Assume 60 seconds for safety
      
      for (let part = 0; part < partsPerVideo; part++) {
        const segmentLength = estimatedDuration / partsPerVideo;
        const startTime = part * segmentLength + (segmentLength - snippetDuration) / 2;
        
        clips.push({
          url: video.video_url!,
          title: video.title,
          startSec: Math.max(0, startTime),
          durationSec: snippetDuration,
        });
      }
    }

    // Shuffle clips for variety
    for (let i = clips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clips[i], clips[j]] = [clips[j], clips[i]];
    }

    // Limit total trailer length to ~45 seconds for 3-sec clips
    const maxClips = Math.floor(45 / snippetDuration);
    const selectedClips = clips.slice(0, maxClips);

    console.log(`[generate-trailer] Prepared ${selectedClips.length} clips for trailer`);

    return new Response(
      JSON.stringify({
        success: true,
        clips: selectedClips,
        totalDuration: selectedClips.length * snippetDuration,
        videoCount: new Set(selectedClips.map(c => c.url)).size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-trailer] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

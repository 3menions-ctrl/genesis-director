import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * REGENERATE AUDIO
 * 
 * Regenerates voice narration for an existing project using AI-enhanced
 * flowing narration. Takes shot descriptions and creates coherent voiceover.
 */

interface RegenerateAudioRequest {
  projectId: string;
  voiceType?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { projectId, voiceType } = await req.json() as RegenerateAudioRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[RegenerateAudio] Starting for project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project with script
    const { data: project, error: fetchError } = await supabase
      .from('movie_projects')
      .select('id, title, generated_script, pending_video_tasks, mood, genre')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      throw new Error(`Project not found: ${fetchError?.message}`);
    }

    // Extract shots from script
    let shots: Array<{ dialogue?: string; description?: string; mood?: string }> = [];
    
    // Try pending_video_tasks.script first
    const pendingTasks = project.pending_video_tasks as any;
    if (pendingTasks?.script?.shots) {
      shots = pendingTasks.script.shots;
    } else if (project.generated_script) {
      // Try generated_script field
      try {
        const parsed = typeof project.generated_script === 'string'
          ? JSON.parse(project.generated_script)
          : project.generated_script;
        shots = parsed.shots || [];
      } catch (e) {
        console.warn("[RegenerateAudio] Failed to parse generated_script");
      }
    }

    if (shots.length === 0) {
      throw new Error("No shots found in project script");
    }

    console.log(`[RegenerateAudio] Found ${shots.length} shots, creating AI-enhanced narration...`);

    // Create AI-enhanced flowing narration
    const narration = await createFlowingNarration(shots, project.mood || project.genre || 'cinematic');

    if (!narration || narration.length < 50) {
      throw new Error("Failed to generate coherent narration");
    }

    console.log(`[RegenerateAudio] Narration created: ${narration.length} chars`);
    console.log(`[RegenerateAudio] Preview: "${narration.substring(0, 150)}..."`);

    // Generate voice from narration
    const voiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        text: narration,
        projectId,
        voiceType: voiceType || 'narrator',
      }),
    });

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      throw new Error(`Voice generation failed: ${errorText}`);
    }

    const voiceResult = await voiceResponse.json();

    if (!voiceResult.audioUrl) {
      throw new Error("Voice generation returned no URL");
    }

    console.log(`[RegenerateAudio] ✅ New audio generated: ${voiceResult.audioUrl}`);

    // Update project with new voice URL
    await supabase
      .from('movie_projects')
      .update({
        voice_audio_url: voiceResult.audioUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: voiceResult.audioUrl,
        narrationLength: narration.length,
        message: "Audio regenerated with AI-enhanced flowing narration",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[RegenerateAudio] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * AI-Enhanced Narration Generator
 */
async function createFlowingNarration(
  shots: Array<{ dialogue?: string; description?: string; mood?: string }>,
  overallMood: string
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    console.warn("[RegenerateAudio] No OpenAI API key - using basic fallback");
    return shots
      .map(s => s.dialogue || '')
      .filter(Boolean)
      .join(' ') || shots.map(s => s.description || '').join('. ');
  }

  const shotSummary = shots.map((s, i) => {
    if (s.dialogue) return `Shot ${i + 1}: "${s.dialogue}"`;
    return `Shot ${i + 1}: [Visual: ${s.description || 'Scene continues'}]`;
  }).join('\n');

  const systemPrompt = `You are a professional narrator creating voiceover for a ${overallMood} video.

Your task: Transform the following shot-by-shot content into ONE flowing narration script.

Rules:
1. Write in a natural, conversational tone suitable for voiceover
2. Create smooth transitions between ideas - no choppy sentences
3. Keep the emotional tone consistent with the ${overallMood} mood
4. If shots contain dialogue, weave it naturally into the narration
5. If shots only have visual descriptions, describe what's happening poetically
6. The narration should feel like ONE cohesive story, not separate scenes
7. Keep it under 500 words for pacing
8. Do NOT include any stage directions, shot numbers, or technical notes
9. Write ONLY the narration text - no quotes, no "Narrator:", just the spoken words
10. Make it sound like a story being told, with a clear beginning, middle, and end`;

  const userPrompt = `Here are the shots to narrate:\n\n${shotSummary}\n\nWrite a flowing narration script:`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';

  } catch (err) {
    console.error("[RegenerateAudio] AI narration failed:", err);
    return shots.map(s => s.dialogue || '').filter(Boolean).join(' ') 
      || shots.map(s => s.description || '').filter(Boolean).join('. ');
  }
}

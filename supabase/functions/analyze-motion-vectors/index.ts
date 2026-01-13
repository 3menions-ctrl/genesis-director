import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Analyze Motion Vectors
 * 
 * Uses Gemini vision to analyze the actual last frame/video of a clip
 * and extract real motion vectors for seamless transitions.
 * 
 * This replaces the text-based motion guessing with actual visual analysis.
 */

interface MotionVectorRequest {
  videoUrl: string;
  frameUrl?: string;
  shotId: string;
  promptDescription?: string;
}

interface MotionVectors {
  subjectVelocity: string;
  subjectDirection: string;
  cameraMomentum: string;
  cameraMovement: string;
  subjectPosition: string;
  motionBlur: boolean;
  actionContinuity: string;
  continuityPrompt: string;
}

interface MotionVectorResult {
  success: boolean;
  shotId: string;
  motionVectors?: MotionVectors;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: MotionVectorRequest = await req.json();
    const { videoUrl, frameUrl, shotId, promptDescription } = request;

    if (!videoUrl && !frameUrl) {
      throw new Error("Either videoUrl or frameUrl is required");
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`[MotionVectors] Analyzing motion for shot ${shotId}`);

    // Prefer frame URL but fall back to video URL (Gemini can analyze both)
    const analysisUrl = frameUrl || videoUrl;

    const systemPrompt = `You are a motion analysis expert for AI video generation. Analyze the visual content and determine the motion state at the END of this clip/frame.

Your analysis is CRITICAL for seamless clip-to-clip transitions. The next clip will start with matching motion to avoid jarring cuts.

OUTPUT FORMAT (JSON only, no markdown):
{
  "subjectVelocity": "stationary|slow|moderate|fast|rapid",
  "subjectDirection": "static|forward|backward|left-to-right|right-to-left|ascending|descending|rotating-cw|rotating-ccw",
  "cameraMomentum": "locked|slow-pan-left|slow-pan-right|dolly-forward|dolly-back|crane-up|crane-down|tracking-subject|handheld-subtle",
  "cameraMovement": "static|panning|tilting|dollying|tracking|crane|handheld",
  "subjectPosition": "center|left-third|right-third|foreground|background|exiting-frame-left|exiting-frame-right",
  "motionBlur": true/false,
  "actionContinuity": "Brief description of what action is happening that must continue",
  "continuityPrompt": "A prompt prefix for the next clip to maintain this motion (e.g., 'Continue with subject walking left-to-right at moderate pace, camera tracking alongside...')"
}`;

    const userPrompt = `Analyze the motion state at the END of this video/frame.

${promptDescription ? `CONTEXT: This shot was supposed to show: "${promptDescription}"` : ''}

Look for:
1. SUBJECT MOTION: Is the main subject moving? Speed? Direction?
2. CAMERA MOTION: Is the camera moving? How?
3. POSITION: Where is the subject in frame?
4. MOMENTUM: What motion must the NEXT clip start with to feel seamless?

Return JSON only.`;

    const messageContent: any[] = [
      { type: 'text', text: userPrompt },
      { type: 'image_url', image_url: { url: analysisUrl } }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MotionVectors] Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || '';

    console.log('[MotionVectors] Raw response:', rawContent.substring(0, 200));

    // Parse JSON from response
    let motionVectors: MotionVectors;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                        rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
      motionVectors = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.warn('[MotionVectors] Parse error, using defaults:', parseError);
      // Default vectors when parsing fails
      motionVectors = {
        subjectVelocity: 'moderate',
        subjectDirection: 'forward',
        cameraMomentum: 'tracking-subject',
        cameraMovement: 'tracking',
        subjectPosition: 'center',
        motionBlur: false,
        actionContinuity: 'Subject continues current action',
        continuityPrompt: 'Seamless continuation of previous shot motion and composition',
      };
    }

    console.log(`[MotionVectors] Analyzed: velocity=${motionVectors.subjectVelocity}, direction=${motionVectors.subjectDirection}, camera=${motionVectors.cameraMomentum}`);

    const result: MotionVectorResult = {
      success: true,
      shotId,
      motionVectors,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[MotionVectors] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

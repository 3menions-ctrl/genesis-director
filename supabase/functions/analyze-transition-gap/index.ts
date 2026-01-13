import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Analyze Transition Gap - Veed-Level Scene Continuity Analysis
 * 
 * Uses vision AI to analyze the actual content of two frames and determine:
 * 1. Motion continuity (is subject moving in compatible directions?)
 * 2. Visual continuity (lighting, color, composition)
 * 3. Semantic continuity (is this a logical scene progression?)
 * 4. Gap severity and recommended fix
 */

interface TransitionAnalysis {
  overallScore: number; // 0-100
  motionScore: number;
  visualScore: number;
  semanticScore: number;
  
  gapType: 'none' | 'minor' | 'moderate' | 'severe' | 'incompatible';
  gapDescription: string;
  
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'wipe' | 'bridge-clip';
  transitionDurationMs: number;
  
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
  bridgeClipDurationSeconds?: number;
  
  motionContinuity: {
    fromClipEndMotion: string;
    toClipStartMotion: string;
    isCompatible: boolean;
    mismatchDescription?: string;
  };
  
  visualContinuity: {
    lightingMatch: boolean;
    colorMatch: boolean;
    compositionMatch: boolean;
    issues: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      fromClipUrl, 
      toClipUrl, 
      fromClipLastFrame,
      toClipFirstFrame,
      fromClipDescription,
      toClipDescription,
      strictness = 'normal'
    } = await req.json();

    if (!fromClipUrl && !fromClipLastFrame) {
      throw new Error("Either fromClipUrl or fromClipLastFrame is required");
    }
    if (!toClipUrl && !toClipFirstFrame) {
      throw new Error("Either toClipUrl or toClipFirstFrame is required");
    }

    console.log(`[TransitionGap] Analyzing transition gap...`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use the frame URLs if provided, otherwise use video URLs (Gemini can analyze videos)
    const frame1 = fromClipLastFrame || fromClipUrl;
    const frame2 = toClipFirstFrame || toClipUrl;

    const strictnessMap: Record<string, string> = {
      lenient: 'Be lenient - only flag severe issues. Minor lighting or color differences are acceptable.',
      normal: 'Use standard cinematic judgment. Flag issues that would be noticeable to viewers.',
      strict: 'Be strict - flag any visual or motion discontinuity that a professional editor would notice.'
    };
    const strictnessGuide = strictnessMap[strictness as string] || strictnessMap.normal;

    const analysisPrompt = `You are a professional video editor analyzing two consecutive frames for transition quality.

FRAME 1 (end of clip A): This is the last frame before the transition.
FRAME 2 (start of clip B): This is the first frame after the transition.

${fromClipDescription ? `Clip A description: ${fromClipDescription}` : ''}
${toClipDescription ? `Clip B description: ${toClipDescription}` : ''}

${strictnessGuide}

Analyze these frames and return a JSON object (no markdown, just valid JSON):
{
  "overallScore": <0-100, where 100 means perfect continuity>,
  "motionScore": <0-100, motion compatibility>,
  "visualScore": <0-100, visual continuity>,
  "semanticScore": <0-100, logical scene progression>,
  
  "gapType": "none" | "minor" | "moderate" | "severe" | "incompatible",
  "gapDescription": "<describe the main discontinuity issue in 1-2 sentences>",
  
  "recommendedTransition": "cut" | "dissolve" | "fade" | "wipe" | "bridge-clip",
  "transitionDurationMs": <recommended transition duration: 0 for cut, 300-1000 for others>,
  
  "bridgeClipNeeded": <true if a bridge clip would help>,
  "bridgeClipPrompt": "<if needed, describe a 2-4 second transition shot that bridges these frames>",
  "bridgeClipDurationSeconds": <2-4 seconds if needed>,
  
  "motionContinuity": {
    "fromClipEndMotion": "<describe motion at end of clip A: direction, speed, subject position>",
    "toClipStartMotion": "<describe motion at start of clip B: direction, speed, subject position>",
    "isCompatible": <true if motions flow naturally>,
    "mismatchDescription": "<if not compatible, explain the jarring jump>"
  },
  
  "visualContinuity": {
    "lightingMatch": <true if lighting is consistent>,
    "colorMatch": <true if color palette is consistent>,
    "compositionMatch": <true if framing/composition flows>,
    "issues": ["<list specific visual discontinuities>"]
  }
}

CRITICAL GUIDELINES:
- A score above 80 usually means a clean cut works fine
- Score 60-80 typically needs a dissolve or fade
- Score 40-60 may benefit from a bridge clip
- Score below 40 almost certainly needs a bridge clip
- Consider motion direction: if subject moves right in clip A, they should continue right in clip B
- Consider eyeline and spatial continuity
- A bridge clip prompt should describe a neutral transition shot (e.g., "slow pan across landscape", "close-up detail shot", "atmospheric establishing shot")`;

    // Call Gemini Vision to analyze the frames
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: frame1 } },
              { type: 'image_url', image_url: { url: frame2 } }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TransitionGap] Vision API error:', errorText);
      throw new Error(`Vision API failed: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const analysis: TransitionAnalysis = JSON.parse(jsonStr);
    
    console.log(`[TransitionGap] Analysis complete: Score ${analysis.overallScore}, Gap: ${analysis.gapType}, Transition: ${analysis.recommendedTransition}`);
    
    if (analysis.bridgeClipNeeded) {
      console.log(`[TransitionGap] Bridge clip recommended: ${analysis.bridgeClipPrompt?.substring(0, 100)}...`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[TransitionGap] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

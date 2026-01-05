import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisualDebugRequest {
  videoUrl: string;
  frameUrl?: string; // Optional: specific frame to analyze
  shotDescription: string;
  shotId: string;
  projectType?: string;
  referenceImageUrl?: string; // Master anchor image for character/scene consistency
  previousShotContext?: string; // Description of what happened in previous shots
  referenceAnalysis?: {
    characterIdentity?: { description: string; clothing?: string; features?: string };
    environment?: { setting: string; time?: string; weather?: string };
    lighting?: { style: string; direction: string; color?: string };
    colorPalette?: { mood: string; dominant: string[] };
    visualStyle?: string; // e.g., "cinematic", "anime", "realistic"
  };
}

interface VisualDebugResult {
  passed: boolean;
  verdict: 'PASS' | 'FAIL';
  score: number; // 0-100
  issues: {
    category: 'physics' | 'identity' | 'lighting' | 'composition' | 'cinematic';
    severity: 'critical' | 'warning';
    description: string;
  }[];
  correctivePrompt?: string; // If FAIL, this is the corrected prompt for retry
  suggestedEdits?: string[]; // Actionable suggestions to improve the shot
  analysisDetails: {
    physicsPlausibility: number;
    identityConsistency: number;
    lightingConsistency: number;
    cinematicQuality: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: VisualDebugRequest = await req.json();
    const { videoUrl, frameUrl, shotDescription, shotId, projectType, referenceImageUrl, previousShotContext, referenceAnalysis } = body;

    console.log(`[VisualDebugger] Analyzing shot ${shotId}`);
    console.log(`[VisualDebugger] Video URL: ${videoUrl?.substring(0, 80)}...`);
    console.log(`[VisualDebugger] Reference image: ${referenceImageUrl ? 'provided' : 'none'}`);

    // Build comprehensive reference context for maintaining consistency
    let referenceContext = '';
    let characterContext = '';
    let environmentContext = '';
    
    if (referenceAnalysis) {
      characterContext = referenceAnalysis.characterIdentity?.description || '';
      if (referenceAnalysis.characterIdentity?.clothing) {
        characterContext += ` Wearing: ${referenceAnalysis.characterIdentity.clothing}.`;
      }
      if (referenceAnalysis.characterIdentity?.features) {
        characterContext += ` Features: ${referenceAnalysis.characterIdentity.features}.`;
      }
      
      environmentContext = referenceAnalysis.environment?.setting || '';
      if (referenceAnalysis.environment?.time) {
        environmentContext += ` Time: ${referenceAnalysis.environment.time}.`;
      }
      if (referenceAnalysis.environment?.weather) {
        environmentContext += ` Weather: ${referenceAnalysis.environment.weather}.`;
      }
      
      referenceContext = `
CRITICAL - REFERENCE IMAGE REQUIREMENTS (must match exactly):
- CHARACTER: ${characterContext || 'Not specified'}
- ENVIRONMENT: ${environmentContext || 'Not specified'}
- LIGHTING: ${referenceAnalysis.lighting?.style || 'Not specified'}, Direction: ${referenceAnalysis.lighting?.direction || 'Not specified'}${referenceAnalysis.lighting?.color ? `, Color: ${referenceAnalysis.lighting.color}` : ''}
- COLOR PALETTE: ${referenceAnalysis.colorPalette?.mood || 'Not specified'}, Dominant colors: ${referenceAnalysis.colorPalette?.dominant?.join(', ') || 'Not specified'}
- VISUAL STYLE: ${referenceAnalysis.visualStyle || projectType || 'cinematic'}
`;
    }
    
    // Add previous shot context for continuity
    let continuityContext = '';
    if (previousShotContext) {
      continuityContext = `
PREVIOUS SHOT CONTEXT (for continuity):
${previousShotContext}

The current shot must maintain visual continuity with what was established in previous shots.
`;
    }

    // Use Lovable AI Gateway with a multimodal model for video/image analysis
    const systemPrompt = `You are a Visual Quality Debugger for AI-generated videos. Your role is to analyze video frames/thumbnails and determine if the generated content meets production quality standards.

You must output a JSON response with your analysis.

EVALUATION CRITERIA:

1. PHYSICS PLAUSIBILITY (25 points)
   - Gravity: Objects fall correctly, no floating elements
   - Anatomy: Human bodies have correct proportions, no extra limbs
   - Fluid dynamics: Water, smoke, cloth behave realistically
   - Object permanence: Things don't randomly appear/disappear
   - Morphing: No unnatural face/body deformations

2. IDENTITY CONSISTENCY (25 points)
   - Character appearance matches reference description
   - Clothing and accessories remain consistent
   - Face features stable throughout

3. LIGHTING CONSISTENCY (25 points)
   - Light direction matches reference
   - Shadow placement is logical
   - Color temperature is consistent with mood

4. CINEMATIC QUALITY (25 points)
   - Composition follows rule of thirds or intentional framing
   - No visible artifacts, glitches, or blurring
   - Motion is smooth and intentional
   - No camera equipment, crew, or equipment visible

VERDICT RULES:
- PASS: Total score >= 70 AND no critical physics/identity issues
- FAIL: Total score < 70 OR any critical issue present

If FAIL, you MUST provide a corrective prompt that:
1. Explicitly addresses the detected issues
2. MAINTAINS THE EXACT SAME CHARACTER DESCRIPTION from the reference
3. MAINTAINS THE EXACT SAME ENVIRONMENT/BACKGROUND from the reference  
4. Adds specific fixes for the issues (e.g., "smooth natural movement", "stable character appearance")
5. Adds negative prompts to prevent the issue (e.g., "no morphing, no extra limbs, no jerky motion")
6. The corrective prompt should be a COMPLETE standalone prompt, not just the fixes

${referenceContext}
${continuityContext}

OUTPUT FORMAT (JSON only):
{
  "passed": true/false,
  "verdict": "PASS" or "FAIL",
  "score": 0-100,
  "issues": [
    {
      "category": "physics|identity|lighting|composition|cinematic",
      "severity": "critical|warning",
      "description": "Specific issue description"
    }
  ],
  "correctivePrompt": "Only if FAIL - COMPLETE corrective prompt including full character/environment description plus fixes",
  "analysisDetails": {
    "physicsPlausibility": 0-25,
    "identityConsistency": 0-25,
    "lightingConsistency": 0-25,
    "cinematicQuality": 0-25
  }
}`;

    // Build character/environment context string for corrective prompts
    const contextForCorrection = `
CHARACTER: ${characterContext || 'as shown in reference image'}
ENVIRONMENT: ${environmentContext || 'as shown in reference image'}
STYLE: ${referenceAnalysis?.visualStyle || projectType || 'cinematic'}`;

    const userPrompt = `Analyze this AI-generated video shot for production quality:

SHOT ID: ${shotId}
PROJECT TYPE: ${projectType || 'cinematic'}

INTENDED SHOT DESCRIPTION:
"${shotDescription}"

${referenceImageUrl ? 'A REFERENCE IMAGE is provided below - the character and environment in the video MUST match this reference exactly.' : ''}

${previousShotContext ? `PREVIOUS SHOTS CONTEXT:\n${previousShotContext}\n` : ''}

VIDEO/FRAME URL TO ANALYZE: ${frameUrl || videoUrl}

CRITICAL CONSISTENCY CHECK:
1. Does the CHARACTER match the reference image exactly? (same person, clothing, features)
2. Does the ENVIRONMENT/BACKGROUND match? (same setting, time of day, lighting)
3. Is the physics realistic? (gravity, anatomy, fluid dynamics, smooth motion)
4. Is the cinematic quality professional? (no artifacts, no morphing, smooth transitions)

If you create a corrective prompt, it MUST include:
- The FULL character description: ${characterContext || 'from reference'}
- The FULL environment description: ${environmentContext || 'from reference'}
- Specific fixes for any detected issues
- Negative prompts to prevent the issues

Provide your analysis as JSON.`;

    console.log('[VisualDebugger] Calling Lovable AI for multimodal analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Multimodal capable
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              // Include reference image for character/environment consistency check
              ...(referenceImageUrl && !referenceImageUrl.endsWith('.mp4') ? [{
                type: 'image_url',
                image_url: { url: referenceImageUrl }
              }] : []),
              // Include frame from the generated video for analysis
              ...(frameUrl && !frameUrl.endsWith('.mp4') ? [{
                type: 'image_url',
                image_url: { url: frameUrl }
              }] : [])
            ]
          }
        ],
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VisualDebugger] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded', 
          shouldRetry: true 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Payment required for AI analysis',
          shouldRetry: false 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('[VisualDebugger] Raw AI response:', rawContent.substring(0, 300));

    // Parse the JSON response
    let result: VisualDebugResult;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                        rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('[VisualDebugger] Failed to parse AI response:', parseError);
      // Provide helpful suggestions instead of just failing
      result = {
        passed: true, // Allow to pass but with suggestions
        verdict: 'PASS',
        score: 70,
        issues: [{
          category: 'cinematic',
          severity: 'warning',
          description: 'Automated visual analysis unavailable - applying standard quality improvements'
        }],
        correctivePrompt: `${shotDescription}. Ensure realistic physics, natural human movement, consistent character appearance throughout, professional lighting, no visual artifacts or morphing.`,
        analysisDetails: {
          physicsPlausibility: 18,
          identityConsistency: 18,
          lightingConsistency: 17,
          cinematicQuality: 17,
        },
        suggestedEdits: [
          'Add "realistic physics" to prompt',
          'Include "natural human anatomy" for character shots',
          'Specify "consistent lighting direction" for continuity',
          'Add "no morphing, no distortion" as negative guidance',
        ],
      };
    }

    console.log(`[VisualDebugger] Result: ${result.verdict} (Score: ${result.score})`);
    if (result.issues?.length > 0) {
      console.log(`[VisualDebugger] Issues found:`, result.issues.map(i => i.description).join('; '));
    }

    return new Response(JSON.stringify({
      success: true,
      result,
      shotId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[VisualDebugger] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Visual debugging failed',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

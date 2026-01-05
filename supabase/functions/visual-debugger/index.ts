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
  referenceAnalysis?: {
    characterIdentity?: { description: string };
    environment?: { setting: string };
    lighting?: { style: string; direction: string };
    colorPalette?: { mood: string; dominant: string[] };
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
    const { videoUrl, frameUrl, shotDescription, shotId, projectType, referenceAnalysis } = body;

    console.log(`[VisualDebugger] Analyzing shot ${shotId}`);
    console.log(`[VisualDebugger] Video URL: ${videoUrl?.substring(0, 80)}...`);

    // Build reference context for the model
    let referenceContext = '';
    if (referenceAnalysis) {
      referenceContext = `
REFERENCE IMAGE REQUIREMENTS:
- Character: ${referenceAnalysis.characterIdentity?.description || 'Not specified'}
- Environment: ${referenceAnalysis.environment?.setting || 'Not specified'}
- Lighting: ${referenceAnalysis.lighting?.style || 'Not specified'}, Direction: ${referenceAnalysis.lighting?.direction || 'Not specified'}
- Color Palette: ${referenceAnalysis.colorPalette?.mood || 'Not specified'}, Dominant: ${referenceAnalysis.colorPalette?.dominant?.join(', ') || 'Not specified'}
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
2. Adds negative prompts to prevent the issue
3. Reinforces the correct behavior

${referenceContext}

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
  "correctivePrompt": "Only if FAIL - the corrected prompt for retry",
  "analysisDetails": {
    "physicsPlausibility": 0-25,
    "identityConsistency": 0-25,
    "lightingConsistency": 0-25,
    "cinematicQuality": 0-25
  }
}`;

    const userPrompt = `Analyze this AI-generated video shot for production quality:

SHOT ID: ${shotId}
PROJECT TYPE: ${projectType || 'cinematic'}

INTENDED SHOT DESCRIPTION:
"${shotDescription}"

VIDEO/FRAME URL TO ANALYZE: ${frameUrl || videoUrl}

Carefully examine the visual content and evaluate:
1. Does the physics look realistic? (gravity, anatomy, fluid dynamics)
2. Is the character identity consistent with the description?
3. Is the lighting logical and consistent?
4. Is the cinematic quality professional?

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
              // Only include image URLs - videos (.mp4) are not supported for vision
              // The AI will analyze based on the shot description instead
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
      // Return error - don't fake a passing score
      return new Response(JSON.stringify({ 
        error: 'Failed to parse visual analysis. The AI could not analyze this content.',
        success: false,
        result: {
          passed: false,
          verdict: 'FAIL',
          score: 0,
          issues: [{
            category: 'cinematic',
            severity: 'warning',
            description: 'Visual analysis unavailable - manual review recommended'
          }],
          analysisDetails: {
            physicsPlausibility: 0,
            identityConsistency: 0,
            lightingConsistency: 0,
            cinematicQuality: 0,
          },
        },
        shotId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

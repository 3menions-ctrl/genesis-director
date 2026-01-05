import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Shot {
  id: string;
  title: string;
  description: string;
  dialogue?: string;
  durationSeconds: number;
  mood?: string;
  cameraMovement?: string;
}

interface ReferenceImageAnalysis {
  characterIdentity?: {
    description: string;
    facialFeatures: string;
    clothing: string;
    bodyType: string;
    distinctiveMarkers: string[];
  };
  environment?: {
    setting: string;
    geometry: string;
    keyObjects: string[];
  };
  lighting?: {
    style: string;
    direction: string;
    quality: string;
  };
  colorPalette?: {
    dominant: string[];
    mood: string;
  };
  consistencyPrompt?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shots, referenceAnalysis, projectType, title } = await req.json() as {
      shots: Shot[];
      referenceAnalysis?: ReferenceImageAnalysis;
      projectType?: string;
      title?: string;
    };

    if (!shots || shots.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No shots provided for audit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build reference context for identity consistency
    let referenceContext = '';
    if (referenceAnalysis) {
      referenceContext = `
REFERENCE IMAGE ANALYSIS (All shots must maintain consistency with this):
- Character: ${referenceAnalysis.characterIdentity?.description || 'N/A'}
- Face: ${referenceAnalysis.characterIdentity?.facialFeatures || 'N/A'}
- Clothing: ${referenceAnalysis.characterIdentity?.clothing || 'N/A'}
- Environment: ${referenceAnalysis.environment?.setting || 'N/A'}
- Lighting: ${referenceAnalysis.lighting?.style || 'N/A'}, ${referenceAnalysis.lighting?.direction || 'N/A'}
- Color Mood: ${referenceAnalysis.colorPalette?.mood || 'N/A'}
- Consistency Prompt: "${referenceAnalysis.consistencyPrompt || 'N/A'}"
`;
    }

    const systemPrompt = `You are an elite Cinematic Director Agent - a synthesis of legendary filmmakers' techniques and a physics simulation expert. Your role is to audit AI video generation scripts BEFORE production to prevent common AI video failures.

${referenceContext}

## YOUR EXPERTISE INCLUDES:

### FILM TECHNIQUES (from masters like Eisenstein, Hitchcock, Kubrick, Spielberg):
- **Kuleshov Effect**: Juxtaposition of shots to create meaning
- **Match Cuts**: Visual continuity between shots
- **Dutch Angles**: Tilted frames for tension
- **Rule of Thirds**: Composition balance
- **180-Degree Rule**: Spatial continuity
- **Shot/Reverse Shot**: Dialogue scenes
- **Motivated Camera Movement**: Movement with purpose
- **Motivated Lighting**: Light sources that make sense

### PHYSICS PLAUSIBILITY (to prevent AI "morphing" errors):
- **Gravity**: Objects fall correctly, no floating unless intended
- **Fluid Dynamics**: Water, smoke, fabric move naturally
- **Anatomical Motion**: Human/animal movement respects joint limits
- **Inertia**: Objects don't instantly start/stop
- **Scale Consistency**: Objects maintain relative size
- **Shadow Consistency**: Shadows match light sources

### CHARACTER-FIRST PACING (Zero-Waste Premium):
- **1.5-Second Static Scenery Cap**: Any shot without character movement or dialogue MUST be capped at 1.5 seconds maximum
- **Character-Driven Priority**: Every shot should feature character action, expression change, or motivated movement
- **Match-Cut Transitions**: Prefer match-cuts over dissolves to maintain visual momentum
- **4-Second Unit Optimization**: Each 4-second unit must have at least 2.5 seconds of character-driven content
- **Dead Air Elimination**: Flag any shot with >1.5s of static scenery as CRITICAL issue

### IDENTITY CONSISTENCY (critical for multi-shot projects):
- Character appearance must stay identical across shots
- Environment should maintain spatial logic
- Lighting direction should be consistent or motivated to change
- Color palette should remain cohesive

## YOUR TASK:

Analyze each shot description and provide:
1. **Critical Issues**: Problems that will definitely cause AI failures (physics violations, identity drift)
2. **Warnings**: Potential issues that may cause inconsistencies
3. **Suggestions**: Film technique improvements for better visual storytelling
4. **Optimized Prompts**: Rewritten descriptions that are optimized for AI video models

## OUTPUT FORMAT (JSON only):

{
  "overallScore": 85,
  "totalSuggestions": 5,
  "criticalIssues": 1,
  "suggestions": [
    {
      "shotId": "shot_001",
      "severity": "critical|warning|suggestion",
      "category": "technique|physics|continuity|identity",
      "originalText": "...",
      "suggestion": "...",
      "filmTechnique": "Kuleshov Effect",
      "physicsViolation": "gravity violation",
      "rewrittenPrompt": "..."
    }
  ],
  "techniqueAnalysis": {
    "identifiedTechniques": ["match cut", "tracking shot"],
    "recommendedTechniques": ["Kuleshov effect for emotional impact"],
    "narrativeFlow": "The shots build tension effectively..."
  },
  "physicsCheck": {
    "gravityViolations": ["Shot 3: person floating without motivation"],
    "anatomicalIssues": [],
    "fluidDynamicsIssues": [],
    "morphingRisks": ["Shot 5: rapid character movement may cause morphing"]
  },
  "identityCheck": {
    "characterConsistency": true,
    "environmentConsistency": true,
    "lightingConsistency": false,
    "suggestions": ["Shot 4 lighting conflicts with established direction"]
  },
  "optimizedShots": [
    {
      "shotId": "shot_001",
      "originalDescription": "...",
      "optimizedDescription": "...",
      "identityAnchors": ["same woman from reference", "red dress"],
      "physicsGuards": ["no floating", "natural movement"],
      "approved": true
    }
  ]
}`;

    const shotsDescription = shots.map((shot, idx) => 
      `Shot ${idx + 1} (${shot.id}): ${shot.title}
       Description: ${shot.description}
       Dialogue: ${shot.dialogue || 'None'}
       Duration: ${shot.durationSeconds}s
       Mood: ${shot.mood || 'neutral'}
       Camera: ${shot.cameraMovement || 'static'}`
    ).join('\n\n');

    const userPrompt = `Audit this ${projectType || 'video'} script titled "${title || 'Untitled'}":

${shotsDescription}

Analyze each shot for:
1. Physics plausibility (will AI struggle with this?)
2. Identity consistency (does character/environment stay consistent?)
3. Film technique opportunities (how can we make this more cinematic?)
4. Prompt optimization (rewrite descriptions for better AI video generation)

Return ONLY valid JSON matching the specified format.`;

    console.log('[cinematic-auditor] Auditing', shots.length, 'shots with reference:', !!referenceAnalysis);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Use Pro model for complex analysis
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[cinematic-auditor] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let auditResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        auditResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('[cinematic-auditor] JSON parse error:', parseErr, 'Content:', content.substring(0, 500));
      // Return error state - don't fake a passing score
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse audit response. Please try again.',
          rawContent: content.substring(0, 1000),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure optimizedShots covers all input shots
    if (!auditResult.optimizedShots || auditResult.optimizedShots.length < shots.length) {
      auditResult.optimizedShots = shots.map(shot => {
        const existing = auditResult.optimizedShots?.find((o: any) => o.shotId === shot.id);
        return existing || {
          shotId: shot.id,
          originalDescription: shot.description,
          optimizedDescription: shot.description,
          identityAnchors: referenceAnalysis?.consistencyPrompt ? [referenceAnalysis.consistencyPrompt] : [],
          physicsGuards: ['natural movement', 'consistent scale'],
          approved: true,
        };
      });
    }

    console.log('[cinematic-auditor] Audit complete:', {
      score: auditResult.overallScore,
      suggestions: auditResult.totalSuggestions,
      critical: auditResult.criticalIssues,
    });

    return new Response(
      JSON.stringify({ 
        audit: {
          auditComplete: true,
          ...auditResult,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cinematic-auditor] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

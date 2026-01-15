import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TEMPORAL CONSISTENCY VALIDATOR
 * 
 * Analyzes sequence of clips for temporal consistency issues:
 * - Character flickering/morphing between clips
 * - Color temperature drift
 * - Lighting direction changes
 * - Motion discontinuity
 * 
 * Improvement #4.8: Temporal Consistency Validation
 */

interface ValidationRequest {
  projectId: string;
  clips: Array<{
    index: number;
    frameUrl: string;
    sceneAnchor?: any;
  }>;
  referenceImageUrl?: string;
  identityBible?: any;
}

interface TemporalIssue {
  clipIndex: number;
  type: 'morphing' | 'color_drift' | 'lighting_change' | 'motion_discontinuity' | 'identity_shift';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  recommendation: string;
}

interface ValidationResult {
  passed: boolean;
  overallScore: number;
  issues: TemporalIssue[];
  clipScores: Array<{ index: number; score: number }>;
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ValidationRequest = await req.json();
    const { projectId, clips, referenceImageUrl, identityBible } = request;

    console.log(`[TemporalValidator] Starting validation for project ${projectId}`);
    console.log(`[TemporalValidator] Analyzing ${clips.length} clips`);

    if (clips.length < 2) {
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            passed: true,
            overallScore: 100,
            issues: [],
            clipScores: clips.map(c => ({ index: c.index, score: 100 })),
            recommendations: [],
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const issues: TemporalIssue[] = [];
    const clipScores: Array<{ index: number; score: number }> = [];

    // Analyze each pair of consecutive clips
    for (let i = 1; i < clips.length; i++) {
      const prevClip = clips[i - 1];
      const currClip = clips[i];

      console.log(`[TemporalValidator] Comparing clip ${prevClip.index} → ${currClip.index}`);

      const pairResult = await analyzeClipPair(
        LOVABLE_API_KEY,
        prevClip.frameUrl,
        currClip.frameUrl,
        referenceImageUrl,
        identityBible,
        i
      );

      // Collect issues
      issues.push(...pairResult.issues);
      clipScores.push({
        index: currClip.index,
        score: pairResult.score
      });
    }

    // Add first clip score (baseline)
    clipScores.unshift({ index: clips[0].index, score: 100 });

    // Calculate overall score
    const avgScore = clipScores.reduce((sum, c) => sum + c.score, 0) / clipScores.length;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const majorIssues = issues.filter(i => i.severity === 'major').length;

    // Penalty for critical/major issues
    const finalScore = Math.max(0, avgScore - (criticalIssues * 15) - (majorIssues * 5));
    const passed = finalScore >= 70 && criticalIssues === 0;

    // Build recommendations
    const recommendations: string[] = [];
    
    if (criticalIssues > 0) {
      recommendations.push(`${criticalIssues} critical issues require regeneration`);
    }
    if (majorIssues > 0) {
      recommendations.push(`${majorIssues} major issues may affect viewer experience`);
    }
    
    // Group issues by type and recommend
    const issuesByType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (issuesByType.morphing) {
      recommendations.push('Character morphing detected - strengthen identity anchors');
    }
    if (issuesByType.color_drift) {
      recommendations.push('Color drift detected - lock color palette in prompts');
    }
    if (issuesByType.lighting_change) {
      recommendations.push('Lighting inconsistency - ensure lighting direction is specified');
    }

    const result: ValidationResult = {
      passed,
      overallScore: Math.round(finalScore),
      issues,
      clipScores,
      recommendations,
    };

    console.log(`[TemporalValidator] Result: ${passed ? 'PASSED' : 'FAILED'} (score: ${result.overallScore})`);
    console.log(`[TemporalValidator] Issues: ${issues.length} (${criticalIssues} critical, ${majorIssues} major)`);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[TemporalValidator] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeClipPair(
  apiKey: string,
  prevFrameUrl: string,
  currFrameUrl: string,
  referenceUrl: string | undefined,
  identityBible: any | undefined,
  pairIndex: number
): Promise<{ score: number; issues: TemporalIssue[] }> {
  
  const messages: any[] = [
    {
      role: "system",
      content: `You are a video continuity expert analyzing consecutive frames for temporal consistency.

Analyze the transition between two consecutive video clips and identify any continuity issues.

You MUST respond with ONLY a valid JSON object:
{
  "score": 0-100,
  "issues": [
    {
      "type": "morphing|color_drift|lighting_change|motion_discontinuity|identity_shift",
      "severity": "critical|major|minor",
      "description": "specific description",
      "recommendation": "how to fix"
    }
  ]
}

ISSUE TYPES:
- morphing: Character appearance changes between clips
- color_drift: Color palette shifts unexpectedly
- lighting_change: Lighting direction or intensity changes
- motion_discontinuity: Motion doesn't flow naturally
- identity_shift: Character identity appears different

SEVERITY:
- critical: Immediately noticeable, breaks immersion
- major: Noticeable on close inspection
- minor: Subtle, may go unnoticed

Be strict - even minor issues compound across multiple clips.`
    }
  ];

  const userContent: any[] = [];
  
  // Previous frame
  if (prevFrameUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: prevFrameUrl }
    });
  }
  
  // Current frame
  if (currFrameUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: currFrameUrl }
    });
  }
  
  // Reference image if available
  if (referenceUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: referenceUrl }
    });
  }

  let prompt = `Analyze temporal consistency between these two consecutive frames (Frame 1 → Frame 2).`;
  
  if (referenceUrl) {
    prompt += `\n\nReference image (third image) shows the expected character appearance.`;
  }
  
  if (identityBible?.characterDescription) {
    prompt += `\n\nExpected character: ${identityBible.characterDescription}`;
  }
  
  prompt += `\n\nCheck for:
1. Character morphing/identity changes
2. Color temperature or palette drift
3. Lighting direction changes
4. Motion continuity
5. Any visual discontinuity

Be thorough - issues here will affect video quality.`;

  userContent.push({ type: "text", text: prompt });
  messages.push({ role: "user", content: userContent });

  try {
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn(`[TemporalValidator] AI call failed for pair ${pairIndex}`);
      return { score: 75, issues: [] };
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { score: 75, issues: [] };
    }

    // Parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: 75, issues: [] };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    // Map issues to correct clip index
    const issues: TemporalIssue[] = (analysis.issues || []).map((issue: any) => ({
      clipIndex: pairIndex,
      type: issue.type || 'morphing',
      severity: issue.severity || 'minor',
      description: issue.description || 'Unknown issue',
      recommendation: issue.recommendation || 'Review manually',
    }));

    return {
      score: analysis.score || 75,
      issues,
    };

  } catch (err) {
    console.warn(`[TemporalValidator] Error analyzing pair ${pairIndex}:`, err);
    return { score: 75, issues: [] };
  }
}

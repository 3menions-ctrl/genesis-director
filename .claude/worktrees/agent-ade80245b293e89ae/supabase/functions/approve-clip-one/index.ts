import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * FORCED CLIP 1 APPROVAL
 * 
 * Analyzes Clip 1 to ensure it meets quality threshold before allowing pipeline to continue.
 * This is MANDATORY - if Clip 1 fails, the entire video will have consistency issues.
 * 
 * Improvement #2.2: Forced First Frame Approval
 */

interface ApprovalRequest {
  projectId: string;
  clipUrl: string;
  frameUrl: string;
  referenceImageUrl?: string;
  identityBible?: any;
  minScore?: number;
}

interface ApprovalResult {
  approved: boolean;
  score: number;
  checks: {
    characterMatch: { passed: boolean; score: number; details: string };
    colorQuality: { passed: boolean; score: number; details: string };
    lightingQuality: { passed: boolean; score: number; details: string };
    compositionQuality: { passed: boolean; score: number; details: string };
    technicalQuality: { passed: boolean; score: number; details: string };
  };
  recommendations: string[];
  canProceed: boolean;
  mustRetry: boolean;
  retryGuidance?: string;
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

    const request: ApprovalRequest = await req.json();
    const { frameUrl, referenceImageUrl, identityBible, minScore = 75 } = request;

    console.log(`[Clip1Approval] Starting approval check for project ${request.projectId}`);
    console.log(`[Clip1Approval] Frame: ${frameUrl?.substring(0, 60)}...`);
    console.log(`[Clip1Approval] Reference: ${referenceImageUrl?.substring(0, 60) || 'none'}`);
    console.log(`[Clip1Approval] Min score required: ${minScore}`);

    // Use Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build analysis prompt
    const analysisPrompt = buildAnalysisPrompt(referenceImageUrl, identityBible);

    // Prepare messages with images
    const messages: any[] = [
      {
        role: "system",
        content: `You are a professional video quality analyst. Your job is to evaluate the first clip of a video project and determine if it meets the quality threshold to establish visual DNA for subsequent clips.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation), using this exact structure:
{
  "characterMatch": { "score": 0-100, "details": "string" },
  "colorQuality": { "score": 0-100, "details": "string" },
  "lightingQuality": { "score": 0-100, "details": "string" },
  "compositionQuality": { "score": 0-100, "details": "string" },
  "technicalQuality": { "score": 0-100, "details": "string" },
  "recommendations": ["string array of improvements"],
  "retryGuidance": "string - specific guidance if retry needed"
}`
      }
    ];

    // Add frame image
    const userContent: any[] = [];
    
    if (frameUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: frameUrl }
      });
    }
    
    if (referenceImageUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: referenceImageUrl }
      });
    }
    
    userContent.push({
      type: "text",
      text: analysisPrompt
    });

    messages.push({ role: "user", content: userContent });

    // Call Lovable AI
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Clip1Approval] AI API error: ${response.status} - ${errorText}`);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty AI response");
    }

    // Parse JSON response
    let analysis: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      console.error(`[Clip1Approval] Parse error:`, parseErr);
      console.error(`[Clip1Approval] Raw content:`, content);
      
      // Return conservative result
      analysis = {
        characterMatch: { score: 70, details: "Analysis failed - conservative score" },
        colorQuality: { score: 75, details: "Analysis failed - conservative score" },
        lightingQuality: { score: 75, details: "Analysis failed - conservative score" },
        compositionQuality: { score: 75, details: "Analysis failed - conservative score" },
        technicalQuality: { score: 75, details: "Analysis failed - conservative score" },
        recommendations: ["Manual review recommended"],
        retryGuidance: "Consider regenerating if quality issues are visible"
      };
    }

    // Calculate overall score
    const scores = [
      analysis.characterMatch?.score || 0,
      analysis.colorQuality?.score || 0,
      analysis.lightingQuality?.score || 0,
      analysis.compositionQuality?.score || 0,
      analysis.technicalQuality?.score || 0,
    ];
    
    // Weighted average (character match is most important)
    const overallScore = Math.round(
      (scores[0] * 2 + scores[1] + scores[2] + scores[3] + scores[4]) / 6
    );

    // Determine approval
    const characterPassed = (analysis.characterMatch?.score || 0) >= 70;
    const overallPassed = overallScore >= minScore;
    const approved = characterPassed && overallPassed;

    const result: ApprovalResult = {
      approved,
      score: overallScore,
      checks: {
        characterMatch: {
          passed: (analysis.characterMatch?.score || 0) >= 70,
          score: analysis.characterMatch?.score || 0,
          details: analysis.characterMatch?.details || "Unknown",
        },
        colorQuality: {
          passed: (analysis.colorQuality?.score || 0) >= 65,
          score: analysis.colorQuality?.score || 0,
          details: analysis.colorQuality?.details || "Unknown",
        },
        lightingQuality: {
          passed: (analysis.lightingQuality?.score || 0) >= 65,
          score: analysis.lightingQuality?.score || 0,
          details: analysis.lightingQuality?.details || "Unknown",
        },
        compositionQuality: {
          passed: (analysis.compositionQuality?.score || 0) >= 60,
          score: analysis.compositionQuality?.score || 0,
          details: analysis.compositionQuality?.details || "Unknown",
        },
        technicalQuality: {
          passed: (analysis.technicalQuality?.score || 0) >= 65,
          score: analysis.technicalQuality?.score || 0,
          details: analysis.technicalQuality?.details || "Unknown",
        },
      },
      recommendations: analysis.recommendations || [],
      canProceed: approved,
      mustRetry: !approved && overallScore < 60,
      retryGuidance: approved ? undefined : analysis.retryGuidance,
    };

    console.log(`[Clip1Approval] Result: ${approved ? 'APPROVED' : 'REJECTED'} (score: ${overallScore})`);
    if (!approved) {
      console.log(`[Clip1Approval] Failed checks:`, 
        Object.entries(result.checks)
          .filter(([_, v]) => !v.passed)
          .map(([k, v]) => `${k}: ${v.score}`)
          .join(', ')
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Clip1Approval] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAnalysisPrompt(referenceImageUrl?: string, identityBible?: any): string {
  let prompt = `Analyze this video frame for quality and consistency.

EVALUATION CRITERIA:`;

  if (referenceImageUrl) {
    prompt += `

CHARACTER MATCH (vs reference image):
- Does the character match the reference image?
- Are facial features consistent?
- Is clothing/outfit the same?
- Are colors accurate?`;
  }

  if (identityBible?.characterDescription) {
    prompt += `

Expected character: ${identityBible.characterDescription}`;
  }

  prompt += `

COLOR QUALITY:
- Are colors rich and saturated?
- Is the color palette cohesive?
- Any washed out or muddy colors?

LIGHTING QUALITY:
- Is lighting consistent and professional?
- Are shadows natural and appropriate?
- Is exposure correct?

COMPOSITION QUALITY:
- Is the framing appropriate?
- Is the subject positioned well?
- Does it look cinematic?

TECHNICAL QUALITY:
- Is the image sharp and clear?
- Any artifacts or distortion?
- Is resolution acceptable?

Score each category 0-100 and provide specific details.
This is CLIP 1 - it will establish the visual DNA for all subsequent clips.
Be strict - issues here will propagate to the entire video.`;

  return prompt;
}

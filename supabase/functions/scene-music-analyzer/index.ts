import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SCENE MUSIC ANALYZER
 * 
 * AI-powered analysis of scene content to determine optimal music scoring.
 * Analyzes dialogue, action, emotion, and visual elements to recommend
 * the perfect Hans Zimmer-level score.
 */

interface SceneAnalysisRequest {
  sceneDescription: string;
  dialogueContent?: string;
  visualElements?: string[];
  previousSceneMood?: string;
  targetAudience?: string;
  projectGenre?: string;
}

interface MusicRecommendation {
  mood: string;
  genre: string;
  sceneType: string;
  intensity: 'subtle' | 'moderate' | 'intense' | 'explosive';
  tempo: 'slow' | 'moderate' | 'fast' | 'variable';
  referenceComposer: string;
  emotionalArc: string;
  instrumentFocus: string[];
  customPromptEnhancement: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const request: SceneAnalysisRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      // Fallback to rule-based analysis
      return new Response(
        JSON.stringify(analyzeSceneRuleBased(request)),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SceneMusicAnalyzer] Analyzing scene for optimal music scoring...");

    const systemPrompt = `You are a world-class film music supervisor with 30 years experience working with Hans Zimmer, John Williams, and other legendary composers.

Your task: Analyze the scene and recommend the PERFECT music scoring approach.

Consider:
1. EMOTIONAL CORE - What is the primary emotion? What undertones exist?
2. PACING - Is the scene slow contemplation or rapid action?
3. CHARACTER FOCUS - Who is central? What's their emotional state?
4. NARRATIVE FUNCTION - Climax? Setup? Resolution? Transition?
5. VISUAL RHYTHM - Match the editing pace and camera movement
6. GENRE EXPECTATIONS - What does the audience expect? Subvert or fulfill?
7. THEMATIC CONNECTIONS - Does this connect to earlier themes?

You must respond with a JSON object containing your music recommendation.`;

    const userPrompt = `Analyze this scene and recommend music scoring:

SCENE DESCRIPTION:
${request.sceneDescription}

${request.dialogueContent ? `DIALOGUE:\n${request.dialogueContent}` : ''}

${request.visualElements?.length ? `VISUAL ELEMENTS:\n${request.visualElements.join(', ')}` : ''}

${request.previousSceneMood ? `PREVIOUS SCENE MOOD: ${request.previousSceneMood}` : ''}

${request.projectGenre ? `PROJECT GENRE: ${request.projectGenre}` : ''}

Respond with a JSON object:
{
  "mood": "epic|emotional|tension|action|mysterious|romantic|dark|uplifting|horror|comedy|cinematic",
  "genre": "orchestral|electronic|hybrid|minimal|piano|acoustic|choral|percussive",
  "sceneType": "epic-battle|emotional-revelation|tension-suspense|romantic-love|adventure-journey|horror-dread|sci-fi-wonder|action-chase|mystery-intrigue|triumph-victory|melancholy-loss|comedy-playful",
  "intensity": "subtle|moderate|intense|explosive",
  "tempo": "slow|moderate|fast|variable",
  "referenceComposer": "hans-zimmer|john-williams|ennio-morricone|howard-shore|thomas-newman|alexandre-desplat|ludwig-goransson|ramin-djawadi",
  "emotionalArc": "description of how emotion should build/release",
  "instrumentFocus": ["primary instrument", "secondary instrument"],
  "customPromptEnhancement": "specific additional prompt details for this scene",
  "confidence": 0.0-1.0
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("[SceneMusicAnalyzer] AI request failed, using rule-based fallback");
      return new Response(
        JSON.stringify(analyzeSceneRuleBased(request)),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify(analyzeSceneRuleBased(request)),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recommendation: MusicRecommendation = JSON.parse(jsonMatch[0]);
    
    console.log("[SceneMusicAnalyzer] ✅ AI analysis complete:", recommendation.mood, recommendation.sceneType);

    return new Response(
      JSON.stringify({
        success: true,
        recommendation,
        analysisMethod: 'ai',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SceneMusicAnalyzer] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Rule-based fallback analysis
function analyzeSceneRuleBased(request: SceneAnalysisRequest): {
  success: boolean;
  recommendation: MusicRecommendation;
  analysisMethod: string;
} {
  const description = request.sceneDescription.toLowerCase();
  
  // Detect scene type and mood from keywords
  let mood = 'cinematic';
  let sceneType = 'adventure-journey';
  let intensity: 'subtle' | 'moderate' | 'intense' | 'explosive' = 'moderate';
  let tempo: 'slow' | 'moderate' | 'fast' | 'variable' = 'moderate';
  let referenceComposer = 'hans-zimmer';
  let instrumentFocus: string[] = ['strings', 'brass'];

  // Battle/Action detection
  if (description.match(/battle|fight|war|combat|explosion|chase|attack/)) {
    mood = 'action';
    sceneType = 'epic-battle';
    intensity = 'explosive';
    tempo = 'fast';
    instrumentFocus = ['brass', 'percussion', 'strings'];
  }
  // Romance detection
  else if (description.match(/love|kiss|romance|wedding|together|embrace/)) {
    mood = 'romantic';
    sceneType = 'romantic-love';
    intensity = 'moderate';
    tempo = 'slow';
    referenceComposer = 'john-williams';
    instrumentFocus = ['strings', 'piano', 'harp'];
  }
  // Horror/Tension detection
  else if (description.match(/horror|scary|dark|monster|death|blood|fear|creep/)) {
    mood = 'horror';
    sceneType = 'horror-dread';
    intensity = 'intense';
    tempo = 'slow';
    instrumentFocus = ['strings', 'prepared piano', 'choir'];
  }
  // Emotional/Sad detection
  else if (description.match(/cry|sad|funeral|loss|goodbye|death|tragic|tears/)) {
    mood = 'emotional';
    sceneType = 'melancholy-loss';
    intensity = 'subtle';
    tempo = 'slow';
    referenceComposer = 'thomas-newman';
    instrumentFocus = ['piano', 'cello', 'strings'];
  }
  // Mystery detection
  else if (description.match(/mystery|detective|clue|secret|discover|hidden/)) {
    mood = 'mysterious';
    sceneType = 'mystery-intrigue';
    intensity = 'subtle';
    tempo = 'moderate';
    instrumentFocus = ['clarinet', 'muted brass', 'vibraphone'];
  }
  // Triumph/Victory detection
  else if (description.match(/victory|triumph|win|celebration|success|hero/)) {
    mood = 'uplifting';
    sceneType = 'triumph-victory';
    intensity = 'explosive';
    tempo = 'moderate';
    referenceComposer = 'john-williams';
    instrumentFocus = ['brass', 'choir', 'strings'];
  }
  // Sci-fi detection
  else if (description.match(/space|future|robot|alien|technology|cyber/)) {
    mood = 'scifi';
    sceneType = 'sci-fi-wonder';
    intensity = 'moderate';
    tempo = 'moderate';
    instrumentFocus = ['synthesizers', 'processed orchestra', 'electronic'];
  }
  // Comedy detection
  else if (description.match(/funny|comedy|laugh|joke|silly|playful/)) {
    mood = 'comedy';
    sceneType = 'comedy-playful';
    intensity = 'subtle';
    tempo = 'fast';
    referenceComposer = 'alexandre-desplat';
    instrumentFocus = ['woodwinds', 'pizzicato strings', 'xylophone'];
  }

  return {
    success: true,
    recommendation: {
      mood,
      genre: 'orchestral',
      sceneType,
      intensity,
      tempo,
      referenceComposer,
      emotionalArc: `Building ${mood} atmosphere with ${intensity} intensity`,
      instrumentFocus,
      customPromptEnhancement: `Scene depicts: ${request.sceneDescription.substring(0, 100)}`,
      confidence: 0.75,
    },
    analysisMethod: 'rule-based',
  };
}

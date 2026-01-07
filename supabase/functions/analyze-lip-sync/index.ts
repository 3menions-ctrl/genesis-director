import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phoneme to Viseme mapping
const PHONEME_TO_VISEME: Record<string, string> = {
  'SIL': 'sil', 'sp': 'sil', 'spn': 'sil',
  'P': 'PP', 'B': 'PP', 'M': 'PP',
  'F': 'FF', 'V': 'FF',
  'TH': 'TH', 'DH': 'TH',
  'T': 'DD', 'D': 'DD', 'N': 'DD', 'L': 'DD',
  'K': 'kk', 'G': 'kk', 'NG': 'nn',
  'CH': 'CH', 'JH': 'CH', 'SH': 'CH', 'ZH': 'CH',
  'S': 'SS', 'Z': 'SS',
  'R': 'RR', 'ER': 'RR',
  'AA': 'aa', 'AE': 'aa', 'AH': 'aa', 'AO': 'O',
  'AW': 'O', 'AY': 'aa', 'EH': 'E', 'EY': 'E',
  'IH': 'I', 'IY': 'I', 'OW': 'O', 'OY': 'O',
  'UH': 'U', 'UW': 'U', 'Y': 'I', 'W': 'U', 'HH': 'aa'
};

const VISEME_DESCRIPTIONS: Record<string, string> = {
  'sil': 'closed relaxed mouth',
  'PP': 'lips pressed together then released',
  'FF': 'lower lip tucked under upper teeth',
  'TH': 'tongue slightly visible between teeth',
  'DD': 'tongue touching upper palate, mouth slightly open',
  'kk': 'back of tongue raised, mouth slightly open',
  'CH': 'lips rounded and pushed forward',
  'SS': 'teeth together, lips slightly parted',
  'nn': 'mouth slightly open, tongue at roof',
  'RR': 'lips slightly rounded, tongue curved',
  'aa': 'mouth wide open, jaw dropped',
  'E': 'mouth medium open, lips stretched wide',
  'I': 'mouth slightly open, lips stretched in smile',
  'O': 'lips rounded into circle',
  'U': 'lips pursed and pushed forward'
};

const EMOTION_MODIFIERS: Record<string, string> = {
  'neutral': 'natural relaxed expression',
  'happy': 'slight smile, upturned corners',
  'sad': 'downturned corners, slightly compressed',
  'angry': 'tight lips, tense jaw',
  'surprised': 'mouth slightly open, raised eyebrows',
  'fearful': 'lips pulled back, tense expression'
};

interface VisemeTiming {
  viseme: string;
  startTime: number;
  endTime: number;
  confidence: number;
  phoneme?: string;
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  visemes: VisemeTiming[];
}

interface SpeakingSegment {
  characterId: string;
  characterName: string;
  dialogue: string;
  startTime: number;
  endTime: number;
  words: WordTiming[];
  emotion?: string;
}

// Get OAuth2 access token for Google Cloud
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Estimate visemes from text when audio analysis isn't available
function estimateVisemesFromText(text: string, startOffset: number = 0): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordTimings: WordTiming[] = [];
  let currentTime = startOffset;
  const avgWordDuration = 0.35;
  const pauseBetweenWords = 0.08;

  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const chars = cleanWord.split('');
    const wordDuration = avgWordDuration * (0.8 + chars.length * 0.05);
    const charDuration = wordDuration / Math.max(chars.length, 1);
    
    const visemes: VisemeTiming[] = [];
    let charTime = currentTime;

    for (const char of chars) {
      const viseme = mapCharToViseme(char);
      visemes.push({
        viseme,
        startTime: charTime,
        endTime: charTime + charDuration,
        confidence: 0.75
      });
      charTime += charDuration;
    }

    wordTimings.push({
      word: word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
      visemes
    });

    currentTime += wordDuration + pauseBetweenWords;
  }

  return wordTimings;
}

function mapCharToViseme(char: string): string {
  const mapping: Record<string, string> = {
    'a': 'aa', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
    'b': 'PP', 'p': 'PP', 'm': 'PP',
    'f': 'FF', 'v': 'FF',
    't': 'DD', 'd': 'DD', 'n': 'DD', 'l': 'DD',
    'k': 'kk', 'g': 'kk', 'c': 'kk', 'q': 'kk',
    's': 'SS', 'z': 'SS', 'x': 'SS',
    'r': 'RR',
    'w': 'U', 'y': 'I',
    'h': 'aa', 'j': 'CH'
  };
  return mapping[char] || 'sil';
}

// Use Gemini to analyze dialogue and extract timing/emotion
async function analyzeDialogueWithGemini(
  accessToken: string,
  dialogue: string,
  characterName: string,
  context?: string
): Promise<{ emotion: string; emphasis: string[]; pacing: string }> {
  type DialogueAnalysis = { emotion: string; emphasis: string[]; pacing: string };
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || 'gen-lang-client-0756492587';
  
  const prompt = `Analyze this dialogue for lip sync and emotional delivery:

Character: ${characterName}
Dialogue: "${dialogue}"
${context ? `Context: ${context}` : ''}

Respond with JSON only:
{
  "emotion": "neutral|happy|sad|angry|surprised|fearful",
  "emphasis": ["list", "of", "emphasized", "words"],
  "pacing": "slow|normal|fast|varied"
}`;

  try {
    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini analysis failed:', await response.text());
      return { emotion: 'neutral', emphasis: [], pacing: 'normal' };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Dialogue analysis error:', error);
  }

  return { emotion: 'neutral', emphasis: [], pacing: 'normal' };
}

// Generate lip sync prompt enhancement
function generateLipSyncPrompt(segments: SpeakingSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  const prompts: string[] = [];
  
  for (const segment of segments) {
    const { characterName, emotion, words } = segment;
    
    // Get dominant visemes
    const visemeCounts = new Map<string, number>();
    for (const word of words) {
      for (const timing of word.visemes) {
        if (timing.viseme !== 'sil') {
          visemeCounts.set(timing.viseme, (visemeCounts.get(timing.viseme) || 0) + 1);
        }
      }
    }
    
    const dominantVisemes = Array.from(visemeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([v]) => v);
    
    const visemeDescriptions = dominantVisemes
      .map(v => VISEME_DESCRIPTIONS[v])
      .filter(Boolean)
      .join(', ');
    
    const emotionMod = EMOTION_MODIFIERS[emotion || 'neutral'] || EMOTION_MODIFIERS['neutral'];
    
    prompts.push(
      `${characterName} speaking with ${emotionMod}, ` +
      `mouth movements showing ${visemeDescriptions}, ` +
      `lips synchronized to dialogue with natural articulation`
    );
  }
  
  return prompts.join('. ') + '. Ensure realistic mouth movements and jaw motion throughout speech, with proper lip shapes for vowels and consonants.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      shotId,
      dialogue,
      characterId,
      characterName,
      audioUrl,
      shotDuration = 5,
      context,
      emotion: providedEmotion
    } = await req.json();

    console.log(`[Lip Sync] Analyzing shot ${shotId} for character ${characterName}`);
    console.log(`[Lip Sync] Dialogue: "${dialogue?.substring(0, 100)}..."`);

    if (!dialogue || dialogue.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            shotId,
            hasDialogue: false,
            speakingSegments: [],
            totalDuration: shotDuration,
            lipSyncPromptEnhancement: ''
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token for Gemini
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
    let analysisResult: { emotion: string; emphasis: string[]; pacing: string } = { emotion: 'neutral', emphasis: [], pacing: 'normal' };

    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        const accessToken = await getAccessToken(serviceAccount);
        
        // Analyze dialogue for emotion and pacing
        analysisResult = await analyzeDialogueWithGemini(
          accessToken,
          dialogue,
          characterName,
          context
        );
        console.log(`[Lip Sync] Gemini analysis:`, analysisResult);
      } catch (error) {
        console.error('[Lip Sync] Gemini analysis failed:', error);
      }
    }

    const emotion = providedEmotion || analysisResult.emotion;

    // Generate word timings with visemes
    const words = estimateVisemesFromText(dialogue, 0.2);
    
    // Adjust timing based on pacing
    const pacingMultiplier = 
      analysisResult.pacing === 'slow' ? 1.3 :
      analysisResult.pacing === 'fast' ? 0.75 : 1.0;

    const adjustedWords = words.map(word => ({
      ...word,
      startTime: word.startTime * pacingMultiplier,
      endTime: word.endTime * pacingMultiplier,
      visemes: word.visemes.map(v => ({
        ...v,
        startTime: v.startTime * pacingMultiplier,
        endTime: v.endTime * pacingMultiplier
      }))
    }));

    const lastWord = adjustedWords[adjustedWords.length - 1];
    const calculatedDuration = lastWord ? lastWord.endTime + 0.3 : 0;

    const speakingSegment: SpeakingSegment = {
      characterId: characterId || 'unknown',
      characterName: characterName || 'Character',
      dialogue,
      startTime: 0.2,
      endTime: calculatedDuration,
      words: adjustedWords,
      emotion
    };

    const lipSyncPromptEnhancement = generateLipSyncPrompt([speakingSegment]);

    console.log(`[Lip Sync] Generated ${adjustedWords.length} word timings`);
    console.log(`[Lip Sync] Prompt enhancement: ${lipSyncPromptEnhancement.substring(0, 150)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          shotId,
          hasDialogue: true,
          speakingSegments: [speakingSegment],
          totalDuration: Math.max(shotDuration, calculatedDuration),
          dominantSpeaker: characterName,
          lipSyncPromptEnhancement
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Lip Sync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Lip sync analysis failed';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

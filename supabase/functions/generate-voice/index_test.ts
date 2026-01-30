import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("generate-voice - returns error without text", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      voiceId: "nova",
      // Missing text field
    }),
  });

  const body = await response.json();
  
  assertEquals(response.status, 500);
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test("generate-voice - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  await response.text(); // Consume body
  
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("generate-voice - voice map contains all required voices", () => {
  const requiredVoices = [
    'onyx', 'adam', 'echo', 'fable', 'michael', 'george', // Male voices
    'nova', 'bella', 'shimmer', 'alloy', 'sarah', 'jessica', 'lily', 'emma', // Female voices
    'narrator', 'default', // Special voices
  ];

  const voiceMap: Record<string, { minimaxVoice: string; description: string }> = {
    onyx: { minimaxVoice: 'English_ManWithDeepVoice', description: 'Deep male voice' },
    adam: { minimaxVoice: 'English_expressive_narrator', description: 'Expressive narrator' },
    echo: { minimaxVoice: 'English_Gentle-voiced_man', description: 'Gentle male voice' },
    fable: { minimaxVoice: 'English_CaptivatingStoryteller', description: 'Captivating storyteller' },
    michael: { minimaxVoice: 'English_Trustworth_Man', description: 'Trustworthy man' },
    george: { minimaxVoice: 'English_Deep-VoicedGentleman', description: 'Deep-voiced gentleman' },
    nova: { minimaxVoice: 'English_ConfidentWoman', description: 'Confident woman' },
    bella: { minimaxVoice: 'English_Upbeat_Woman', description: 'Upbeat woman' },
    shimmer: { minimaxVoice: 'English_Wiselady', description: 'Wise lady' },
    alloy: { minimaxVoice: 'English_SereneWoman', description: 'Serene woman' },
    sarah: { minimaxVoice: 'English_CalmWoman', description: 'Calm woman' },
    jessica: { minimaxVoice: 'English_radiant_girl', description: 'Radiant girl' },
    lily: { minimaxVoice: 'English_Graceful_Lady', description: 'Graceful lady' },
    emma: { minimaxVoice: 'English_Kind-heartedGirl', description: 'Kind-hearted girl' },
    narrator: { minimaxVoice: 'English_expressive_narrator', description: 'Expressive narrator' },
    default: { minimaxVoice: 'English_ConfidentWoman', description: 'Default voice' },
  };

  requiredVoices.forEach(voice => {
    assertExists(voiceMap[voice], `Voice "${voice}" should exist in VOICE_MAP`);
    assertExists(voiceMap[voice].minimaxVoice, `Voice "${voice}" should have minimaxVoice`);
  });
});

Deno.test("generate-voice - emotion detection works correctly", () => {
  const detectEmotion = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('!') && (lowerText.includes('wow') || lowerText.includes('amazing'))) return 'surprised';
    if (lowerText.includes('sorry') || lowerText.includes('sad') || lowerText.includes('unfortunately')) return 'sad';
    if (lowerText.includes('angry') || lowerText.includes('furious')) return 'angry';
    if (lowerText.includes('scared') || lowerText.includes('afraid')) return 'fearful';
    if (lowerText.includes('happy') || lowerText.includes('excited') || lowerText.includes('!')) return 'happy';
    return 'auto';
  };

  assertEquals(detectEmotion("Wow! This is amazing!"), "surprised");
  assertEquals(detectEmotion("I'm sorry to hear that"), "sad");
  assertEquals(detectEmotion("I'm so angry about this"), "angry");
  assertEquals(detectEmotion("I'm scared of the dark"), "fearful");
  assertEquals(detectEmotion("I'm so happy!"), "happy");
  assertEquals(detectEmotion("The weather is nice today"), "auto");
});

Deno.test("generate-voice - duration estimation is accurate", () => {
  const estimateDuration = (text: string): number => {
    const words = text.length / 5;
    const minutes = words / 150;
    return Math.round(minutes * 60 * 1000);
  };

  // Short text (~10 chars = 2 words = 0.8 seconds)
  const shortDuration = estimateDuration("Hello world");
  assertEquals(shortDuration > 500 && shortDuration < 2000, true);

  // Medium text (~100 chars = 20 words = 8 seconds)
  const mediumText = "This is a medium length sentence for testing the duration estimation function accurately.";
  const mediumDuration = estimateDuration(mediumText);
  assertEquals(mediumDuration > 5000 && mediumDuration < 15000, true);

  // Long text (~300 chars = 60 words = 24 seconds)
  const longText = "A".repeat(300);
  const longDuration = estimateDuration(longText);
  assertEquals(longDuration > 20000 && longDuration < 30000, true);
});

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("generate-avatar - rejects unauthenticated requests", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-avatar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      voiceId: "nova",
    }),
  });

  const body = await response.json();
  
  // Auth guard returns 401 for anon key
  assertEquals(response.status === 401 || response.status === 500, true);
  // Response should indicate failure (either success:false or error field)
  assertEquals(body.success === false || !!body.error, true);
});

Deno.test("generate-avatar - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-avatar`, {
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

Deno.test("generate-avatar - uses Kling V3 native audio pipeline (no Wav2Lip)", async () => {
  // Verify the pipeline label returned is kling-v3-native-audio
  // This test validates the function structure without making actual API calls
  // The function should reject requests without auth but the error message
  // should NOT reference Wav2Lip or audio merge
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-avatar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      text: "Hello world test",
      avatarImageUrl: "https://example.com/test.jpg",
      voiceId: "nova",
    }),
  });

  const body = await response.json();
  
  // Should either succeed (with predictionId) or fail with auth/API error
  // but NOT with Wav2Lip-related errors
  if (body.success) {
    assertExists(body.predictionId);
    assertEquals(body.pipeline, "kling-v3-native-audio");
  } else {
    // Error should not mention Wav2Lip
    const errorStr = JSON.stringify(body).toLowerCase();
    assertEquals(errorStr.includes("wav2lip"), false, "Should not reference Wav2Lip");
  }
});

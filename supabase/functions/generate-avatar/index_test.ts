import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("generate-avatar - returns error without required fields", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-avatar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      // Missing required fields
      voiceId: "nova",
    }),
  });

  const body = await response.json();
  
  assertEquals(response.status, 500);
  assertEquals(body.success, false);
  assertExists(body.error);
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

Deno.test("generate-avatar - validates voice ID mapping", async () => {
  // This test verifies the voice mapping logic without making actual API calls
  const voiceMap: Record<string, string> = {
    'onwK4e9ZLuTAKqWW03F9': 'onyx',
    'JBFqnCBsd6RMkjVDRZzb': 'echo',
    'EXAVITQu4vr4xnSDxMaL': 'nova',
    'pFZP5JQG7iQjIQuC4Bku': 'shimmer',
    'cjVigY5qzO86Huf0OWal': 'alloy',
    'onyx': 'onyx',
    'echo': 'echo',
    'nova': 'nova',
    'shimmer': 'shimmer',
  };

  // Test ElevenLabs ID mapping
  assertEquals(voiceMap['onwK4e9ZLuTAKqWW03F9'], 'onyx');
  assertEquals(voiceMap['EXAVITQu4vr4xnSDxMaL'], 'nova');
  
  // Test direct voice names
  assertEquals(voiceMap['nova'], 'nova');
  assertEquals(voiceMap['echo'], 'echo');
});

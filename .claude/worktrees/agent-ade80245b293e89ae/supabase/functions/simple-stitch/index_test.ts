/**
 * Simple Stitch Edge Function Tests
 * 
 * Integration tests for video assembly and stitching.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("simple-stitch - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/simple-stitch`, {
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

Deno.test("simple-stitch - requires project ID", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/simple-stitch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      // Missing projectId
      clipUrls: [],
    }),
  });

  const body = await response.json();
  
  assertEquals(response.status >= 400, true);
  assertExists(body.error);
});

Deno.test("simple-stitch - requires non-empty clip URLs", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/simple-stitch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      projectId: "test-project-id",
      clipUrls: [], // Empty array
    }),
  });

  const body = await response.json();
  
  // Empty clips should be rejected
  assertEquals(response.status >= 400, true);
});
